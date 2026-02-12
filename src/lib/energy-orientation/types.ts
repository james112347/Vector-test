// ---------------------------------------------------------------------------
// Sistema di Orientamento Energetico — Tipi e interfacce
// ---------------------------------------------------------------------------

/**
 * Livello di carico cognitivo richiesto da un'attivita.
 * Usato per abbinare attivita all'energia disponibile.
 */
export type CognitiveLoad = 'minimal' | 'low' | 'medium' | 'high' | 'intense';

/**
 * Categoria di attivita nell'ambito della vita quotidiana.
 */
export type ActivityCategory =
  | 'deep_work'       // Lavoro intellettuale profondo
  | 'creative'        // Creazione contenuti, design, brainstorming
  | 'admin'           // Compiti amministrativi, email, organizzazione
  | 'physical'        // Esercizio, sport, attivita fisica
  | 'social'          // Interazioni sociali, riunioni
  | 'learning'        // Studio, formazione, lettura tecnica
  | 'recovery'        // Riposo, meditazione, pausa attiva
  | 'routine';        // Compiti abitudinari a basso impegno

/**
 * Dimensione energetica primaria richiesta dall'attivita.
 */
export type EnergyDimension = 'physical' | 'mental' | 'emotional';

/**
 * Definizione di un'attivita nel catalogo.
 */
export interface ActivityDefinition {
  id: string;
  name: string;
  category: ActivityCategory;
  cognitiveLoad: CognitiveLoad;
  /** Quale dimensione energetica consuma di piu */
  primaryDimension: EnergyDimension;
  /** Soglia minima energetica consigliata per ogni dimensione (1-10) */
  minEnergy: {
    physical: number;
    mental: number;
    emotional: number;
  };
  /** Intensita suggerita: 0-1 dove 1 = massimo impegno */
  defaultIntensity: number;
  /** Durata tipica in minuti */
  typicalDurationMin: number;
  /** Icona Lucide da usare nella UI */
  icon: string;
  /** Indica se e' un'attivita predefinita di sistema o personalizzata */
  isCustom: boolean;
}

// ---------------------------------------------------------------------------
// Stato energetico corrente
// ---------------------------------------------------------------------------

/**
 * Fascia oraria nella giornata — influenza la raccomandazione.
 */
export type TimeSlot = 'early_morning' | 'morning' | 'midday' | 'afternoon' | 'evening' | 'night';

/**
 * Livello di energia aggregato come semaforo.
 */
export type EnergyLevel = 'critical' | 'low' | 'moderate' | 'good' | 'peak';

/**
 * Snapshot dello stato energetico in un dato momento.
 * Aggregato da EnergyLog, QuickCheckin, dati Sahha.
 */
export interface EnergyState {
  /** Timestamp della valutazione */
  assessedAt: Date;
  /** Valori grezzi 1-10 */
  physical: number;
  mental: number;
  emotional: number;
  /** Media ponderata complessiva */
  overall: number;
  /** Livello categorizzato */
  level: EnergyLevel;
  /** Fascia oraria corrente */
  timeSlot: TimeSlot;
  /** Trend rispetto allo stesso momento ieri (-1 a +1) */
  trendVsYesterday: number;
  /** Fattori che influenzano lo stato attuale */
  factors: EnergyFactor[];
  /** Tipo di fatica dominante, se presente */
  dominantFatigue: EnergyDimension | 'balanced' | null;
}

/**
 * Fattore che influenza l'energia corrente (rilevato dai dati).
 */
export interface EnergyFactor {
  type: 'sleep' | 'hydration' | 'caffeine' | 'activity' | 'work_hours' | 'meal' | 'stress' | 'biometric';
  /** Impatto stimato: -1 (molto negativo) a +1 (molto positivo) */
  impact: number;
  /** Descrizione leggibile in italiano */
  description: string;
}

// ---------------------------------------------------------------------------
// Raccomandazioni
// ---------------------------------------------------------------------------

/**
 * Priorita della raccomandazione.
 */
export type RecommendationPriority = 'suggestion' | 'recommended' | 'urgent';

/**
 * Una raccomandazione del sistema di orientamento.
 */
