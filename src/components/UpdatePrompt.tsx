import { useState, useEffect, useCallback } from 'react';
import type { RegisterSWOptions } from 'vite-plugin-pwa/types';

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
      // Notify the UpdatePrompt component
      if (notifyUpdate) notifyUpdate();
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

  if (!needRefresh) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 p-3 safe-area-top">
      <div className="max-w-md mx-auto bg-card border border-border rounded-xl shadow-lg p-4 animate-in slide-in-from-top fade-in duration-300">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Nuova versione disponibile</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Aggiorna per ottenere le ultime novita e correzioni.
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={doUpdate}
                disabled={updating}
                className="px-4 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                {updating ? 'Aggiornamento...' : 'Aggiorna ora'}
              </button>
              <button
                onClick={dismiss}
                className="px-4 py-1.5 text-xs font-medium rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
              >
                Dopo
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
