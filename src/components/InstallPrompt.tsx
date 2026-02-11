import { useState, useEffect } from 'react';

const DISMISSED_KEY = 'vector_install_dismissed';

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function getPlatform(): 'ios' | 'android' | 'desktop' {
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'desktop';
}

export default function InstallPrompt() {
  const [visible, setVisible] = useState(false);
  const platform = getPlatform();

  useEffect(() => {
    if (isStandalone()) return;
    const dismissed = localStorage.getItem(DISMISSED_KEY);
    if (dismissed) {
      const ts = parseInt(dismissed, 10);
      // Show again after 7 days
      if (Date.now() - ts < 7 * 24 * 60 * 60 * 1000) return;
    }
    // Small delay so it doesn't flash immediately
    const timer = setTimeout(() => setVisible(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/40 animate-in fade-in duration-300">
      <div className="w-full max-w-md rounded-2xl bg-card border border-border shadow-xl p-5 space-y-4 animate-in slide-in-from-bottom duration-300">
        <div className="flex items-start justify-between">
          <h3 className="text-lg font-bold">Installa Vector</h3>
          <button
            onClick={dismiss}
            className="text-muted-foreground hover:text-foreground p-1 -mr-1 -mt-1"
            aria-label="Chiudi"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="text-sm text-muted-foreground">
          Aggiungi Vector alla schermata Home per un accesso rapido e un'esperienza completa.
        </p>

        {platform === 'ios' && (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold shrink-0">1</span>
              <p className="text-sm">
                Tocca il pulsante <strong>Condividi</strong>{' '}
                <svg className="inline w-4 h-4 -mt-0.5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>{' '}
                in basso nella barra di Safari
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold shrink-0">2</span>
              <p className="text-sm">
                Scorri e tocca <strong>"Aggiungi alla schermata Home"</strong>
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold shrink-0">3</span>
              <p className="text-sm">
                Tocca <strong>"Aggiungi"</strong> in alto a destra
              </p>
            </div>
          </div>
        )}

        {platform === 'android' && (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold shrink-0">1</span>
              <p className="text-sm">
                Tocca il menu{' '}
                <svg className="inline w-4 h-4 -mt-0.5 text-primary" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="5" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="12" cy="19" r="2" />
                </svg>{' '}
                (tre puntini) in alto a destra in Chrome
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold shrink-0">2</span>
              <p className="text-sm">
                Tocca <strong>"Aggiungi a schermata Home"</strong> o <strong>"Installa app"</strong>
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold shrink-0">3</span>
              <p className="text-sm">
                Conferma toccando <strong>"Installa"</strong>
              </p>
            </div>
          </div>
        )}

        {platform === 'desktop' && (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold shrink-0">1</span>
              <p className="text-sm">
                In Chrome, clicca l'icona di installazione{' '}
                <svg className="inline w-4 h-4 -mt-0.5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>{' '}
                nella barra degli indirizzi
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold shrink-0">2</span>
              <p className="text-sm">
                Clicca <strong>"Installa"</strong> nel popup
              </p>
            </div>
          </div>
        )}

        <button
          onClick={dismiss}
          className="w-full rounded-lg bg-primary text-primary-foreground py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Ho capito
        </button>
      </div>
    </div>
  );
}