export interface Recommendation {
  id: string;
  /** Attivita consigliata */
  activity: ActivityDefinition;
  /** Intensita raccomandata: 0-1 */
  intensity: number;
  /** Durata raccomandata in minuti */
  durationMin: number;
  /** Priorita / urgenza */
  priority: RecommendationPriority;
  /** Motivazione in linguaggio naturale */
  reason: string;
  /** Punteggio di abbinamento energia-attivita (0-100) */
  matchScore: number;
  /** Finestra temporale suggerita */
  suggestedTimeSlot: TimeSlot;
  /** Se l'utente ha seguito la raccomandazione */
  followedAt?: Date;
  /** Se l'utente ha ignorato/saltato */
  dismissedAt?: Date;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Notifiche di orientamento
// ---------------------------------------------------------------------------

/**
 * Tipo di notifica: suggerimento (calmo) vs avviso (urgente).
 * Ciascun tipo avra un suono diverso nella PWA.
 */
export type OrientationNotificationType = 'suggestion' | 'alert';

/**
 * Una notifica generata dal sistema di orientamento.
 */
export interface OrientationNotification {
  id: string;
  type: OrientationNotificationType;
  title: string;
  body: string;
  /** Raccomandazione collegata (se presente) */
  recommendationId?: string;
  /** Se la notifica e' stata letta */
  readAt?: Date;
  /** Se la notifica e' stata inviata come push notification */
  sentAsPush: boolean;
  createdAt: Date;
}

/**
 * Configurazione suoni per le notifiche di orientamento.
 */
export interface NotificationSoundConfig {
  /** Suono per suggerimenti: tono calmo e dolce */
  suggestion: {
    frequency: number;     // Hz — tono piu basso, rilassante
    duration: number;      // ms
    volume: number;        // 0-1
    waveType: OscillatorType;
  };
  /** Suono per avvisi: tono piu presente e chiaro */
  alert: {
    frequency: number;     // Hz — tono piu alto, attenzione
    duration: number;      // ms
    volume: number;        // 0-1
    waveType: OscillatorType;
    /** Ripetizioni per richiamare attenzione */
    repeatCount: number;
    repeatGapMs: number;
  };
}

// ---------------------------------------------------------------------------
// Persistenza (tabelle IndexedDB)
// ---------------------------------------------------------------------------

/**
 * Log delle raccomandazioni generate e la risposta dell'utente.
 * Persistito in IndexedDB per alimentare l'apprendimento dell'algoritmo IA.
 */
export interface OrientationLog {
  id?: number;
  userId: number;
  date: string;           // YYYY-MM-DD
  time: string;           // HH:MM
  /** Stato energetico al momento della raccomandazione */
  energyState: string;    // JSON-stringified EnergyState
  /** Raccomandazione generata */
  recommendation: string; // JSON-stringified Recommendation
  /** Risposta dell'utente */
  userResponse: 'followed' | 'dismissed' | 'deferred' | 'none';
  /** Feedback soggettivo post-attivita (1-5) */
  feedbackScore?: number;
  createdAt: Date;
}

/**
 * Attivita personalizzate dell'utente (estendono il catalogo predefinito).
 */
export interface UserActivity {
  id?: number;
  userId: number;
  activityId: string;
  name: string;
  category: ActivityCategory;
  cognitiveLoad: CognitiveLoad;
  primaryDimension: EnergyDimension;
  minEnergy: string;      // JSON-stringified {physical, mental, emotional}
  defaultIntensity: number;
  typicalDurationMin: number;
  icon: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Preferenze di orientamento dell'utente.
 */
export interface OrientationPreferences {
  id?: number;
  userId: number;
  /** Abilitare le notifiche di orientamento */
  notificationsEnabled: boolean;
  /** Abilitare suoni per le notifiche */
  soundEnabled: boolean;
  /** Intervallo minimo tra notifiche (minuti) */
  minNotificationIntervalMin: number;
  /** Fasce orarie in cui non disturbare */
  quietHours: { start: string; end: string }; // HH:MM
  /** Categorie di attivita preferite */
  preferredCategories: ActivityCategory[];
  /** Livello di aggressivita dei suggerimenti: basso = pochi, alto = frequenti */
  suggestionFrequency: 'low' | 'medium' | 'high';
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Risultato complessivo dell'orientamento
// ---------------------------------------------------------------------------

/**
 * Output completo del sistema di orientamento per un dato momento.
 */
export interface OrientationResult {
  /** Stato energetico corrente */
  energyState: EnergyState;
  /** Lista di raccomandazioni ordinate per matchScore */
  recommendations: Recommendation[];
  /** Eventuali notifiche generate */
  notifications: OrientationNotification[];
  /** Timestamp generazione */
  generatedAt: Date;
}
