import type { EnergyLog, UserProfile, SahhaScoreLog, SahhaBiomarkerLog } from '../db/schema';
import type { DailyCheckinSummary } from './checkins';
import { supabase } from './supabase';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Cache the API key in memory after first fetch
let cachedApiKey: string | null | undefined = undefined;

/**
 * Get Groq API key: tries .env first (local dev), then Supabase app_config (production).
 * Same logic as feedback.ts.
 */
async function getApiKey(): Promise<string | null> {
  if (cachedApiKey !== undefined) return cachedApiKey;

  const envKey = import.meta.env.VITE_GROQ_API_KEY as string | undefined;
  if (envKey && envKey !== 'your_groq_api_key_here') {
    cachedApiKey = envKey;
    return cachedApiKey;
  }

  if (supabase) {
    try {
      const { data } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'groq_api_key')
        .single();
      const key = data?.value || null;
      cachedApiKey = key;
      return key;
    } catch {
      console.warn('Could not fetch Groq API key from Supabase');
    }
  }

  cachedApiKey = null;
  return null;
}

/**
 * Check if AI might be available.
 * Returns true if env key is set OR Supabase is configured (key could be in app_config).
 */
export function isAIAvailable(): boolean {
  // If we already fetched and cached the key, use that
  if (cachedApiKey !== undefined) return !!cachedApiKey;
  // Optimistic: env key is set
  const envKey = import.meta.env.VITE_GROQ_API_KEY as string | undefined;
  if (envKey && envKey !== 'your_groq_api_key_here') return true;
  // Optimistic: Supabase is configured, key might be in app_config
  if (supabase) return true;
  return false;
}

interface AIInsight {
  tag: string;  // es. "Trend", "Idratazione", "Sonno", "Stress"
  title: string;
  body: string;
}

export interface AIAnalysis {
  summary: string;
  insights: AIInsight[];
  suggestion: string;
  energyForecast?: string; // previsione energetica per il resto della giornata
}

// --- Enriched data for AI ---

export interface AIContext {
  profile: UserProfile;
  energyLogs: EnergyLog[];
  checkinSummaries?: DailyCheckinSummary[];
  sahhaScores?: SahhaScoreLog[];
  sahhaBiomarkers?: SahhaBiomarkerLog[];
}

// --- Pattern detection (local, pre-AI) ---

interface DetectedPattern {
  type: string;
  description: string;
}

