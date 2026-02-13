// ---------------------------------------------------------------------------
// AI Hybrid Engine — Algoritmo ibrido locale + Groq per admin suggestions
// ---------------------------------------------------------------------------
// Combina:
// 1. Pattern detection locale (veloce, offline)
// 2. Groq AI per analisi profonda e suggerimenti admin
// 3. Genera raccomandazioni per l'admin su come migliorare precisione
// ---------------------------------------------------------------------------

import { db } from '../db/db';
import { isAIAvailable } from './ai';
import { supabase } from './supabase';
import { analyzeHabitPatterns, type HabitPattern } from './habit-intelligence';
import type { EnergyLog, SahhaBiomarkerLog } from '../db/schema';
import type { DailyCheckinSummary } from './checkins';
import { getCheckinSummaries } from './checkins';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// ---------------------------------------------------------------------------
// Tipi
// ---------------------------------------------------------------------------

export interface AdminSuggestion {
  id: string;
  category: 'data_quality' | 'feature' | 'algorithm' | 'ux' | 'notification';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  expectedImpact: string;
  actionRequired: string;
}

export interface HybridAnalysis {
  /** Pattern locali rilevati */
  localPatterns: LocalPattern[];
  /** Suggerimenti per l'admin generati dall'IA */
  adminSuggestions: AdminSuggestion[];
  /** Score di qualita dati (0-100): quanto sono buoni i dati per le previsioni */
  dataQualityScore: number;
  /** Aree con dati insufficienti */
  dataGaps: string[];
  /** Correlazioni significative trovate */
  correlations: Correlation[];
  generatedAt: Date;
}

export interface LocalPattern {
  type: string;
  description: string;
  confidence: 'high' | 'medium' | 'low';
  impact: number; // -1 a 1
}

export interface Correlation {
  factorA: string;
  factorB: string;
  direction: 'positive' | 'negative';
  strength: 'strong' | 'moderate' | 'weak';
  description: string;
}

// ---------------------------------------------------------------------------
// Local pattern detection (offline, veloce)
// ---------------------------------------------------------------------------

