// ---------------------------------------------------------------------------
// Recommendation Engine — Motore di raccomandazione attivita/intensita
// ---------------------------------------------------------------------------

import { db } from '../../db/db';
import type {
  EnergyState,
  ActivityDefinition,
  Recommendation,
  RecommendationPriority,
  CognitiveLoad,
  TimeSlot,
  OrientationLog,
  OrientationNotification,
  OrientationResult,
} from './types';
import { getFullCatalog } from './activity-catalog';
import { assessEnergyState } from './state-assessor';
import { generateAIOrientationInsight } from './ai-orientation';

// ---------------------------------------------------------------------------
// Costanti e mappe
// ---------------------------------------------------------------------------

const COGNITIVE_LOAD_NUMERIC: Record<CognitiveLoad, number> = {
  minimal: 1,
  low: 2,
  medium: 3,
  high: 4,
  intense: 5,
};

/** Fasce orarie ideali per tipo di attivita */
const TIMESLOT_AFFINITY: Record<string, TimeSlot[]> = {
  deep_work: ['morning', 'early_morning'],
  creative: ['morning', 'afternoon'],
  admin: ['midday', 'afternoon'],
  physical: ['early_morning', 'morning', 'afternoon', 'evening'],
  social: ['midday', 'afternoon', 'evening'],
  learning: ['morning', 'evening'],
  recovery: ['midday', 'evening', 'night', 'afternoon'],
  routine: ['early_morning', 'evening', 'morning'],
};

// ---------------------------------------------------------------------------
// Calcolo match score
// ---------------------------------------------------------------------------

/**
 * Calcola il punteggio di abbinamento (0-100) tra energia disponibile e attivita.
 * Considera: livelli energetici, fascia oraria, carico cognitivo, storia utente.
 */