function detectPatterns(logs: EnergyLog[], checkins?: DailyCheckinSummary[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];
  if (logs.length < 3) return patterns;

  // Trend detection
  const last3 = logs.slice(-3);
  const avgLast3 = last3.reduce((s, l) => s + (l.physical + l.mental + l.emotional) / 3, 0) / 3;
  const prevAvg = logs.length > 3
    ? logs.slice(-6, -3).reduce((s, l) => s + (l.physical + l.mental + l.emotional) / 3, 0) / Math.min(3, logs.slice(-6, -3).length)
    : avgLast3;

  if (avgLast3 - prevAvg > 1) {
    patterns.push({ type: 'trend_up', description: 'Energia in salita negli ultimi giorni' });
  } else if (prevAvg - avgLast3 > 1) {
    patterns.push({ type: 'trend_down', description: 'Energia in calo negli ultimi giorni' });
  }

  // Physical vs mental imbalance
  const avgPhys = logs.reduce((s, l) => s + l.physical, 0) / logs.length;
  const avgMent = logs.reduce((s, l) => s + l.mental, 0) / logs.length;
  if (Math.abs(avgPhys - avgMent) > 2) {
    patterns.push({
      type: 'imbalance',
      description: avgPhys > avgMent
        ? 'Energia fisica piu alta di quella mentale — possibile affaticamento cognitivo'
        : 'Energia mentale piu alta di quella fisica — il corpo ha bisogno di piu attenzione',
    });
  }

  // Weekend vs weekday
  if (logs.length >= 5) {
    const weekday = logs.filter(l => {
      const d = new Date(l.date).getDay();
      return d >= 1 && d <= 5;
    });
    const weekend = logs.filter(l => {
      const d = new Date(l.date).getDay();
      return d === 0 || d === 6;
    });
    if (weekday.length > 0 && weekend.length > 0) {
      const wdAvg = weekday.reduce((s, l) => s + (l.physical + l.mental + l.emotional) / 3, 0) / weekday.length;
      const weAvg = weekend.reduce((s, l) => s + (l.physical + l.mental + l.emotional) / 3, 0) / weekend.length;
      if (weAvg - wdAvg > 1.5) {
        patterns.push({ type: 'weekend_boost', description: 'Energia significativamente piu alta nel weekend' });
      }
    }
  }

  // Hydration correlation
  if (checkins && checkins.length >= 2) {
    const highWaterDays = checkins.filter(c => c.water >= 6);
    const lowWaterDays = checkins.filter(c => c.water > 0 && c.water < 4);
    if (highWaterDays.length > 0 && lowWaterDays.length > 0) {
      const hwEnergy = highWaterDays.map(c => {
        const log = logs.find(l => l.date === c.date);
        return log ? (log.physical + log.mental + log.emotional) / 3 : null;
      }).filter(Boolean) as number[];
      const lwEnergy = lowWaterDays.map(c => {
        const log = logs.find(l => l.date === c.date);
        return log ? (log.physical + log.mental + log.emotional) / 3 : null;
      }).filter(Boolean) as number[];

      if (hwEnergy.length > 0 && lwEnergy.length > 0) {
        const hwAvg = hwEnergy.reduce((s, v) => s + v, 0) / hwEnergy.length;
        const lwAvg = lwEnergy.reduce((s, v) => s + v, 0) / lwEnergy.length;
        if (hwAvg - lwAvg > 1) {
          patterns.push({ type: 'hydration_boost', description: 'Piu acqua = piu energia: correlazione positiva rilevata' });
        }
      }
    }

    // Sleep quality - energy correlation
    const sleepDays = checkins.filter(c => c.sleepQuality !== null);
    if (sleepDays.length >= 2) {
      const goodSleep = sleepDays.filter(c => (c.sleepQuality ?? 0) >= 4);
      const badSleep = sleepDays.filter(c => (c.sleepQuality ?? 0) <= 2);
      if (goodSleep.length > 0 && badSleep.length > 0) {
        const gsEnergy = goodSleep.map(c => {
          const log = logs.find(l => l.date === c.date);
          return log ? (log.physical + log.mental + log.emotional) / 3 : null;
        }).filter(Boolean) as number[];
        const bsEnergy = badSleep.map(c => {
          const log = logs.find(l => l.date === c.date);
          return log ? (log.physical + log.mental + log.emotional) / 3 : null;
        }).filter(Boolean) as number[];
        if (gsEnergy.length > 0 && bsEnergy.length > 0) {
          const gsAvg = gsEnergy.reduce((s, v) => s + v, 0) / gsEnergy.length;
          const bsAvg = bsEnergy.reduce((s, v) => s + v, 0) / bsEnergy.length;
          if (gsAvg - bsAvg > 1) {
            patterns.push({ type: 'sleep_impact', description: 'Sonno di qualita = energia piu alta: forte correlazione' });
          }
        }
      }
    }

    // Focus - energy correlation
    const focusDays = checkins.filter(c => c.focusLevel !== null);
    if (focusDays.length >= 2) {
      const lowFocus = focusDays.filter(c => (c.focusLevel ?? 0) <= 2);
      if (lowFocus.length > 0) {
        const lfEnergy = lowFocus.map(c => {
          const log = logs.find(l => l.date === c.date);
          return log ? log.mental : null;
        }).filter(Boolean) as number[];
        if (lfEnergy.length > 0) {
          const lfAvg = lfEnergy.reduce((s, v) => s + v, 0) / lfEnergy.length;
          if (lfAvg < 5) {
            patterns.push({ type: 'focus_drain', description: 'Focus basso nei giorni con energia mentale bassa' });
          }
        }
      }
    }
  }

  return patterns;
}

// --- Prompt builder ---