function detectLocalPatterns(
  energyLogs: EnergyLog[],
  checkinSummaries: DailyCheckinSummary[],
  habitPatterns: HabitPattern[],
): LocalPattern[] {
  const patterns: LocalPattern[] = [];
  if (energyLogs.length < 3) return patterns;

  // 1. Caffeina-energia: troppa caffeina la sera = sonno peggiore domani
  const caffeinePattern = habitPatterns.find(p => p.type === 'caffeine');
  if (caffeinePattern) {
    const lateTimes = caffeinePattern.typicalTimes.filter(t => parseInt(t) >= 16);
    if (lateTimes.length > 0) {
      patterns.push({
        type: 'late_caffeine',
        description: `Caffeina dopo le 16:00 rilevata (${lateTimes.join(', ')}). Puo degradare qualita sonno e energia del giorno dopo.`,
        confidence: caffeinePattern.regularity === 'very_regular' ? 'high' : 'medium',
        impact: -0.4,
      });
    }
    if (caffeinePattern.avgDailyCount > 4) {
      patterns.push({
        type: 'high_caffeine',
        description: `Consumo caffeina elevato: media ${caffeinePattern.avgDailyCount} al giorno. Sopra 4 tazzine puo causare dipendenza e crash energetici.`,
        confidence: 'high',
        impact: -0.3,
      });
    }
  }

  // 2. Idratazione-energia
  const waterDays = checkinSummaries.filter(s => s.water > 0);
  if (waterDays.length >= 3) {
    const highWater = waterDays.filter(s => s.water >= 6);
    const lowWater = waterDays.filter(s => s.water < 4);
    if (highWater.length > 0 && lowWater.length > 0) {
      const hwEnergy = highWater.map(s => {
        const log = energyLogs.find(l => l.date === s.date);
        return log ? (log.physical + log.mental + log.emotional) / 3 : null;
      }).filter(Boolean) as number[];
      const lwEnergy = lowWater.map(s => {
        const log = energyLogs.find(l => l.date === s.date);
        return log ? (log.physical + log.mental + log.emotional) / 3 : null;
      }).filter(Boolean) as number[];
      if (hwEnergy.length > 0 && lwEnergy.length > 0) {
        const diff = (hwEnergy.reduce((s, v) => s + v, 0) / hwEnergy.length) -
          (lwEnergy.reduce((s, v) => s + v, 0) / lwEnergy.length);
        if (Math.abs(diff) > 0.5) {
          patterns.push({
            type: 'hydration_impact',
            description: diff > 0
              ? `Idratazione >= 6 bicchieri correla con +${diff.toFixed(1)} punti energia media.`
              : `Idratazione alta correla con ${diff.toFixed(1)} punti energia (possibile overhydration o altro fattore).`,
            confidence: Math.abs(diff) > 1.5 ? 'high' : 'medium',
            impact: diff > 0 ? 0.5 : -0.3,
          });
        }
      }
    }
  }

  // 3. Stress-energia
  const stressDays = checkinSummaries.filter(s => s.stress !== null);
  if (stressDays.length >= 3) {
    const highStress = stressDays.filter(s => (s.stress ?? 0) >= 4);
    if (highStress.length > 0) {
      const hsEnergy = highStress.map(s => {
        const log = energyLogs.find(l => l.date === s.date);
        return log ? (log.physical + log.mental + log.emotional) / 3 : null;
      }).filter(Boolean) as number[];
      if (hsEnergy.length > 0) {
        const avgHsEnergy = hsEnergy.reduce((s, v) => s + v, 0) / hsEnergy.length;
        if (avgHsEnergy < 5) {
          patterns.push({
            type: 'stress_drain',
            description: `Stress alto (>= 4/5) correlato con energia media ${avgHsEnergy.toFixed(1)}. Lo stress e' un fattore critico.`,
            confidence: 'high',
            impact: -0.6,
          });
        }
      }
    }
  }

  // 4. Weekend vs weekday
  if (energyLogs.length >= 5) {
    const weekday = energyLogs.filter(l => {
      const d = new Date(l.date).getDay();
      return d >= 1 && d <= 5;
    });
    const weekend = energyLogs.filter(l => {
      const d = new Date(l.date).getDay();
      return d === 0 || d === 6;
    });
    if (weekday.length > 0 && weekend.length > 0) {
      const wdAvg = weekday.reduce((s, l) => s + (l.physical + l.mental + l.emotional) / 3, 0) / weekday.length;
      const weAvg = weekend.reduce((s, l) => s + (l.physical + l.mental + l.emotional) / 3, 0) / weekend.length;
      if (Math.abs(weAvg - wdAvg) > 1.5) {
        patterns.push({
          type: 'weekday_gap',
          description: weAvg > wdAvg
            ? `Weekend +${(weAvg - wdAvg).toFixed(1)} punti vs giorni lavorativi. Il lavoro consuma energia significativamente.`
            : `Giorni lavorativi +${(wdAvg - weAvg).toFixed(1)} punti vs weekend. La struttura lavorativa aiuta l'energia.`,
          confidence: 'high',
          impact: weAvg > wdAvg ? -0.3 : 0.3,
        });
      }
    }
  }

  // 5. Mood-energia (se disponibile)
  const moodDays = checkinSummaries.filter(s => s.mood !== null);
  if (moodDays.length >= 3) {
    const goodMood = moodDays.filter(s => (s.mood ?? 0) >= 4);
    const badMood = moodDays.filter(s => (s.mood ?? 0) <= 2);
    if (goodMood.length > 0 && badMood.length > 0) {
      const gmEnergy = goodMood.map(s => {
        const log = energyLogs.find(l => l.date === s.date);
        return log ? log.emotional : null;
      }).filter(Boolean) as number[];
      const bmEnergy = badMood.map(s => {
        const log = energyLogs.find(l => l.date === s.date);
        return log ? log.emotional : null;
      }).filter(Boolean) as number[];
      if (gmEnergy.length > 0 && bmEnergy.length > 0) {
        const diff = (gmEnergy.reduce((s, v) => s + v, 0) / gmEnergy.length) -
          (bmEnergy.reduce((s, v) => s + v, 0) / bmEnergy.length);
        if (diff > 1) {
          patterns.push({
            type: 'mood_energy_link',
            description: `Umore positivo correla con +${diff.toFixed(1)} punti energia emotiva. L'umore e' un forte predittore.`,
            confidence: 'high',
            impact: 0.5,
          });
        }
      }
    }
  }

  return patterns;
}

