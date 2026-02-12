// ---------------------------------------------------------------------------
// Catalogo Attivita — Mappa attivita con carico cognitivo e requisiti energetici
// ---------------------------------------------------------------------------

import { db } from '../../db/db';
import type { ActivityDefinition, ActivityCategory, CognitiveLoad, EnergyDimension } from './types';

// ---------------------------------------------------------------------------
// Catalogo predefinito di sistema
// ---------------------------------------------------------------------------

export const DEFAULT_ACTIVITIES: ActivityDefinition[] = [
  // --- Deep Work ---
  {
    id: 'deep_coding',
    name: 'Programmazione profonda',
    category: 'deep_work',
    cognitiveLoad: 'intense',
    primaryDimension: 'mental',
    minEnergy: { physical: 4, mental: 7, emotional: 5 },
    defaultIntensity: 0.9,
    typicalDurationMin: 90,
    icon: 'Code',
    isCustom: false,
  },
  {
    id: 'deep_writing',
    name: 'Scrittura approfondita',
    category: 'deep_work',
    cognitiveLoad: 'high',
    primaryDimension: 'mental',
    minEnergy: { physical: 3, mental: 7, emotional: 5 },
    defaultIntensity: 0.8,
    typicalDurationMin: 60,
    icon: 'PenTool',
    isCustom: false,
  },
  {
    id: 'problem_solving',
    name: 'Risoluzione problemi complessi',
    category: 'deep_work',
    cognitiveLoad: 'intense',
    primaryDimension: 'mental',
    minEnergy: { physical: 3, mental: 8, emotional: 5 },
    defaultIntensity: 1.0,
    typicalDurationMin: 45,
    icon: 'Puzzle',
    isCustom: false,
  },

  // --- Creative ---
  {
    id: 'brainstorming',
    name: 'Brainstorming',
    category: 'creative',
    cognitiveLoad: 'medium',
    primaryDimension: 'mental',
    minEnergy: { physical: 3, mental: 5, emotional: 5 },
    defaultIntensity: 0.6,
    typicalDurationMin: 30,
    icon: 'Lightbulb',
    isCustom: false,
  },
  {
    id: 'design_work',
    name: 'Design e creativita',
    category: 'creative',
    cognitiveLoad: 'medium',
    primaryDimension: 'mental',
    minEnergy: { physical: 3, mental: 5, emotional: 5 },
    defaultIntensity: 0.7,
    typicalDurationMin: 60,
    icon: 'Palette',
    isCustom: false,
  },

  // --- Admin ---
  {
    id: 'emails',
    name: 'Email e messaggi',
    category: 'admin',
    cognitiveLoad: 'low',
    primaryDimension: 'mental',
    minEnergy: { physical: 2, mental: 3, emotional: 3 },
    defaultIntensity: 0.3,
    typicalDurationMin: 30,
    icon: 'Mail',
    isCustom: false,
  },
  {
    id: 'planning',
    name: 'Pianificazione e organizzazione',
    category: 'admin',
    cognitiveLoad: 'medium',
    primaryDimension: 'mental',
    minEnergy: { physical: 2, mental: 5, emotional: 4 },
    defaultIntensity: 0.5,
    typicalDurationMin: 30,
    icon: 'ListTodo',
    isCustom: false,
  },
  {
    id: 'paperwork',
    name: 'Burocrazia e documenti',
    category: 'admin',
    cognitiveLoad: 'low',
    primaryDimension: 'mental',
    minEnergy: { physical: 2, mental: 3, emotional: 3 },
    defaultIntensity: 0.3,
    typicalDurationMin: 45,
    icon: 'FileText',
    isCustom: false,
  },

  // --- Physical ---
  {
    id: 'intense_workout',
    name: 'Allenamento intenso',
    category: 'physical',
    cognitiveLoad: 'minimal',
    primaryDimension: 'physical',
    minEnergy: { physical: 7, mental: 3, emotional: 4 },
    defaultIntensity: 0.9,
    typicalDurationMin: 60,
    icon: 'Dumbbell',
    isCustom: false,
  },
  {
    id: 'light_exercise',
    name: 'Esercizio leggero / camminata',
    category: 'physical',
    cognitiveLoad: 'minimal',
    primaryDimension: 'physical',
    minEnergy: { physical: 3, mental: 2, emotional: 2 },
    defaultIntensity: 0.4,
    typicalDurationMin: 30,
    icon: 'Footprints',
    isCustom: false,
  },
  {
    id: 'stretching',
    name: 'Stretching / Yoga leggero',
    category: 'physical',
    cognitiveLoad: 'minimal',
    primaryDimension: 'physical',
    minEnergy: { physical: 2, mental: 2, emotional: 2 },
    defaultIntensity: 0.3,
    typicalDurationMin: 20,
    icon: 'Flower2',
    isCustom: false,
  },

  // --- Social ---
  {
    id: 'meeting',
    name: 'Riunione / Videocall',
    category: 'social',
    cognitiveLoad: 'medium',
    primaryDimension: 'emotional',
    minEnergy: { physical: 3, mental: 5, emotional: 5 },
    defaultIntensity: 0.6,
    typicalDurationMin: 45,
    icon: 'Users',
    isCustom: false,
  },
  {
    id: 'socializing',
    name: 'Socializzare / tempo con amici',
    category: 'social',
    cognitiveLoad: 'low',
    primaryDimension: 'emotional',
    minEnergy: { physical: 3, mental: 3, emotional: 4 },
    defaultIntensity: 0.4,
    typicalDurationMin: 60,
    icon: 'Heart',
    isCustom: false,
  },

  // --- Learning ---
  {
    id: 'study_deep',
    name: 'Studio approfondito',
    category: 'learning',
    cognitiveLoad: 'high',
    primaryDimension: 'mental',
    minEnergy: { physical: 3, mental: 7, emotional: 4 },
    defaultIntensity: 0.8,
    typicalDurationMin: 60,
    icon: 'GraduationCap',
    isCustom: false,
  },
  {
    id: 'study_light',
    name: 'Lettura / revisione leggera',
    category: 'learning',
    cognitiveLoad: 'low',
    primaryDimension: 'mental',
    minEnergy: { physical: 2, mental: 4, emotional: 3 },
    defaultIntensity: 0.4,
    typicalDurationMin: 30,
    icon: 'BookOpen',
    isCustom: false,
  },

  // --- Recovery ---
  {
    id: 'meditation',
    name: 'Meditazione',
    category: 'recovery',
    cognitiveLoad: 'minimal',
    primaryDimension: 'emotional',
    minEnergy: { physical: 1, mental: 1, emotional: 1 },
    defaultIntensity: 0.2,
    typicalDurationMin: 15,
    icon: 'Wind',
    isCustom: false,
  },
  {
    id: 'power_nap',
    name: 'Power nap (20 min)',
    category: 'recovery',
    cognitiveLoad: 'minimal',
    primaryDimension: 'physical',
    minEnergy: { physical: 1, mental: 1, emotional: 1 },
    defaultIntensity: 0.1,
    typicalDurationMin: 20,
    icon: 'Moon',
    isCustom: false,
  },
  {
    id: 'active_break',
    name: 'Pausa attiva',
    category: 'recovery',
    cognitiveLoad: 'minimal',
    primaryDimension: 'physical',
    minEnergy: { physical: 2, mental: 1, emotional: 1 },
    defaultIntensity: 0.2,
    typicalDurationMin: 10,
    icon: 'Coffee',
    isCustom: false,
  },
  {
    id: 'breathing',
    name: 'Esercizi di respirazione',
    category: 'recovery',
    cognitiveLoad: 'minimal',
    primaryDimension: 'emotional',
    minEnergy: { physical: 1, mental: 1, emotional: 1 },
    defaultIntensity: 0.1,
    typicalDurationMin: 5,
    icon: 'CloudSun',
    isCustom: false,
  },

  // --- Routine ---
  {
    id: 'chores',
    name: 'Faccende domestiche',
    category: 'routine',
    cognitiveLoad: 'minimal',
    primaryDimension: 'physical',
    minEnergy: { physical: 3, mental: 1, emotional: 2 },
    defaultIntensity: 0.3,
    typicalDurationMin: 30,
    icon: 'Home',
    isCustom: false,
  },
  {
    id: 'commute',
    name: 'Spostamento / pendolarismo',
    category: 'routine',
    cognitiveLoad: 'minimal',
    primaryDimension: 'physical',
    minEnergy: { physical: 2, mental: 1, emotional: 1 },
    defaultIntensity: 0.2,
    typicalDurationMin: 30,
    icon: 'Car',
    isCustom: false,
  },
];