function buildPrompt(ctx: AIContext): string {
  const { profile, energyLogs, checkinSummaries, sahhaScores, sahhaBiomarkers } = ctx;

  const goalLabels: Record<string, string> = {
    more_energy: 'avere piu energia',
    better_sleep: 'dormire meglio',
    fitness: 'migliorare la forma fisica',
    stress: 'gestire lo stress',
    general_wellness: 'benessere generale',
  };

  const activityLabels: Record<string, string> = {
    sedentary: 'sedentario',
    light: 'leggera',
    moderate: 'moderata',
    active: 'attiva',
    very_active: 'molto attiva',
  };

  const logsSummary = energyLogs.map(l => {
    const avg = Math.round(((l.physical + l.mental + l.emotional) / 3) * 10) / 10;
    return `${l.date}: fisica=${l.physical} mentale=${l.mental} emotiva=${l.emotional} media=${avg}${l.workHoursToday ? ` ore_lavoro=${l.workHoursToday}` : ''}${l.notes ? ` note="${l.notes}"` : ''}`;
  }).join('\n');

  // Detected patterns
  const patterns = detectPatterns(energyLogs, checkinSummaries);
  const patternStr = patterns.length > 0
    ? '\n\nPATTERN RILEVATI DAL SISTEMA:\n' + patterns.map(p => `- ${p.description}`).join('\n')
    : '';

  // Check-in data
  let checkinStr = '';
  if (checkinSummaries && checkinSummaries.length > 0) {
    checkinStr = '\n\nCHECK-IN GIORNALIERI (fattori che influenzano energia):\n' + checkinSummaries.map(c => {
      const parts = [`${c.date}:`];
      if (c.sleepQuality !== null) parts.push(`qualita_sonno=${c.sleepQuality}/5`);
      if (c.water > 0) parts.push(`acqua=${c.water}bicchieri`);
      if (c.caffeine > 0) parts.push(`caffeina=${c.caffeine}tazzine`);
      if (c.mealQuality !== null) parts.push(`qualita_pasto=${c.mealQuality}/5`);
      if (c.focusLevel !== null) parts.push(`livello_focus=${c.focusLevel}/5`);
      if (c.activityDone !== null) parts.push(`attivita_fisica=${c.activityDone}/5`);
      return parts.join(' ');
    }).join('\n');
  }

  // Sahha biomarkers
  let biomarkerStr = '';
  if (sahhaBiomarkers && sahhaBiomarkers.length > 0) {
    const relevantTypes = ['steps', 'sleep_duration', 'heart_rate_resting', 'heart_rate_variability_sdnn', 'oxygen_saturation'];
    const relevant = sahhaBiomarkers.filter(b => relevantTypes.includes(b.type));
    if (relevant.length > 0) {
      biomarkerStr = '\n\nDATI BIOMETRICI (wearable):\n' + relevant.map(b => {
        let display = b.value;
        if (b.type === 'sleep_duration') {
          const mins = parseFloat(b.value);
          if (Number.isFinite(mins)) display = `${Math.floor(mins / 60)}h${Math.round(mins % 60)}m`;
        }
        return `- ${b.type}: ${display} ${b.unit}`;
      }).join('\n');
    }
  }

  // Sahha scores
  let scoreStr = '';
  if (sahhaScores && sahhaScores.length > 0) {
    scoreStr = '\n\nSCORE SALUTE (Sahha, 0-100%):\n' + sahhaScores.map(s =>
      `- ${s.type}: ${Math.round(s.score * 100)}% (${s.state})`
    ).join('\n');
  }

  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? 'mattina' : hour < 18 ? 'pomeriggio' : 'sera';

  return `Sei un coach di benessere personale e energia italiano, esperto e preciso. Analizza TUTTI i dati disponibili per fornire insight iper-personalizzati.

PROFILO UTENTE:
- Nome: ${profile.name}
- Eta: ${new Date().getFullYear() - profile.birthYear} anni
- Obiettivo: ${goalLabels[profile.goal] || profile.goal}
- Attivita fisica: ${activityLabels[profile.activityLevel] || profile.activityLevel}
- Ore di sonno: ${profile.sleepHours}h/notte
- Ore lavoro/studio giornaliere: ${profile.dailyWorkHours ?? 8}h
- Caffeina abituale: ${profile.caffeineDaily} tazzine/giorno
- Momento attuale: ${timeOfDay}

REGISTRAZIONI ENERGIA (ultimi giorni, scala 1-10):
${logsSummary}${checkinStr}${biomarkerStr}${scoreStr}${patternStr}

Rispondi in formato JSON valido con questa struttura esatta:
{
  "summary": "Una frase che riassume lo stato energetico attuale, personale e basata sui dati",
  "insights": [
    {"tag": "Categoria", "title": "titolo breve", "body": "spiegazione in 1-2 frasi con correlazione tra dati"},
    {"tag": "Categoria", "title": "titolo breve", "body": "spiegazione basata su pattern rilevati"},
    {"tag": "Categoria", "title": "titolo breve", "body": "insight che collega dati biometrici/check-in con energia"}
  ],
  "suggestion": "Un consiglio pratico, specifico e azionabile per ADESSO (${timeOfDay}), basato su tutti i dati",
  "energyForecast": "Previsione dettagliata: 'Se non cambi nulla, nei prossimi 3-5 giorni la tua energia...' Basata sui trend reali dei dati. Includi una stima numerica (es. 'scendera a circa 4/10'). Poi aggiungi cosa puo cambiare il risultato."
}

REGOLE CRITICHE:
- Rispondi SOLO con JSON valido, nessun testo prima o dopo
- Massimo 3 insight, ognuno DEVE basarsi su dati reali presenti
- Il campo "tag" deve essere una parola chiave breve come: Trend, Idratazione, Sonno, Stress, Attivita, Equilibrio, Recupero, Focus, Fatica
- Per uno degli insight, identifica il TIPO DI FATICA/STRESS dell'utente (fisica, mentale, emotiva o mista) e spiega perche basandoti sui dati. Usa il tag "Fatica" per questo insight
- NON usare emoji in nessun campo, solo testo
- Correla attivamente idratazione, stress, sonno e movimento con i livelli energetici
- Se ci sono check-in, usali per dare consigli specifici (es. "hai bevuto poco oggi")
- Se ci sono dati biometrici, confrontali con l'energia percepita
- Usa il nome dell'utente
- Scrivi in italiano professionale ma accessibile
- Il consiglio deve essere per ADESSO, non generico
- La previsione energetica DEVE essere in formato "Se non cambi nulla..." con stima numerica concreta`;
}

