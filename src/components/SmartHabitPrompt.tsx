import { useState, useEffect, useCallback } from 'react';
import { X, Bell } from 'lucide-react';
import { generateSmartNotifications, type SmartNotification } from '../lib/habit-intelligence';
import { addCheckin } from '../lib/checkins';

/**
 * Mostra notifiche smart in-app basate sui pattern delle abitudini.
 * Risposta rapida: l'utente puo registrare un check-in con un solo tap.
 */
export default function SmartHabitPrompt({ userId }: { userId: number }) {
  const [notifications, setNotifications] = useState<SmartNotification[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const loadNotifications = useCallback(async () => {
    try {
      const notifs = await generateSmartNotifications(userId);
      setNotifications(notifs);
    } catch {
      // silent - non-critical
    }
  }, [userId]);

  useEffect(() => {
    loadNotifications();
    // Refresh ogni 15 minuti
    const interval = setInterval(loadNotifications, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  const handleQuickResponse = async (notif: SmartNotification, value: number, type: string) => {
    if (value > 0) {
      await addCheckin(userId, type as never, value);
    }
    setDismissed(prev => new Set(prev).add(notif.checkinType));
  };

  const handleDismiss = (notif: SmartNotification) => {
    setDismissed(prev => new Set(prev).add(notif.checkinType));
  };

  const visible = notifications.filter(n => !dismissed.has(n.checkinType));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2">
      {visible.map(notif => {
        const priorityBorder =
          notif.priority === 'high' ? 'border-primary/30 bg-primary/5'
            : notif.priority === 'medium' ? 'border-amber-500/20 bg-amber-500/5'
              : 'border-border bg-card';

        return (
          <div
            key={notif.checkinType}
            className={`rounded-xl border p-3 transition-all animate-in fade-in slide-in-from-top-2 duration-300 ${priorityBorder}`}
          >
            <div className="flex items-start gap-2.5">
              <Bell className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{notif.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{notif.body}</p>
                {/* Quick response buttons */}
                <div className="flex gap-2 mt-2 flex-wrap">
                  {notif.quickResponses.map((resp, i) => (
                    <button
                      key={i}
                      onClick={() => handleQuickResponse(notif, resp.value, resp.type)}
                      className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 active:scale-95 transition-all"
                    >
                      {resp.label}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={() => handleDismiss(notif)}
                className="text-muted-foreground hover:text-foreground p-1 -m-1 shrink-0"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