function computeMatchScore(
  state: EnergyState,
  activity: ActivityDefinition,
): number {
  let score = 0;

  // 1. Compatibilita energetica (max 40 punti)
  //    Quanto i livelli energetici attuali soddisfano i requisiti minimi
  const physGap = state.physical - activity.minEnergy.physical;
  const mentGap = state.mental - activity.minEnergy.mental;
  const emotGap = state.emotional - activity.minEnergy.emotional;

  const physScore = physGap >= 0 ? Math.min(10, physGap + 5) : Math.max(0, 5 + physGap);
  const mentScore = mentGap >= 0 ? Math.min(10, mentGap + 5) : Math.max(0, 5 + mentGap);
  const emotScore = emotGap >= 0 ? Math.min(10, emotGap + 5) : Math.max(0, 5 + emotGap);

  // Peso maggiore alla dimensione primaria
  const dimWeights = { physical: 0.25, mental: 0.25, emotional: 0.25 };
  dimWeights[activity.primaryDimension] = 0.50;
  // Rinormalizza gli altri
  const otherWeight = (1 - 0.50) / 2;
  for (const key of Object.keys(dimWeights) as Array<keyof typeof dimWeights>) {
    if (key !== activity.primaryDimension) dimWeights[key] = otherWeight;
  }

  const energyFit =
    physScore * dimWeights.physical +
    mentScore * dimWeights.mental +
    emotScore * dimWeights.emotional;
  score += (energyFit / 10) * 40;

  // 2. Affinita fascia oraria (max 20 punti)
  const idealSlots = TIMESLOT_AFFINITY[activity.category] || [];
  if (idealSlots.includes(state.timeSlot)) {
    score += 20;
  } else if (idealSlots.length > 0) {
    // Bonus parziale per fasce vicine
    score += 8;
  }

  // 3. Bilanciamento carico cognitivo (max 20 punti)
  //    Se il mentale e' basso, attivita a basso carico cognitivo ottengono piu punti
  const maxCogLoad = state.mental <= 3 ? 2
    : state.mental <= 5 ? 3
      : state.mental <= 7 ? 4
        : 5;
  const loadNum = COGNITIVE_LOAD_NUMERIC[activity.cognitiveLoad];
  if (loadNum <= maxCogLoad) {
    score += 20;
  } else {
    score += Math.max(0, 20 - (loadNum - maxCogLoad) * 8);
  }

  // 4. Bonus per recupero se energia bassa (max 20 punti)
  if (state.level === 'critical' || state.level === 'low') {
    if (activity.category === 'recovery') {
      score += 20;
    } else if (activity.cognitiveLoad === 'minimal') {
      score += 10;
    }
  } else if (state.level === 'peak' || state.level === 'good') {
    // Quando l'energia e' alta, premiare attivita ad alto rendimento
    if (activity.cognitiveLoad === 'intense' || activity.cognitiveLoad === 'high') {
      score += 15;
    }
  }

  return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * Calcola l'intensita raccomandata in base allo stato energetico.
 */
function computeIntensity(state: EnergyState, activity: ActivityDefinition): number {
  // Scala l'intensita predefinita in base al livello energetico
  const levelFactors: Record<string, number> = {
    critical: 0.3,
    low: 0.5,
    moderate: 0.75,
    good: 1.0,
    peak: 1.0,
  };
  const factor = levelFactors[state.level] || 0.75;
  return Math.round(activity.defaultIntensity * factor * 100) / 100;
}

/**
 * Calcola la durata raccomandata (ridotta se energia bassa).
 */
function computeDuration(state: EnergyState, activity: ActivityDefinition): number {
  const durationFactors: Record<string, number> = {
    critical: 0.4,
    low: 0.6,
    moderate: 0.8,
    good: 1.0,
    peak: 1.2,
  };
  const factor = durationFactors[state.level] || 0.8;
  // Arrotonda a multipli di 5
  return Math.max(5, Math.round((activity.typicalDurationMin * factor) / 5) * 5);
}

/**
 * Determina la priorita della raccomandazione.
 */
function determinePriority(
  state: EnergyState,
  activity: ActivityDefinition,
  matchScore: number,
): RecommendationPriority {
  // Se l'energia e' critica e l'attivita e' di recupero, urgente
  if (state.level === 'critical' && activity.category === 'recovery') {
    return 'urgent';
  }
  // Se il match e' alto e la fascia oraria e' ideale
  if (matchScore >= 75) return 'recommended';
  return 'suggestion';
}

// ---------------------------------------------------------------------------
// Generazione notifiche
// ---------------------------------------------------------------------------

function generateNotifications(
  state: EnergyState,
  topRecommendation: Recommendation | null,
): OrientationNotification[] {
  const notifications: OrientationNotification[] = [];
  const now = new Date();

  // Avviso energia critica
  if (state.level === 'critical') {
    notifications.push({
      id: `alert_critical_${now.getTime()}`,
      type: 'alert',
      title: 'Energia molto bassa',
      body: 'Il tuo livello energetico e\' critico. Considera una pausa o un\'attivita di recupero.',
      sentAsPush: false,
      createdAt: now,
    });
  }

  // Avviso energia in forte calo
  if (state.trendVsYesterday < -0.4) {
    notifications.push({
      id: `alert_drop_${now.getTime()}`,
      type: 'alert',
      title: 'Energia in calo rispetto a ieri',
      body: `La tua energia e' significativamente piu bassa di ieri. ${
        state.dominantFatigue && state.dominantFatigue !== 'balanced'
          ? `La fatica principale e' ${state.dominantFatigue === 'physical' ? 'fisica' : state.dominantFatigue === 'mental' ? 'mentale' : 'emotiva'}.`
          : ''
      }`,
      sentAsPush: false,
      createdAt: now,
    });
  }

  // Suggerimento basato sulla raccomandazione top
  if (topRecommendation && topRecommendation.matchScore >= 60) {
    notifications.push({
      id: `suggestion_${now.getTime()}`,
      type: 'suggestion',
      title: `Consiglio: ${topRecommendation.activity.name}`,
      body: topRecommendation.reason,
      recommendationId: topRecommendation.id,
      sentAsPush: false,
      createdAt: now,
    });
  }

  // Suggerimento per fattori specifici
  const negativeFactors = state.factors.filter(f => f.impact < -0.2);
  for (const factor of negativeFactors.slice(0, 1)) { // max 1 per non sovraccaricare
    notifications.push({
      id: `suggestion_factor_${factor.type}_${now.getTime()}`,
      type: 'suggestion',
      title: 'Nota sul tuo stato',
      body: factor.description,
      sentAsPush: false,
      createdAt: now,
    });
  }

  return notifications;
}

// ---------------------------------------------------------------------------
// Generazione motivazione
// ---------------------------------------------------------------------------

function generateReason(
  state: EnergyState,
  activity: ActivityDefinition,
  matchScore: number,
): string {
  const timeLabels: Record<TimeSlot, string> = {
    early_morning: 'la mattina presto',
    morning: 'la mattina',
    midday: 'a meta giornata',
    afternoon: 'il pomeriggio',
    evening: 'la sera',
    night: 'di notte',
  };

  if (activity.category === 'recovery' && (state.level === 'critical' || state.level === 'low')) {
    return `La tua energia e' ${state.level === 'critical' ? 'molto bassa' : 'bassa'}. ${activity.name} ti aiutera a recuperare.`;
  }

  if (matchScore >= 80) {
    return `Ottimo momento per ${activity.name.toLowerCase()}: la tua energia ${
      activity.primaryDimension === 'physical' ? 'fisica' :
        activity.primaryDimension === 'mental' ? 'mentale' : 'emotiva'
    } e' al livello giusto.`;
  }

  if (TIMESLOT_AFFINITY[activity.category]?.includes(state.timeSlot)) {
    return `${timeLabels[state.timeSlot]} e' un buon momento per ${activity.name.toLowerCase()}, e la tua energia lo consente.`;
  }

  return `${activity.name} si adatta al tuo stato energetico attuale (match ${matchScore}%).`;
}

// ---------------------------------------------------------------------------
// API pubblica
// ---------------------------------------------------------------------------

/**
 * Genera l'orientamento energetico completo: stato, raccomandazioni, notifiche.
 */
export async function generateOrientation(userId: number): Promise<OrientationResult> {
  // 1. Valuta lo stato energetico
  const energyState = await assessEnergyState(userId);

  // 2. Ottieni il catalogo completo
  const catalog = await getFullCatalog(userId);

  // 3. Calcola match per ogni attivita
  const scored = catalog.map(activity => ({
    activity,
    matchScore: computeMatchScore(energyState, activity),
  }));

  // 4. Ordina per score e prendi i top
  scored.sort((a, b) => b.matchScore - a.matchScore);
  const topActivities = scored.slice(0, 5);

  // 5. Genera raccomandazioni
  const now = new Date();
  const recommendations: Recommendation[] = topActivities.map((item, idx) => {
    const intensity = computeIntensity(energyState, item.activity);
    const duration = computeDuration(energyState, item.activity);
    const priority = determinePriority(energyState, item.activity, item.matchScore);

    return {
      id: `rec_${now.getTime()}_${idx}`,
      activity: item.activity,
      intensity,
      durationMin: duration,
      priority,
      reason: generateReason(energyState, item.activity, item.matchScore),
      matchScore: item.matchScore,
      suggestedTimeSlot: energyState.timeSlot,
      createdAt: now,
    };
  });

  // 6. Genera notifiche
  const notifications = generateNotifications(energyState, recommendations[0] || null);

  // 7. Insight IA (in parallelo, non blocca)
  let aiInsight = null;
  try {
    aiInsight = await generateAIOrientationInsight(userId, energyState, recommendations);

    // Se l'IA ha suggerito autoResponses, aggiungile alle notifiche come programmazioni
    if (aiInsight?.autoResponses) {
      for (const auto of aiInsight.autoResponses) {
        notifications.push({
          id: `ai_auto_${now.getTime()}_${Math.random().toString(36).slice(2, 6)}`,
          type: auto.type,
          title: auto.title,
          body: `${auto.body} [${auto.trigger}]`,
          sentAsPush: false,
          createdAt: now,
        });
      }
    }
  } catch {
    // IA non disponibile, continua senza
  }

  return {
    energyState,
    recommendations,
    notifications,
    aiInsight,
    generatedAt: now,
  };
}

/**
 * Registra la risposta dell'utente a una raccomandazione (per apprendimento futuro).
 */
export async function logOrientationResponse(
  userId: number,
  energyState: EnergyState,
  recommendation: Recommendation,
  response: OrientationLog['userResponse'],
  feedbackScore?: number,
): Promise<void> {
  const now = new Date();
  await db.orientationLogs.add({
    userId,
    date: now.toISOString().slice(0, 10),
    time: now.toTimeString().slice(0, 5),
    energyState: JSON.stringify(energyState),
    recommendation: JSON.stringify({
      activityId: recommendation.activity.id,
      activityName: recommendation.activity.name,
      intensity: recommendation.intensity,
      durationMin: recommendation.durationMin,
      matchScore: recommendation.matchScore,
    }),
    userResponse: response,
    feedbackScore,
    createdAt: now,
  });
}

/**
 * Ottieni la storia delle raccomandazioni per l'utente (per training IA futuro).
 */
export async function getOrientationHistory(
  userId: number,
  days = 14,
): Promise<OrientationLog[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (days - 1));
  const startStr = startDate.toISOString().slice(0, 10);

  return db.orientationLogs
    .where('userId')
    .equals(userId)
    .and(log => log.date >= startStr)
    .sortBy('date');
}