// ---------------------------------------------------------------------------
// Mappa rapida per lookup
// ---------------------------------------------------------------------------

const catalogMap = new Map<string, ActivityDefinition>();
DEFAULT_ACTIVITIES.forEach(a => catalogMap.set(a.id, a));

// ---------------------------------------------------------------------------
// API pubblica
// ---------------------------------------------------------------------------

/**
 * Ottieni tutte le attivita disponibili (predefinite + personalizzate dell'utente).
 */
export async function getFullCatalog(userId: number): Promise<ActivityDefinition[]> {
  const userActivities = await db.userActivities
    .where('userId')
    .equals(userId)
    .toArray();

  const customActivities: ActivityDefinition[] = userActivities.map(ua => ({
    id: ua.activityId,
    name: ua.name,
    category: ua.category,
    cognitiveLoad: ua.cognitiveLoad,
    primaryDimension: ua.primaryDimension,
    minEnergy: JSON.parse(ua.minEnergy),
    defaultIntensity: ua.defaultIntensity,
    typicalDurationMin: ua.typicalDurationMin,
    icon: ua.icon,
    isCustom: true,
  }));

  return [...DEFAULT_ACTIVITIES, ...customActivities];
}

/**
 * Trova un'attivita per ID.
 */
export function getActivityById(id: string): ActivityDefinition | undefined {
  return catalogMap.get(id);
}

