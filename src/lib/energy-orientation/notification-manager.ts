// ---------------------------------------------------------------------------
// Notification Manager — Gestione notifiche con suoni differenziati
// ---------------------------------------------------------------------------

import type {
  OrientationNotification,
  OrientationNotificationType,
  NotificationSoundConfig,
  OrientationPreferences,
} from './types';
import { db } from '../../db/db';
import { sendNotification, isNotificationSupported, getNotificationPermission } from '../notifications';

// ---------------------------------------------------------------------------
// Configurazione suoni predefinita
// ---------------------------------------------------------------------------

/**
 * Configurazione suoni di default:
 * - Suggerimento: tono calmo, bassa frequenza, singolo, volume basso
 * - Avviso: tono piu acuto, doppio beep, volume piu alto
 */
export const DEFAULT_SOUND_CONFIG: NotificationSoundConfig = {
  suggestion: {
    frequency: 392,        // Sol4 — tono caldo e calmo
    duration: 200,
    volume: 0.15,
    waveType: 'sine',      // Onda sinusoidale = suono puro, dolce
  },
  alert: {
    frequency: 587,        // Re5 — tono piu alto e chiaro
    duration: 150,
    volume: 0.3,
    waveType: 'triangle',  // Onda triangolare = piu presente ma non aggressiva
    repeatCount: 2,
    repeatGapMs: 200,
  },
};

// ---------------------------------------------------------------------------
// Audio Engine — Genera suoni tramite Web Audio API
// ---------------------------------------------------------------------------

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioContext) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  return audioContext;
}

/**
 * Riproduce un singolo tono con fade-in/fade-out per evitare click.
 */
function playTone(
  frequency: number,
  duration: number,
  volume: number,
  waveType: OscillatorType,
): Promise<void> {
  return new Promise((resolve) => {
    const ctx = getAudioContext();
    if (!ctx) { resolve(); return; }

    // Resume context se sospeso (policy autoplay browser)
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = waveType;
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

    // Fade in dolce (evita click)
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.02);

    // Fade out dolce
    const fadeOutStart = ctx.currentTime + (duration / 1000) - 0.05;
    gainNode.gain.setValueAtTime(volume, fadeOutStart);
    gainNode.gain.linearRampToValueAtTime(0, fadeOutStart + 0.05);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration / 1000);

    oscillator.onended = () => {
      oscillator.disconnect();
      gainNode.disconnect();
      resolve();
    };
  });
}

/**
 * Riproduce il suono per un suggerimento (calmo).
 * Due toni ascendenti morbidi per indicare un messaggio positivo.
 */
export async function playSuggestionSound(
  config = DEFAULT_SOUND_CONFIG.suggestion,
): Promise<void> {
  await playTone(config.frequency, config.duration, config.volume, config.waveType);
  // Secondo tono leggermente piu alto per un effetto "ding" gentile
  await new Promise(r => setTimeout(r, 80));
  await playTone(config.frequency * 1.25, config.duration * 0.8, config.volume * 0.8, config.waveType);
}

/**
 * Riproduce il suono per un avviso (piu urgente).
 * Toni ripetuti con intervallo per richiamare attenzione.
 */
export async function playAlertSound(
  config = DEFAULT_SOUND_CONFIG.alert,
): Promise<void> {
  for (let i = 0; i < config.repeatCount; i++) {
    await playTone(config.frequency, config.duration, config.volume, config.waveType);
    if (i < config.repeatCount - 1) {
      await new Promise(r => setTimeout(r, config.repeatGapMs));
    }
  }
}

/**
 * Riproduce il suono appropriato per il tipo di notifica.
 */
export async function playNotificationSound(
  type: OrientationNotificationType,
  soundConfig = DEFAULT_SOUND_CONFIG,
): Promise<void> {
  if (type === 'suggestion') {
    await playSuggestionSound(soundConfig.suggestion);
  } else {
    await playAlertSound(soundConfig.alert);
  }
}

// ---------------------------------------------------------------------------
// Gestione preferenze
// ---------------------------------------------------------------------------