// ---------------------------------------------------------------------------
// Correlazioni
// ---------------------------------------------------------------------------

function findCorrelations(
  energyLogs: EnergyLog[],
  summaries: DailyCheckinSummary[],
): Correlation[] {
  const correlations: Correlation[] = [];
  if (summaries.length < 3) return correlations;

  const factors: { name: string; getValue: (s: DailyCheckinSummary) => number | null }[] = [
    { name: 'Caffeina', getValue: s => s.caffeine > 0 ? s.caffeine : null },
    { name: 'Idratazione', getValue: s => s.water > 0 ? s.water : null },
    { name: 'Qualita sonno', getValue: s => s.sleepQuality },
    { name: 'Stress', getValue: s => s.stress },
    { name: 'Umore', getValue: s => s.mood },
    { name: 'Focus', getValue: s => s.focusLevel },
    { name: 'Attivita fisica', getValue: s => s.activityDone },
    { name: 'Qualita pasto', getValue: s => s.mealQuality },
  ];

  for (const factor of factors) {
    const pairs = summaries.map(s => {
      const val = factor.getValue(s);
      const log = energyLogs.find(l => l.date === s.date);
      if (val === null || !log) return null;
      return { factor: val, energy: (log.physical + log.mental + log.emotional) / 3 };
    }).filter(Boolean) as Array<{ factor: number; energy: number }>;

    if (pairs.length < 3) continue;

    // Simple correlation
    const n = pairs.length;
    const sumX = pairs.reduce((s, p) => s + p.factor, 0);
    const sumY = pairs.reduce((s, p) => s + p.energy, 0);
    const sumXY = pairs.reduce((s, p) => s + p.factor * p.energy, 0);
    const sumX2 = pairs.reduce((s, p) => s + p.factor ** 2, 0);
    const sumY2 = pairs.reduce((s, p) => s + p.energy ** 2, 0);

    const denom = Math.sqrt((n * sumX2 - sumX ** 2) * (n * sumY2 - sumY ** 2));
    if (denom === 0) continue;
    const r = (n * sumXY - sumX * sumY) / denom;

    if (Math.abs(r) < 0.3) continue; // Weak, skip

    const strength: Correlation['strength'] =
      Math.abs(r) >= 0.7 ? 'strong' : Math.abs(r) >= 0.5 ? 'moderate' : 'weak';
    const direction: Correlation['direction'] = r > 0 ? 'positive' : 'negative';

    correlations.push({
      factorA: factor.name,
      factorB: 'Energia media',
      direction,
      strength,
      description: `${factor.name} ha correlazione ${direction === 'positive' ? 'positiva' : 'negativa'} (r=${r.toFixed(2)}) con l'energia.`,
    });
  }

  return correlations.sort((a, b) => {
    const order = { strong: 0, moderate: 1, weak: 2 };
    return order[a.strength] - order[b.strength];
  });
}

// ---------------------------------------------------------------------------
// Data quality score
// ---------------------------------------------------------------------------