// --- Quick tip for LogEnergy page (lightweight, fast model) ---

export interface AIQuickTip {
  comparison: string;   // confronto con ieri
  encouragement: string; // incoraggiamento/consiglio breve
  stressType?: string;  // tipo di stress/fatica (AI-07)
}

function buildQuickTipPrompt(
  todayValues: { physical: number; mental: number; emotional: number },
  yesterdayValues: { physical: number; mental: number; emotional: number } | null,
  profileName: string,
): string {
  const todayAvg = Math.round(((todayValues.physical + todayValues.mental + todayValues.emotional) / 3) * 10) / 10;
  const yesterdayPart = yesterdayValues
    ? `Ieri: fisica=${yesterdayValues.physical} mentale=${yesterdayValues.mental} emotiva=${yesterdayValues.emotional} media=${Math.round(((yesterdayValues.physical + yesterdayValues.mental + yesterdayValues.emotional) / 3) * 10) / 10}`
    : 'Nessun dato di ieri';

  return `Sei un coach energetico. Rispondi in JSON.

Utente: ${profileName}
Oggi: fisica=${todayValues.physical} mentale=${todayValues.mental} emotiva=${todayValues.emotional} media=${todayAvg}
${yesterdayPart}

Rispondi con JSON:
{
  "comparison": "confronto breve con ieri (max 1 frase). Se non ci sono dati di ieri, commenta i valori di oggi",
  "encouragement": "consiglio pratico e incoraggiante per il resto della giornata (max 1 frase)",
  "stressType": "classifica il tipo di fatica principale: 'fisica', 'mentale', 'emotiva', 'mista' o 'nessuna' in base ai valori bassi"
}

REGOLE: Solo JSON, niente testo fuori, in italiano, NO emoji.`;
}

export async function generateQuickTip(
  todayValues: { physical: number; mental: number; emotional: number },
  yesterdayValues: { physical: number; mental: number; emotional: number } | null,
  profileName: string,
): Promise<AIQuickTip> {
  const apiKey = await getApiKey();
  if (!apiKey) throw new Error('Chiave API non configurata');

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: buildQuickTipPrompt(todayValues, yesterdayValues, profileName) }],
      temperature: 0.6,
      max_tokens: 300,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) throw new Error(`Errore API: ${response.status}`);
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Nessuna risposta');
  return JSON.parse(content) as AIQuickTip;
}

