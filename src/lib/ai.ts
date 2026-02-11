import type { EnergyLog, UserProfile, SahhaScoreLog, SahhaBiomarkerLog } from '../db/schema';
import type { DailyCheckinSummary } from './checkins';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

function getApiKey(): string | null {
  return import.meta.env.VITE_GROQ_API_KEY || null;
}

export function isAIAvailable(): boolean {
  const key = getApiKey();
  return !!key && key !== 'your_groq_api_key_here';
}

interface AIInsight {
  emoji: string;
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

    // Stress-energy correlation
    const stressDays = checkins.filter(c => c.stressLevel !== null);
    if (stressDays.length >= 2) {
      const highStress = stressDays.filter(c => (c.stressLevel ?? 0) >= 4);
      if (highStress.length > 0) {
        const hsEnergy = highStress.map(c => {
          const log = logs.find(l => l.date === c.date);
          return log ? (log.physical + log.mental + log.emotional) / 3 : null;
        }).filter(Boolean) as number[];
        if (hsEnergy.length > 0) {
          const hsAvg = hsEnergy.reduce((s, v) => s + v, 0) / hsEnergy.length;
          if (hsAvg < 5) {
            patterns.push({ type: 'stress_drain', description: 'Lo stress alto coincide con cali energetici' });
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
    checkinStr = '\n\nMICRO CHECK-IN GIORNALIERI:\n' + checkinSummaries.map(c => {
      const parts = [`${c.date}:`];
      if (c.water > 0) parts.push(`acqua=${c.water}bicchieri`);
      if (c.caffeine > 0) parts.push(`caffeina=${c.caffeine}`);
      if (c.mealQuality !== null) parts.push(`pasto=${c.mealQuality}/5`);
      if (c.stressLevel !== null) parts.push(`stress=${c.stressLevel}/5`);
      if (c.movementLevel !== null) parts.push(`movimento=${c.movementLevel}/5`);
      if (c.moodLevel !== null) parts.push(`umore=${c.moodLevel}/5`);
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
    {"emoji": "emoji", "title": "titolo breve", "body": "spiegazione in 1-2 frasi con correlazione tra dati"},
    {"emoji": "emoji", "title": "titolo breve", "body": "spiegazione basata su pattern rilevati"},
    {"emoji": "emoji", "title": "titolo breve", "body": "insight che collega dati biometrici/check-in con energia"}
  ],
  "suggestion": "Un consiglio pratico, specifico e azionabile per ADESSO (${timeOfDay}), basato su tutti i dati",
  "energyForecast": "Previsione breve di come sara l'energia nelle prossime ore, basata sui pattern"
}

REGOLE CRITICHE:
- Rispondi SOLO con JSON valido, nessun testo prima o dopo
- Massimo 3 insight, ognuno DEVE basarsi su dati reali presenti
- Correla attivamente idratazione, stress, sonno e movimento con i livelli energetici
- Se ci sono check-in, usali per dare consigli specifici (es. "hai bevuto poco oggi")
- Se ci sono dati biometrici, confrontali con l'energia percepita
- Usa il nome dell'utente
- Scrivi in italiano colloquiale ma informativo
- Gli emoji devono essere singoli emoji unicode
- Il consiglio deve essere per ADESSO, non generico
- La previsione energetica deve essere concreta e breve (1 frase)`;
}

export async function generateInsights(ctx: AIContext): Promise<AIAnalysis> {
  const apiKey = getApiKey();
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
