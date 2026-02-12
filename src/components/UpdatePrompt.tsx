import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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

      // Show in-app prompt (or auto-update)
      if (notifyUpdate) {
        notifyUpdate();
      } else if (updateSWFn) {
        updateSWFn(true);
      }
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
  const [updating, setUpdating] = useState(false);
  const navigate = useNavigate();

  usePeriodicUpdateCheck();

  useEffect(() => {
    notifyUpdate = () => setNeedRefresh(true);
    return () => { notifyUpdate = null; };
  }, []);

  const doUpdate = useCallback(() => {
    if (!updateSWFn) return;
    setUpdating(true);
    updateSWFn(true);
  }, []);

  const dismiss = useCallback(() => {
    setNeedRefresh(false);
  }, []);

  const goToChangelog = useCallback(() => {
    setNeedRefresh(false);
    navigate('/settings', { state: { scrollToChangelog: true } });
  }, [navigate]);

  if (!needRefresh) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-in fade-in duration-200">
      <div className="w-full max-w-sm rounded-2xl bg-card border border-border shadow-xl p-6 space-y-5 animate-in zoom-in-95 fade-in duration-300">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <svg className="w-7 h-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
            </svg>
          </div>
        </div>

        {/* Text */}
        <div className="text-center space-y-2">
          <h3 className="text-lg font-bold">Aggiornamento disponibile</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Una nuova versione di Vector e pronta. Aggiorna per ottenere miglioramenti, nuove funzionalita e correzioni.
          </p>
        </div>

        {/* Buttons */}
        <div className="space-y-2.5">
          <button
            onClick={doUpdate}
            disabled={updating}
            className="w-full py-3 text-sm font-medium rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60 active:scale-[0.98]"
          >
            {updating ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                Aggiornamento in corso...
              </span>
            ) : (
              'Aggiorna ora'
            )}
          </button>
          <button
            onClick={goToChangelog}
            className="w-full py-2.5 text-sm font-medium rounded-xl text-primary hover:bg-primary/5 transition-colors"
          >
            Scopri le novità
          </button>
          <button
            onClick={dismiss}
            className="w-full py-2.5 text-sm font-medium rounded-xl text-muted-foreground hover:bg-muted transition-colors"
          >
            Ricordamelo dopo
          </button>
        </div>
      </div>
    </div>
  );
}
