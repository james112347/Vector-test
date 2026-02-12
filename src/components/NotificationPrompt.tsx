import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
} from '../lib/notifications';
import { useAppSettings } from '../lib/useAppSettings';

const DISMISSED_KEY = 'vector_notif_prompt_dismissed';
const SHOW_DELAY = 20_000; // show after 20 seconds
const RESHOW_AFTER = 3 * 24 * 60 * 60 * 1000; // re-ask after 3 days

export default function NotificationPrompt() {
  const [visible, setVisible] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const { settings, update } = useAppSettings();
  const navigate = useNavigate();

  useEffect(() => {
    // Don't show if not supported, already enabled, or already granted
    if (!isNotificationSupported()) return;
    if (settings.notificationsEnabled) return;
    if (getNotificationPermission() === 'denied') return;

    // Check dismissal cooldown
    const dismissed = localStorage.getItem(DISMISSED_KEY);
    if (dismissed) {
      const ts = parseInt(dismissed, 10);
      if (Date.now() - ts < RESHOW_AFTER) return;
    }

    const timer = setTimeout(() => setVisible(true), SHOW_DELAY);
    return () => clearTimeout(timer);
  }, [settings.notificationsEnabled]);

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setVisible(false);
  };

  const handleEnable = async () => {
    setEnabling(true);
    const granted = await requestNotificationPermission();
    if (granted) {
      update({ notificationsEnabled: true });
    }
    setEnabling(false);
    dismiss();
  };

  const goToSettings = () => {
    dismiss();
    navigate('/settings');
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/40 animate-in fade-in duration-300">
      <div className="w-full max-w-md rounded-2xl bg-card border border-border shadow-xl p-5 space-y-4 animate-in slide-in-from-bottom duration-300">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <h3 className="text-lg font-bold">Attiva le notifiche</h3>
          </div>
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
          Ricevi una notifica quando l'amministratore risponde ai tuoi feedback o quando ci sono aggiornamenti importanti.
        </p>

        <div className="flex gap-2">
          <button
            onClick={handleEnable}
            disabled={enabling}
            className="flex-1 rounded-lg bg-primary text-primary-foreground py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {enabling ? 'Attivazione...' : 'Attiva ora'}
          </button>
          <button
            onClick={goToSettings}
            className="flex-1 rounded-lg border border-border py-2.5 text-sm font-medium hover:bg-muted transition-colors"
          >
            Vai alle Impostazioni
          </button>
        </div>

        <button
          onClick={dismiss}
          className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
        >
          Non ora
        </button>
      </div>
    </div>
  );
}