// --- Weekly analysis for History page ---

export interface AIWeeklyAnalysis {
  weekSummary: string;
  trend: 'up' | 'down' | 'stable';
  bestDay: string;
  worstDay: string;
  prediction: string;    // AI-03: "Se non cambi nulla..."
  advice: string;
  fatigueType: string;   // AI-07: tipo di fatica dominante nella settimana
}

function buildWeeklyAnalysisPrompt(logs: EnergyLog[], profileName: string): string {
  const logsSummary = logs.map(l => {
    const avg = Math.round(((l.physical + l.mental + l.emotional) / 3) * 10) / 10;
    return `${l.date}: fisica=${l.physical} mentale=${l.mental} emotiva=${l.emotional} media=${avg}${l.notes ? ` note="${l.notes}"` : ''}`;
  }).join('\n');

  return `Sei un analista energetico. Analizza la settimana e rispondi in JSON.

Utente: ${profileName}
DATI SETTIMANALI (scala 1-10):
${logsSummary}

Rispondi con JSON:
{
  "weekSummary": "riassunto della settimana in 1-2 frasi, personale e basato sui dati",
  "trend": "up" o "down" o "stable" (trend generale della settimana),
  "bestDay": "giorno migliore e perche (es. 'Lunedi - energia alta e bilanciata')",
  "worstDay": "giorno peggiore e possibile causa",
  "prediction": "Se continui cosi, nei prossimi giorni... (previsione concreta basata sul trend)",
  "advice": "consiglio settimanale specifico e azionabile basato sui pattern osservati",
  "fatigueType": "tipo di fatica dominante questa settimana: 'fisica', 'mentale', 'emotiva' o 'mista', con breve spiegazione"
}

REGOLE: Solo JSON, niente testo fuori, in italiano, NO emoji, usa il nome dell'utente.`;
}

export async function generateWeeklyAnalysis(
  logs: EnergyLog[],
  profileName: string,
): Promise<AIWeeklyAnalysis> {
  const apiKey = await getApiKey();
  if (!apiKey) throw new Error('Chiave API non configurata');

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: buildWeeklyAnalysisPrompt(logs, profileName) }],
      temperature: 0.6,
      max_tokens: 500,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) throw new Error(`Errore API: ${response.status}`);
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Nessuna risposta');
  return JSON.parse(content) as AIWeeklyAnalysis;
}

// --- Low energy alert (AI-04) ---

export interface AILowEnergyAlert {
  alertTitle: string;
  alertBody: string;
  urgentAdvice: string;
}

export function detectLowEnergy(log: EnergyLog): boolean {
  const avg = (log.physical + log.mental + log.emotional) / 3;
  return avg <= 3 || log.physical <= 2 || log.mental <= 2 || log.emotional <= 2;
}

function buildLowEnergyPrompt(log: EnergyLog, profileName: string): string {
  const avg = Math.round(((log.physical + log.mental + log.emotional) / 3) * 10) / 10;
  return `Sei un coach di benessere. L'utente ha energia molto bassa. Rispondi in JSON.

Utente: ${profileName}
Valori di oggi: fisica=${log.physical} mentale=${log.mental} emotiva=${log.emotional} media=${avg}

Rispondi con JSON:
{
  "alertTitle": "titolo breve e empatico per l'alert (max 5 parole)",
  "alertBody": "messaggio di supporto che riconosce la difficolta (1 frase)",
  "urgentAdvice": "consiglio immediato e specifico per recuperare energia ORA (1-2 frasi)"
}

REGOLE: Solo JSON, niente testo fuori, in italiano, NO emoji, tono empatico e non giudicante.`;
}

export async function generateLowEnergyAlert(
  log: EnergyLog,
  profileName: string,
): Promise<AILowEnergyAlert> {
  const apiKey = await getApiKey();
  if (!apiKey) throw new Error('Chiave API non configurata');

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: buildLowEnergyPrompt(log, profileName) }],
      temperature: 0.5,
      max_tokens: 300,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) throw new Error(`Errore API: ${response.status}`);
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Nessuna risposta');
  return JSON.parse(content) as AILowEnergyAlert;
}