const DEFAULT_PREFERENCES: Omit<OrientationPreferences, 'id' | 'userId' | 'updatedAt'> = {
  notificationsEnabled: true,
  soundEnabled: true,
  minNotificationIntervalMin: 30,
  quietHours: { start: '22:00', end: '07:00' },
  preferredCategories: ['deep_work', 'physical', 'recovery', 'admin'],
  suggestionFrequency: 'medium',
};

/**
 * Ottieni le preferenze di orientamento dell'utente.
 */
export async function getOrientationPreferences(
  userId: number,
): Promise<OrientationPreferences> {
  const existing = await db.orientationPreferences
    .where('userId')
    .equals(userId)
    .first();

  if (existing) return existing;

  // Crea preferenze predefinite
  const prefs: OrientationPreferences = {
    userId,
    ...DEFAULT_PREFERENCES,
    updatedAt: new Date(),
  };
  const id = await db.orientationPreferences.add(prefs);
  return { ...prefs, id };
}

/**
 * Aggiorna le preferenze di orientamento.
 */
export async function updateOrientationPreferences(
  userId: number,
  updates: Partial<Omit<OrientationPreferences, 'id' | 'userId'>>,
): Promise<void> {
  const existing = await db.orientationPreferences
    .where('userId')
    .equals(userId)
    .first();

  if (existing) {
    await db.orientationPreferences.update(existing.id!, {
      ...updates,
      updatedAt: new Date(),
    });
  } else {
    await db.orientationPreferences.add({
      userId,
      ...DEFAULT_PREFERENCES,
      ...updates,
      updatedAt: new Date(),
    });
  }
}

// ---------------------------------------------------------------------------
// Invio notifiche
// ---------------------------------------------------------------------------

/** Chiave localStorage per tracciare l'ultima notifica inviata */
const LAST_NOTIFICATION_KEY = 'vector_orientation_last_notif';

function getLastNotificationTime(): number {
  try {
    return parseInt(localStorage.getItem(LAST_NOTIFICATION_KEY) || '0', 10);
  } catch { return 0; }
}

function setLastNotificationTime(): void {
  try {
    localStorage.setItem(LAST_NOTIFICATION_KEY, String(Date.now()));
  } catch { /* ignored */ }
}

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

  // Gestisce il caso in cui start > end (es. 22:00 -> 07:00)
  if (startMin > endMin) {
    return currentMin >= startMin || currentMin < endMin;
  }
  return currentMin >= startMin && currentMin < endMin;
}

/**
 * Invia una notifica di orientamento (push + suono).
 * Rispetta le preferenze dell'utente (intervallo, ore silenziose, toggle).
 */
export async function sendOrientationNotification(
  userId: number,
  notification: OrientationNotification,
): Promise<boolean> {
  const prefs = await getOrientationPreferences(userId);

  // Controlli
  if (!prefs.notificationsEnabled) return false;
  if (isQuietHours(prefs.quietHours)) return false;

  const lastTime = getLastNotificationTime();
  const elapsed = Date.now() - lastTime;
  if (elapsed < prefs.minNotificationIntervalMin * 60 * 1000) return false;

  // Suono
  if (prefs.soundEnabled) {
    await playNotificationSound(notification.type);
  }

  // Push notification (se permesso dal browser)
  if (isNotificationSupported() && getNotificationPermission() === 'granted') {
    sendNotification(notification.title, {
      body: notification.body,
      tag: `orientation-${notification.type}`,
      navigateTo: '/Vector-test/orientation',
    });
  }

  setLastNotificationTime();
  return true;
}

/**
 * Processa e invia le notifiche generate dall'orientamento.
 * Filtra per priorita e limita il numero per non sovraccaricare.
 */
export async function processOrientationNotifications(
  userId: number,
  notifications: OrientationNotification[],
): Promise<void> {
  if (notifications.length === 0) return;

  // Prima gli avvisi, poi i suggerimenti
  const sorted = [...notifications].sort((a, b) => {
    if (a.type === 'alert' && b.type !== 'alert') return -1;
    if (a.type !== 'alert' && b.type === 'alert') return 1;
    return 0;
  });

  // Invia al massimo 2 notifiche per sessione
  for (const notif of sorted.slice(0, 2)) {
    const sent = await sendOrientationNotification(userId, notif);
    if (sent) {
      notif.sentAsPush = true;
    }
  }
}
