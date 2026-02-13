// ---------------------------------------------------------------------------
// Sistema di Orientamento Energetico — API pubblica
// ---------------------------------------------------------------------------

// Tipi
export type {
  CognitiveLoad,
  ActivityCategory,
  EnergyDimension,
  ActivityDefinition,
  TimeSlot,
  EnergyLevel,
  EnergyState,
  EnergyFactor,
  RecommendationPriority,
  Recommendation,
  OrientationNotificationType,
  OrientationNotification,
  NotificationSoundConfig,
  OrientationLog,
  UserActivity,
  OrientationPreferences,
  OrientationResult,
  AIOrientationInsight,
  AIAutoResponse,
} from './types';

// State assessor
export { assessEnergyState, getCurrentTimeSlot } from './state-assessor';

// Activity catalog
export {
  DEFAULT_ACTIVITIES,
  getFullCatalog,
  getActivityById,
  getActivitiesByCategory,
  getActivitiesByCognitiveLoad,
  getActivitiesByDimension,
  addCustomActivity,
  CATEGORY_LABELS,
  COGNITIVE_LOAD_LABELS,
} from './activity-catalog';

// Recommendation engine
export {
  generateOrientation,
  logOrientationResponse,
  getOrientationHistory,
} from './recommendation-engine';

// Notification manager
export {
  DEFAULT_SOUND_CONFIG,
  playSuggestionSound,
  playAlertSound,
  playNotificationSound,
  getOrientationPreferences,
  updateOrientationPreferences,
  sendOrientationNotification,
  processOrientationNotifications,
} from './notification-manager';

// AI orientation
export { generateAIOrientationInsight, lastAIFailureReason } from './ai-orientation';
