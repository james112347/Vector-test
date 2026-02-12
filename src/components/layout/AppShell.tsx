import { useState, useEffect, useCallback, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { BottomNav } from './BottomNav';
import InstallPrompt from '../InstallPrompt';
import { useAdminNotifications } from '../../lib/useAdminNotifications';

const tooltipMessages = [
  'Hai un feedback da fornire?',
  'Bisogno di assistenza?',
  'Come va l\'esperienza con Vector?',
  'Segnala un problema o suggerisci qualcosa!',
  'Hai trovato un bug? Faccelo sapere!',
  'Qualcosa da migliorare? Scrivici!',
  'Hai bisogno di aiuto?',
  'La tua opinione conta, lascia un feedback!',
];

const TOOLTIP_SHOW_DURATION = 6000;   // visible for 6s
const TOOLTIP_FIRST_DELAY = 8000;     // first popup after 8s
const TOOLTIP_INTERVAL = 120000;      // repeat every 2 minutes

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const isFeedbackPage = location.pathname === '/feedback';
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipText, setTooltipText] = useState('');
  const lastIndexRef = useRef(-1);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Poll for new feedback and notify admin
  useAdminNotifications();

  const pickMessage = useCallback(() => {
    let idx = Math.floor(Math.random() * tooltipMessages.length);
    // Avoid repeating the same message twice in a row
    if (idx === lastIndexRef.current && tooltipMessages.length > 1) {
      idx = (idx + 1) % tooltipMessages.length;
    }
    lastIndexRef.current = idx;
    return tooltipMessages[idx];
  }, []);

  const showPopup = useCallback(() => {
    setTooltipText(pickMessage());
    setShowTooltip(true);
    // Auto-dismiss after TOOLTIP_SHOW_DURATION
    timeoutRef.current = setTimeout(() => setShowTooltip(false), TOOLTIP_SHOW_DURATION);
  }, [pickMessage]);

  useEffect(() => {
    if (isFeedbackPage) {
      setShowTooltip(false);
      return;
    }

    // First popup after a short delay
    const firstTimer = setTimeout(showPopup, TOOLTIP_FIRST_DELAY);

    // Then repeat periodically
    intervalRef.current = setInterval(showPopup, TOOLTIP_INTERVAL);

    return () => {
      clearTimeout(firstTimer);
      clearInterval(intervalRef.current);
      clearTimeout(timeoutRef.current);
    };
  }, [isFeedbackPage, showPopup]);

  const dismissTooltip = () => {
    setShowTooltip(false);
    clearTimeout(timeoutRef.current);
  };

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <Header />
      <main className="flex-1 px-4 py-4 pb-8 safe-area-bottom max-w-lg mx-auto w-full">
        <Outlet />
      </main>
      <BottomNav />
      {!isFeedbackPage && (
        <div className="fixed bottom-20 right-4 z-40 flex items-end gap-2">
          {/* Tooltip bubble */}
          {showTooltip && (
            <div className="relative animate-in slide-in-from-right fade-in duration-300">
              <div className="bg-card border border-border rounded-xl shadow-lg px-3.5 py-2.5 max-w-[200px]">
                <p className="text-xs font-medium">{tooltipText}</p>
                <button
                  onClick={(e) => { e.stopPropagation(); dismissTooltip(); }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-muted border border-border flex items-center justify-center"
                >
                  <svg className="w-3 h-3 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {/* Arrow pointing to button */}
              <div className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-0 h-0 border-y-[6px] border-y-transparent border-l-[6px] border-l-border" />
            </div>
          )}
          {/* Chat FAB */}
          <button
            onClick={() => { dismissTooltip(); navigate('/feedback'); }}
            className="w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors active:scale-95"
            aria-label="Feedback e assistenza"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </button>
        </div>
      )}
      <InstallPrompt />
    </div>
  );
}