/**
 * Filtra attivita per categoria.
 */
export function getActivitiesByCategory(category: ActivityCategory): ActivityDefinition[] {
  return DEFAULT_ACTIVITIES.filter(a => a.category === category);
}

/**
 * Filtra attivita per carico cognitivo massimo.
 */
export function getActivitiesByCognitiveLoad(maxLoad: CognitiveLoad): ActivityDefinition[] {
  const loadOrder: CognitiveLoad[] = ['minimal', 'low', 'medium', 'high', 'intense'];
  const maxIdx = loadOrder.indexOf(maxLoad);
  return DEFAULT_ACTIVITIES.filter(a => loadOrder.indexOf(a.cognitiveLoad) <= maxIdx);
}

/**
 * Filtra attivita per dimensione energetica primaria.
 */
export function getActivitiesByDimension(dimension: EnergyDimension): ActivityDefinition[] {
  return DEFAULT_ACTIVITIES.filter(a => a.primaryDimension === dimension);
}

/**
 * Aggiungi un'attivita personalizzata dell'utente.
 */
export async function addCustomActivity(
  userId: number,
  activity: Omit<ActivityDefinition, 'isCustom'>,
): Promise<void> {
  await db.userActivities.add({
    userId,
    activityId: activity.id,
    name: activity.name,
    category: activity.category,
    cognitiveLoad: activity.cognitiveLoad,
    primaryDimension: activity.primaryDimension,
    minEnergy: JSON.stringify(activity.minEnergy),
    defaultIntensity: activity.defaultIntensity,
    typicalDurationMin: activity.typicalDurationMin,
    icon: activity.icon,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

/**
 * Etichette italiane per le categorie.
 */
export const CATEGORY_LABELS: Record<ActivityCategory, string> = {
  deep_work: 'Lavoro profondo',
  creative: 'Creativita',
  admin: 'Amministrazione',
  physical: 'Attivita fisica',
  social: 'Sociale',
  learning: 'Apprendimento',
  recovery: 'Recupero',
  routine: 'Routine',
};

/**
 * Etichette italiane per il carico cognitivo.
 */
export const COGNITIVE_LOAD_LABELS: Record<CognitiveLoad, string> = {
  minimal: 'Minimo',
  low: 'Basso',
  medium: 'Medio',
  high: 'Alto',
  intense: 'Intenso',
};