// --- Cache helpers for new AI functions ---

const QUICK_TIP_KEY = 'vector_ai_quick_tip';
const WEEKLY_KEY = 'vector_ai_weekly';
const ALERT_KEY = 'vector_ai_low_alert';
const SHORT_TTL = 30 * 60 * 1000; // 30 min

export function getCachedQuickTip(date: string): AIQuickTip | null {
  try {
    const raw = sessionStorage.getItem(QUICK_TIP_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (cached.date !== date || Date.now() - cached.ts > SHORT_TTL) return null;
    return cached.data;
  } catch { return null; }
}

export function cacheQuickTip(data: AIQuickTip, date: string): void {
  try { sessionStorage.setItem(QUICK_TIP_KEY, JSON.stringify({ data, date, ts: Date.now() })); } catch { /* ignored */ }
}

export function getCachedWeeklyAnalysis(logCount: number, latestDate: string): AIWeeklyAnalysis | null {
  try {
    const raw = sessionStorage.getItem(WEEKLY_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (cached.logCount !== logCount || cached.latestDate !== latestDate || Date.now() - cached.ts > CACHE_TTL) return null;
    return cached.data;
  } catch { return null; }
}

export function cacheWeeklyAnalysis(data: AIWeeklyAnalysis, logCount: number, latestDate: string): void {
  try { sessionStorage.setItem(WEEKLY_KEY, JSON.stringify({ data, logCount, latestDate, ts: Date.now() })); } catch { /* ignored */ }
}

export function getCachedLowEnergyAlert(date: string): AILowEnergyAlert | null {
  try {
    const raw = sessionStorage.getItem(ALERT_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (cached.date !== date || Date.now() - cached.ts > SHORT_TTL) return null;
    return cached.data;
  } catch { return null; }
}

export function cacheLowEnergyAlert(data: AILowEnergyAlert, date: string): void {
  try { sessionStorage.setItem(ALERT_KEY, JSON.stringify({ data, date, ts: Date.now() })); } catch { /* ignored */ }
}

// --- Main insights generator (enhanced with predictions AI-03 and stress type AI-07) ---

export async function generateInsights(ctx: AIContext): Promise<AIAnalysis> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error('Chiave API Groq non configurata');
  }

  if (ctx.energyLogs.length === 0) {
    throw new Error('Nessun dato energetico disponibile');
  }

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'user',
          content: buildPrompt(ctx),
        },
      ],
      temperature: 0.7,
      max_tokens: 800,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Errore API Groq: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('Nessuna risposta dall\'IA');
  }

  const parsed = JSON.parse(content) as AIAnalysis;

  if (!parsed.summary || !parsed.insights || !parsed.suggestion) {
    throw new Error('Risposta IA incompleta');
  }

  return parsed;
}

// Cache in sessionStorage to avoid repeated API calls
const CACHE_KEY = 'vector_ai_insights';
const CACHE_TTL = 2 * 60 * 60 * 1000; // 2 ore (ridotto per dati piu freschi con check-in)

interface CachedInsight {
  data: AIAnalysis;
  timestamp: number;
  dataHash: string;
}

function computeDataHash(ctx: AIContext): string {
  const logPart = ctx.energyLogs.length + ':' + (ctx.energyLogs[ctx.energyLogs.length - 1]?.date || '');
  const checkinPart = ctx.checkinSummaries?.length || 0;
  const scorePart = ctx.sahhaScores?.length || 0;
  return `${logPart}:${checkinPart}:${scorePart}`;
}

export function getCachedInsights(ctx: AIContext): AIAnalysis | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached: CachedInsight = JSON.parse(raw);
    if (Date.now() - cached.timestamp > CACHE_TTL) return null;
    if (cached.dataHash !== computeDataHash(ctx)) return null;
    return cached.data;
  } catch {
    return null;
  }
}

export function cacheInsights(data: AIAnalysis, ctx: AIContext): void {
  try {
    const cached: CachedInsight = { data, timestamp: Date.now(), dataHash: computeDataHash(ctx) };
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(cached));
  } catch {
    // sessionStorage full, ignore
  }
}
