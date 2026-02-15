// ---------------------------------------------------------------------------
// Check-in Reminders — Notifiche browser per promemoria check-in
// ---------------------------------------------------------------------------
// Schedula notifiche browser basate sui pattern delle abitudini dell'utente.
// Usa setTimeout per inviare notifiche quando l'app è aperta e un orario
// tipico di check-in si avvicina.
// ---------------------------------------------------------------------------

import { analyzeHabitPatterns, TYPE_LABELS } from './habit-intelligence';
import { getOrientationPreferences } from './energy-orientation/notification-manager';
import { sendNotification, getNotificationPermission } from './notifications';

const LAST_CHECK_KEY = 'vector_last_reminder_check';
const DEBOUNCE_MS = 10 * 60 * 1000; // 10 minuti

// Track active timers to avoid duplicates across calls
const activeTimers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Verifica se siamo nelle ore di silenzio.
 */
function isQuietHours(quietHours: { start: string; end: string }): boolean {
  const now = new Date();
  const currentMin = now.getHours() * 60 + now.getMinutes();
  const [startH, startM] = quietHours.start.split(':').map(Number);
  const [endH, endM] = quietHours.end.split(':').map(Number);
  const startMin = startH * 60 + startM;
  const endMin = endH * 60 + endM;

  if (startMin > endMin) {
    return currentMin >= startMin || currentMin < endMin;
  }
  return currentMin >= startMin && currentMin < endMin;
}

/**
 * Schedula notifiche browser per i check-in basate sui pattern delle abitudini.
 * Analizza i pattern e per quelli regolari/molto regolari, se un orario tipico
 * è entro i prossimi 60 minuti, schedula un setTimeout per inviare la notifica.
 *
 * @returns Numero di reminder schedulati
 */
export async function scheduleCheckinReminders(userId: number): Promise<number> {
  // Debounce: skip se controllato di recente
  try {
    const lastCheck = parseInt(localStorage.getItem(LAST_CHECK_KEY) || '0', 10);
    if (Date.now() - lastCheck < DEBOUNCE_MS) return 0;
  } catch { /* ignore */ }

  // Verifica permessi notifiche
  if (getNotificationPermission() !== 'granted') return 0;

  // Carica preferenze
  let prefs;
  try {
    prefs = await getOrientationPreferences(userId);
  } catch {
    return 0;
  }

  if (!prefs.notificationsEnabled) return 0;

  // Analizza pattern
  let patterns;
  try {
    patterns = await analyzeHabitPatterns(userId);
  } catch {
    return 0;
  }

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  let scheduled = 0;

  for (const pattern of patterns) {
    // Solo pattern regolari
    if (pattern.regularity !== 'very_regular' && pattern.regularity !== 'regular') continue;

    for (const typicalTime of pattern.typicalTimes) {
      const [h, m] = typicalTime.split(':').map(Number);
      const targetMinutes = h * 60 + (m || 0);
      const diffMinutes = targetMinutes - currentMinutes;

      // Solo se è nei prossimi 60 minuti e non nel passato
      if (diffMinutes <= 0 || diffMinutes > 60) continue;

      // Controlla ore silenziose al momento della notifica
      const targetDate = new Date(now);
      targetDate.setHours(h, m || 0, 0, 0);
      const targetCurrentMin = h * 60 + (m || 0);
      const [qStartH, qStartM] = prefs.quietHours.start.split(':').map(Number);
      const [qEndH, qEndM] = prefs.quietHours.end.split(':').map(Number);
      const qStartMin = qStartH * 60 + qStartM;
      const qEndMin = qEndH * 60 + qEndM;
      const wouldBeQuiet = qStartMin > qEndMin
        ? (targetCurrentMin >= qStartMin || targetCurrentMin < qEndMin)
        : (targetCurrentMin >= qStartMin && targetCurrentMin < qEndMin);
      if (wouldBeQuiet) continue;

      // Controlla se non siamo già in ore silenziose ora
      if (isQuietHours(prefs.quietHours)) continue;

      const timerKey = `${pattern.type}-${typicalTime}`;

      // Skip se timer già attivo per questo tipo+orario
      if (activeTimers.has(timerKey)) continue;

      const delayMs = diffMinutes * 60 * 1000;
      const typeLabel = TYPE_LABELS[pattern.type] || pattern.type;

      const timer = setTimeout(() => {
        activeTimers.delete(timerKey);
        sendNotification(`Promemoria: ${typeLabel}`, {
          body: `Di solito a quest'ora registri ${typeLabel}. Tocca per aprire Vector.`,
          tag: `checkin-reminder-${pattern.type}`,
          navigateTo: '/Vector-test/',
        });
      }, delayMs);

      activeTimers.set(timerKey, timer);
      scheduled++;
    }
  }

  // Aggiorna timestamp ultimo check
  try {
    localStorage.setItem(LAST_CHECK_KEY, String(Date.now()));
  } catch { /* ignore */ }

  return scheduled;
}
