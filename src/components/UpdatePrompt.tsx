import { useState, useEffect } from 'react';
import type { RegisterSWOptions } from 'vite-plugin-pwa/types';
import { sendNotification } from '../lib/notifications';
import { getAppSettings } from '../lib/useAppSettings';

let resolveReady: ((reg: ServiceWorkerRegistration | undefined) => void) | null = null;
let swRegistration: ServiceWorkerRegistration | undefined;
let updateSWFn: ((reloadPage?: boolean) => Promise<void>) | null = null;

// Track whether an update is available — shared across components
let notifyUpdate: (() => void) | null = null;

/**
 * Called from main.tsx to wire up the SW registration.
 */
export function initSW(registerSW: (options: RegisterSWOptions) => (reloadPage?: boolean) => Promise<void>) {
  updateSWFn = registerSW({
    onRegisteredSW(_swUrl, registration) {
      swRegistration = registration;
      if (resolveReady) resolveReady(registration);
    },
    onNeedRefresh() {
      // Send push notification about the update
      if (getAppSettings().notificationsEnabled) {
        sendNotification('Vector si è aggiornata!', {
          body: 'Nuove funzionalità e correzioni disponibili. Tocca per scoprire le novità.',
          tag: 'app-update',
          navigateTo: '/Vector-test/settings#changelog',
        });
      }

      // Auto-update: show brief toast then reload automatically
      if (notifyUpdate) {
        notifyUpdate();
      }

      // Force reload after a short delay to let the toast appear
      setTimeout(() => {
        if (updateSWFn) {
          updateSWFn(true);
        }
      }, 1500);
    },
    onOfflineReady() {
      console.log('Vector e pronta per funzionare offline');
    },
  });
}

/**
 * Periodically check for SW updates.
 * - Every 60s when the page is visible
 * - Immediately when the page regains focus
 */
function usePeriodicUpdateCheck() {
  useEffect(() => {
    // Check immediately on mount
    swRegistration?.update().catch(() => {});

    // Periodic check every 60 seconds
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        swRegistration?.update().catch(() => {});
      }
    }, 60_000);

    // Check when page becomes visible again (e.g., tab switch, app resume)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        swRegistration?.update().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);
}

export default function UpdatePrompt() {
  const [needRefresh, setNeedRefresh] = useState(false);

  usePeriodicUpdateCheck();

  useEffect(() => {
    notifyUpdate = () => setNeedRefresh(true);
    return () => { notifyUpdate = null; };
  }, []);

  if (!needRefresh) return null;

  // Non-interactive toast — auto-reload happens via onNeedRefresh setTimeout
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-center gap-3 rounded-xl bg-card border border-border shadow-lg px-5 py-3">
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent shrink-0" />
        <span className="text-sm font-medium">Aggiornamento in corso...</span>
      </div>
    </div>
  );
}