function computeDataQualityScore(
  energyLogs: EnergyLog[],
  summaries: DailyCheckinSummary[],
  biomarkers: SahhaBiomarkerLog[],
  habitPatterns: HabitPattern[],
): { score: number; gaps: string[] } {
  let score = 0;
  const gaps: string[] = [];

  // Energy logs (max 25 pts)
  if (energyLogs.length >= 7) score += 25;
  else if (energyLogs.length >= 3) score += 15;
  else if (energyLogs.length >= 1) score += 5;
  else gaps.push('Nessun log energetico registrato');

  // Check-in diversity (max 25 pts)
  const checkinTypes = new Set(summaries.flatMap(s => {
    const types: string[] = [];
    if (s.sleepQuality) types.push('sleep');
    if (s.water > 0) types.push('water');
    if (s.caffeine > 0) types.push('caffeine');
    if (s.stress) types.push('stress');
    if (s.mood) types.push('mood');
    if (s.focusLevel) types.push('focus');
    if (s.activityDone) types.push('activity');
    if (s.mealQuality) types.push('meal');
    return types;
  }));
  score += Math.min(25, checkinTypes.size * 3);
  if (checkinTypes.size < 4) gaps.push(`Solo ${checkinTypes.size} tipi di check-in usati (consigliati >= 4)`);
  if (!checkinTypes.has('sleep')) gaps.push('Qualita sonno mai registrata');
  if (!checkinTypes.has('stress')) gaps.push('Livello stress mai registrato');
  if (!checkinTypes.has('mood')) gaps.push('Umore mai registrato');

  // Wearable data (max 25 pts)
  if (biomarkers.length > 0) {
    const cats = new Set(biomarkers.map(b => b.category));
    score += Math.min(25, cats.size * 7);
  } else {
    gaps.push('Nessun dato wearable collegato');
  }

  // Habit regularity (max 25 pts)
  const regularHabits = habitPatterns.filter(p => p.regularity !== 'irregular');
  score += Math.min(25, regularHabits.length * 5);
  if (habitPatterns.length === 0) gaps.push('Nessun pattern di abitudini rilevato (servono piu giorni di dati)');

  return { score: Math.min(100, score), gaps };
}

// ---------------------------------------------------------------------------
// Admin suggestions via Groq
// ---------------------------------------------------------------------------

async function getApiKey(): Promise<string | null> {
  const envKey = import.meta.env.VITE_GROQ_API_KEY as string | undefined;
  if (envKey && envKey !== 'your_groq_api_key_here') return envKey;
  if (supabase) {
    try {
      const { data } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'groq_api_key')
        .single();
      return (data?.value as string) || null;
    } catch { return null; }
  }
  return null;
}

async function generateAdminSuggestions(
  localPatterns: LocalPattern[],
  correlations: Correlation[],
  dataQuality: number,
  dataGaps: string[],
  userCount: number,
): Promise<AdminSuggestion[]> {
  if (!isAIAvailable()) return generateFallbackSuggestions(dataGaps, dataQuality);

  const apiKey = await getApiKey();
  if (!apiKey) return generateFallbackSuggestions(dataGaps, dataQuality);

  const prompt = `Sei un consulente IA per un'app di monitoraggio energetico. Analizza i dati dell'ecosistema e suggerisci modifiche che l'admin dovrebbe fare per migliorare la precisione delle previsioni e valutazioni.

STATO ATTUALE:
- Utenti attivi: ${userCount}
- Score qualita dati: ${dataQuality}/100
- Gap nei dati: ${dataGaps.length > 0 ? dataGaps.join('; ') : 'nessuno'}
- Pattern locali rilevati: ${localPatterns.length > 0 ? localPatterns.map(p => `${p.type}: ${p.description} (confidence: ${p.confidence})`).join('; ') : 'nessuno'}
- Correlazioni trovate: ${correlations.length > 0 ? correlations.map(c => `${c.factorA} <-> ${c.factorB}: ${c.direction} (${c.strength})`).join('; ') : 'nessuna'}

Rispondi in JSON con un array di suggerimenti:
[
  {
    "id": "sug_01",
    "category": "data_quality" | "feature" | "algorithm" | "ux" | "notification",
    "priority": "critical" | "high" | "medium" | "low",
    "title": "Titolo breve",
    "description": "Descrizione dettagliata del suggerimento",
    "expectedImpact": "Impatto atteso sulla precisione (es. '+15% accuratezza previsioni')",
    "actionRequired": "Azione specifica per l'admin"
  }
]

REGOLE:
- Massimo 5 suggerimenti, ordinati per priorita
- Suggerisci SOLO cose che l'admin PUO fare (configurazione, UX, notifiche, algoritmo)
- Focalizzati su come ottenere PIU dati di qualita dagli utenti
- Solo JSON valido, NO testo fuori, in italiano`;

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
        temperature: 0.5,
        max_tokens: 800,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) return generateFallbackSuggestions(dataGaps, dataQuality);

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return generateFallbackSuggestions(dataGaps, dataQuality);

    const parsed = JSON.parse(content);
    // L'IA potrebbe restituire un oggetto con chiave 'suggestions' o direttamente un array
    const suggestions = Array.isArray(parsed) ? parsed : parsed.suggestions || parsed.suggerimenti || [];
    return suggestions as AdminSuggestion[];
  } catch {
    return generateFallbackSuggestions(dataGaps, dataQuality);
  }
}

