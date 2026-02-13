/**
 * PWA Notification helper.
 * Uses the Notification API for local notifications with precise context.
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

/** Format a timestamp as relative time (e.g. "adesso", "2 min fa") */
function formatTimeAgo(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return 'adesso';
  if (diff < 3600) return `${Math.floor(diff / 60)} min fa`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h fa`;
  return date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** Update the app badge counter (supported on Chrome/Edge PWA). */
export function updateAppBadge(count: number): void {
  if ('setAppBadge' in navigator) {
    if (count > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (navigator as any).setAppBadge(count).catch(() => {});
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (navigator as any).clearAppBadge().catch(() => {});
    }
  }
}

export function sendNotification(
  title: string,
  options?: NotificationOptions & { navigateTo?: string },
): void {
  if (!isNotificationSupported() || Notification.permission !== 'granted') return;

  const { navigateTo, ...notifOptions } = options || {};

  const fullOptions: NotificationOptions & Record<string, unknown> = {
    icon: '/Vector-test/icons/icon-192.png',
    badge: '/Vector-test/icons/icon-192.png',
    vibrate: [100, 50, 100],
    renotify: true,
    timestamp: Date.now(),
    data: { url: navigateTo || '/Vector-test/' },
    ...notifOptions,
  };

  // Try service worker notification first (works when app is in background)
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then(reg => {
      reg.showNotification(title, fullOptions);
    });
  } else {
    // Fallback to regular notification
    const n = new Notification(title, fullOptions);
    if (navigateTo) {
      n.onclick = () => {
        window.focus();
        window.location.href = navigateTo;
      };
    }
  }
}

/** Send notification to admin when new feedback arrives. */
export function notifyNewFeedback(userEmail: string, category: string): void {
  const catLabels: Record<string, string> = {
    bug: 'Bug', feature: 'Nuova funzione', improvement: 'Miglioramento',
    support: 'Supporto', other: 'Feedback',
  };
  const label = catLabels[category] || 'feedback';
  const time = formatTimeAgo(new Date());
  sendNotification('Nuovo feedback ricevuto', {
    body: `${userEmail} — ${label} (${time})`,
    tag: 'new-feedback',
    navigateTo: '/Vector-test/admin/feedback',
  });
}

/** Send notification when admin replies to feedback. */
export function notifyFeedbackReply(): void {
  const time = formatTimeAgo(new Date());
  sendNotification('Risposta al tuo feedback', {
    body: `L'amministratore ha risposto al tuo feedback (${time}). Tocca per leggere.`,
    tag: 'feedback-reply',
    navigateTo: '/Vector-test/feedback',
  });
}

/** Send notification to admin when a new user registers. */
export function notifyNewUser(email: string): void {
  const time = formatTimeAgo(new Date());
  sendNotification('Nuovo utente registrato', {
    body: `${email} ha richiesto l'accesso (${time}). Tocca per approvare.`,
    tag: 'new-user',
    navigateTo: '/Vector-test/settings',
  });
}
