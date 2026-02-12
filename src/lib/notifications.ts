/**
 * PWA Notification helper.
 * Uses the Notification API for local notifications.
 */

export function isNotificationSupported(): boolean {
  return 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermission {
  if (!isNotificationSupported()) return 'denied';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationSupported()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function sendNotification(title: string, options?: NotificationOptions): void {
  if (!isNotificationSupported() || Notification.permission !== 'granted') return;

  // Try service worker notification first (works when app is in background)
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then(reg => {
      reg.showNotification(title, {
        icon: '/Vector-test/icons/icon-192.png',
        badge: '/Vector-test/icons/icon-192.png',
        ...options,
      });
    });
  } else {
    // Fallback to regular notification
    new Notification(title, {
      icon: '/Vector-test/icons/icon-192.png',
      ...options,
    });
  }
}

/** Send notification to admin when new feedback arrives. */
export function notifyNewFeedback(userEmail: string, category: string): void {
  const catLabels: Record<string, string> = {
    bug: 'Bug', feature: 'Nuova funzione', improvement: 'Miglioramento',
    support: 'Supporto', other: 'Feedback',
  };
  sendNotification('Nuovo feedback ricevuto', {
    body: `${userEmail} ha inviato un ${catLabels[category] || 'feedback'}`,
    tag: 'new-feedback',
  });
}

/** Send notification when admin replies to feedback. */
export function notifyFeedbackReply(): void {
  sendNotification('Risposta al tuo feedback', {
    body: 'L\'amministratore ha risposto al tuo feedback. Apri l\'app per leggerla.',
    tag: 'feedback-reply',
  });
}
