// ---------------------------------------------------------------------------
// AI Orientation Intelligence — Groq-powered raccomandazioni intelligenti
// ---------------------------------------------------------------------------

import { db } from '../../db/db';
import { isAIAvailable } from '../ai';
import { supabase } from '../supabase';
import type { EnergyState, Recommendation, AIOrientationInsight, OrientationLog } from './types';
import type { UserProfile, EnergyLog, QuickCheckin, SahhaBiomarkerLog } from '../../db/schema';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Cache chiave API
let cachedApiKey: string | null | undefined = undefined;

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
      cachedApiKey = (data?.value as string) || null;
      return cachedApiKey;
    } catch {
      cachedApiKey = null;
    }
  }
  cachedApiKey = null;
  return null;
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildOrientationPrompt(
  state: EnergyState,
  recommendations: Recommendation[],
  profile: UserProfile | null,
  recentLogs: EnergyLog[],
  todayCheckins: QuickCheckin[],
  sleepBiomarkers: SahhaBiomarkerLog[],
  orientationHistory: OrientationLog[],
): string {
  const hour = new Date().getHours();
  const timeOfDay = hour < 6 ? 'notte' : hour < 12 ? 'mattina' : hour < 18 ? 'pomeriggio' : 'sera';

  const goalLabels: Record<string, string> = {
    more_energy: 'avere piu energia', better_sleep: 'dormire meglio',
    fitness: 'migliorare forma fisica', stress: 'gestire lo stress',
    general_wellness: 'benessere generale',
  };

  // Profilo utente
  const profileStr = profile ? `
PROFILO:
- Nome: ${profile.name}
- Eta: ${new Date().getFullYear() - profile.birthYear} anni
- Obiettivo: ${goalLabels[profile.goal] || profile.goal}
- Ore sonno abituali: ${profile.sleepHours}h
- Ore lavoro/giorno: ${profile.dailyWorkHours ?? 8}h
- Caffeina: ${profile.caffeineDaily} tazzine/giorno
- Attivita: ${profile.activityLevel}` : '';

  // Stato corrente
  const stateStr = `
STATO ENERGETICO ATTUALE (${timeOfDay}, ore ${hour}:00):
- Fisica: ${state.physical}/10
- Mentale: ${state.mental}/10
- Emotiva: ${state.emotional}/10
- Overall: ${state.overall.toFixed(1)}/10
- Livello: ${state.level}
- Fatica dominante: ${state.dominantFatigue || 'nessuna'}
- Trend vs ieri: ${state.trendVsYesterday > 0 ? '+' : ''}${(state.trendVsYesterday * 10).toFixed(1)} punti
- Fattori: ${state.factors.map(f => `${f.type}(${f.impact > 0 ? '+' : ''}${f.impact.toFixed(1)}): ${f.description}`).join('; ') || 'nessuno'}`;

  // Raccomandazioni correnti dall'engine
  const recsStr = `
RACCOMANDAZIONI ALGORITMICHE (top 3):
${recommendations.slice(0, 3).map((r, i) =>
    `${i + 1}. ${r.activity.name} (match ${r.matchScore}%, intensita ${Math.round(r.intensity * 100)}%, ${r.durationMin}min, ${r.priority})`
  ).join('\n')}`;

  // Log recenti
  const logsStr = recentLogs.length > 0 ? `
ENERGIA ULTIMI GIORNI:
${recentLogs.slice(-5).map(l =>
    `${l.date}: F=${l.physical} M=${l.mental} E=${l.emotional} media=${((l.physical + l.mental + l.emotional) / 3).toFixed(1)}`
  ).join('\n')}` : '';

  // Check-in oggi
  const checkinStr = todayCheckins.length > 0 ? `
CHECK-IN OGGI:
${todayCheckins.map(c => `${c.time} ${c.type}=${c.value}`).join(', ')}` : '';

  // Sonno biomarkers
  const sleepStr = sleepBiomarkers.length > 0 ? `
DATI SONNO WEARABLE:
${sleepBiomarkers.map(b => {
    if (b.type === 'sleep_duration') {
      const mins = parseFloat(b.value);
      return `- Durata: ${Math.floor(mins / 60)}h${Math.round(mins % 60)}m`;
    }
    if (b.type === 'sleep_rem_duration') return `- REM: ${Math.round(parseFloat(b.value))}min`;
    if (b.type === 'sleep_deep_duration') return `- Profondo: ${Math.round(parseFloat(b.value))}min`;
    if (b.type === 'sleep_light_duration') return `- Leggero: ${Math.round(parseFloat(b.value))}min`;
    return `- ${b.type}: ${b.value} ${b.unit}`;
  }).join('\n')}` : '';

  // Storia risposte utente (per apprendimento)
  const historyStr = orientationHistory.length > 0 ? `
STORIA RISPOSTE (come l'utente ha reagito alle raccomandazioni):
${orientationHistory.slice(-10).map(h => {
    const rec = JSON.parse(h.recommendation);
    return `${h.date} ${h.time}: ${rec.activityName} → ${h.userResponse}${h.feedbackScore ? ` (voto ${h.feedbackScore}/5)` : ''}`;
  }).join('\n')}` : '';

  return `Sei un sistema IA di orientamento energetico personale. Analizza TUTTI i dati per generare consigli iper-precisi.
${profileStr}${stateStr}${recsStr}${logsStr}${checkinStr}${sleepStr}${historyStr}

Rispondi in JSON con questa struttura:
{
  "stateAnalysis": "Analisi dettagliata dello stato attuale in 2-3 frasi. Spiega PERCHE l'energia e' a questo livello collegando i dati (sonno, check-in, trend, biomarker). Usa il nome dell'utente.",
  "primaryAdvice": "Il consiglio piu importante per ADESSO (${timeOfDay}). Specifico, azionabile, basato sui dati. Non generico.",
  "recommendationRationale": "Spiega perche le raccomandazioni algoritmiche sono adatte o suggerisci un ordine diverso. Breve, 1-2 frasi.",
  "shortTermForecast": "Previsione per le prossime 3-4 ore: cosa aspettarsi dall'energia e come prepararsi. Basata sul trend e i dati.",
  "autoResponses": [
    {
      "trigger": "quando attivare (es. 'tra 2 ore', 'dopo pranzo', 'alle 15:00', 'prima di dormire')",
      "type": "suggestion" o "alert",
      "title": "titolo breve",
      "body": "messaggio specifico e personalizzato"
    }
  ],
  "urgencyLevel": "none|low|medium|high|critical — basato sullo stato attuale",
  "nextNotificationTiming": "Quando inviare la prossima notifica (es. 'tra 45 minuti', 'dopo che finisci di lavorare'). Basato su contesto e dati."
}

REGOLE:
- Solo JSON valido, nessun testo fuori
- In italiano, NO emoji
- Le autoResponses devono essere 2-4 risposte programmate per le prossime ore
- Se la storia mostra che l'utente ignora certi tipi di raccomandazione, ADATTA il tono e il tipo
- L'urgencyLevel deve riflettere il rischio reale di burnout/crollo energetico
- Il timing della prossima notifica deve rispettare l'utente: non troppo frequente, ma non troppo tardi se urgente
- Usa i dati del sonno (fasi REM, profondo, leggero) per contestualizzare l'analisi`;
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

const AI_ORIENT_CACHE_KEY = 'vector_ai_orientation';
const AI_ORIENT_TTL = 20 * 60 * 1000; // 20 minuti

function getCachedAIInsight(stateLevel: string, timeSlot: string): AIOrientationInsight | null {
  try {
    const raw = sessionStorage.getItem(AI_ORIENT_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (Date.now() - cached.ts > AI_ORIENT_TTL) return null;
    if (cached.stateLevel !== stateLevel || cached.timeSlot !== timeSlot) return null;
    return cached.data;
  } catch { return null; }
}

function cacheAIInsight(data: AIOrientationInsight, stateLevel: string, timeSlot: string): void {
  try {
    sessionStorage.setItem(AI_ORIENT_CACHE_KEY, JSON.stringify({
      data, stateLevel, timeSlot, ts: Date.now(),
    }));
  } catch {}
}

// ---------------------------------------------------------------------------
// API pubblica
// ---------------------------------------------------------------------------

/**
 * Genera insight IA per l'orientamento energetico.
 * Usa Groq per analizzare stato, raccomandazioni e contesto.
 * Ritorna null se IA non disponibile.
 */
/** Ragione dell'ultimo fallimento IA (esposta per la UI) */
export let lastAIFailureReason: string | null = null;

export async function generateAIOrientationInsight(
  userId: number,
  state: EnergyState,
  recommendations: Recommendation[],
): Promise<AIOrientationInsight | null> {
  lastAIFailureReason = null;

  if (!isAIAvailable()) {
    lastAIFailureReason = 'Chiave API Groq non configurata. Aggiungi VITE_GROQ_API_KEY nel file .env o nella tabella app_config di Supabase.';
    console.warn('[AI Orientation] IA non disponibile:', lastAIFailureReason);
    return null;
  }

  const apiKey = await getApiKey();
  if (!apiKey) {
    lastAIFailureReason = 'Chiave API Groq non trovata. Verifica che VITE_GROQ_API_KEY sia impostata correttamente.';
    console.warn('[AI Orientation]', lastAIFailureReason);
    return null;
  }

  // Check cache
  const cached = getCachedAIInsight(state.level, state.timeSlot);
  if (cached) return cached;

  // Carica dati di contesto in parallelo
  const [profile, recentLogs, todayCheckins, sleepBiomarkers, orientationHistory] = await Promise.all([
    db.userProfiles.where('userId').equals(userId).first(),
    db.energyLogs.where('userId').equals(userId).toArray()
      .then(logs => logs.sort((a, b) => a.date.localeCompare(b.date)).slice(-7)),
    db.quickCheckins
      .where('[userId+date]')
      .equals([userId, new Date().toISOString().slice(0, 10)])
      .toArray(),
    db.sahhaBiomarkers
      .where('userId')
      .equals(userId)
      .and(b => b.category === 'sleep')
      .toArray(),
    db.orientationLogs
      .where('userId')
      .equals(userId)
      .toArray()
      .then(logs => logs.sort((a, b) => a.date.localeCompare(b.date)).slice(-10)),
  ]);

  const prompt = buildOrientationPrompt(
    state,
    recommendations,
    profile || null,
    recentLogs,
    todayCheckins,
    sleepBiomarkers,
    orientationHistory,
  );

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.6,
        max_tokens: 800,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      if (response.status === 401) {
        lastAIFailureReason = 'Chiave API Groq non valida o scaduta. Genera una nuova chiave su console.groq.com.';
      } else if (response.status === 429) {
        lastAIFailureReason = 'Limite richieste Groq raggiunto. Riprova tra qualche minuto.';
      } else {
        lastAIFailureReason = `Errore API Groq (${response.status}): ${errorText.slice(0, 200)}`;
      }
      console.error('[AI Orientation]', lastAIFailureReason);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      lastAIFailureReason = 'Risposta vuota dall\'API Groq.';
      console.warn('[AI Orientation]', lastAIFailureReason);
      return null;
    }

    const parsed = JSON.parse(content) as AIOrientationInsight;

    // Validazione minima
    if (!parsed.stateAnalysis || !parsed.primaryAdvice) {
      lastAIFailureReason = 'Risposta IA incompleta (mancano campi obbligatori).';
      console.warn('[AI Orientation]', lastAIFailureReason);
      return null;
    }

    // Assicura che autoResponses sia un array
    if (!Array.isArray(parsed.autoResponses)) {
      parsed.autoResponses = [];
    }

    cacheAIInsight(parsed, state.level, state.timeSlot);
    return parsed;
  } catch (err) {
    lastAIFailureReason = `Errore di rete o parsing: ${(err as Error).message}`;
    console.error('[AI Orientation]', lastAIFailureReason);
    return null;
  }
}