/**
 * Suggerimenti fallback quando l'IA non e' disponibile.
 */
function generateFallbackSuggestions(dataGaps: string[], dataQuality: number): AdminSuggestion[] {
  const suggestions: AdminSuggestion[] = [];

  if (dataQuality < 30) {
    suggestions.push({
      id: 'sug_data_low',
      category: 'data_quality',
      priority: 'critical',
      title: 'Qualita dati insufficiente',
      description: 'Il punteggio qualita dati e\' sotto il 30%. Le previsioni IA non possono essere accurate con questi dati.',
      expectedImpact: 'Le previsioni migliorerebbero del 40-60% con piu dati',
      actionRequired: 'Incoraggiare gli utenti a completare i check-in giornalieri e collegare un wearable.',
    });
  }

  for (const gap of dataGaps.slice(0, 3)) {
    suggestions.push({
      id: `sug_gap_${suggestions.length}`,
      category: 'data_quality',
      priority: 'high',
      title: `Gap: ${gap}`,
      description: `Questo dato mancante riduce la precisione delle previsioni.`,
      expectedImpact: '+5-10% accuratezza per ogni gap risolto',
      actionRequired: 'Configurare notifiche di promemoria per i check-in mancanti.',
    });
  }

  if (dataQuality >= 60) {
    suggestions.push({
      id: 'sug_algo',
      category: 'algorithm',
      priority: 'medium',
      title: 'Dati sufficienti per analisi avanzate',
      description: 'Con il livello attuale di dati, l\'algoritmo puo iniziare a generare previsioni attendibili.',
      expectedImpact: 'Previsioni con confidenza media-alta',
      actionRequired: 'Verificare che le notifiche smart siano attive per mantenere il flusso dati.',
    });
  }

  return suggestions;
}

// ---------------------------------------------------------------------------
// API pubblica
// ---------------------------------------------------------------------------

/**
 * Esegue l'analisi ibrida completa: pattern locali + correlazioni + IA.
 */
export async function runHybridAnalysis(userId: number): Promise<HybridAnalysis> {
  // Carica dati in parallelo
  const [energyLogs, summaries, biomarkers, habitPatterns, userCount] = await Promise.all([
    db.energyLogs.where('userId').equals(userId).toArray()
      .then(logs => logs.sort((a, b) => a.date.localeCompare(b.date)).slice(-14)),
    getCheckinSummaries(userId, 14),
    db.sahhaBiomarkers.where('userId').equals(userId).toArray(),
    analyzeHabitPatterns(userId),
    db.users.count(),
  ]);

  // 1. Pattern locali (offline, istantaneo)
  const localPatterns = detectLocalPatterns(energyLogs, summaries, habitPatterns);

  // 2. Correlazioni
  const correlations = findCorrelations(energyLogs, summaries);

  // 3. Data quality
  const { score: dataQualityScore, gaps: dataGaps } = computeDataQualityScore(
    energyLogs, summaries, biomarkers, habitPatterns,
  );

  // 4. Admin suggestions (IA se disponibile)
  const adminSuggestions = await generateAdminSuggestions(
    localPatterns, correlations, dataQualityScore, dataGaps, userCount,
  );

  return {
    localPatterns,
    adminSuggestions,
    dataQualityScore,
    dataGaps,
    correlations,
    generatedAt: new Date(),
  };
}

// Cache
const HYBRID_CACHE_KEY = 'vector_hybrid_analysis';
const HYBRID_CACHE_TTL = 30 * 60 * 1000; // 30 min

export function getCachedHybridAnalysis(): HybridAnalysis | null {
  try {
    const raw = sessionStorage.getItem(HYBRID_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (Date.now() - cached.ts > HYBRID_CACHE_TTL) return null;
    return { ...cached.data, generatedAt: new Date(cached.data.generatedAt) };
  } catch { return null; }
}

export function cacheHybridAnalysis(data: HybridAnalysis): void {
  try {
    sessionStorage.setItem(HYBRID_CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
  } catch { /* ignored */ }
}
