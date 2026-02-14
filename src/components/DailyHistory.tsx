import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Moon, Droplets, Coffee, UtensilsCrossed, Brain, Activity,
  Zap, Heart, ChevronDown, ChevronRight, Calendar,
  BedDouble, Pill, MonitorOff,
  BookOpen, Briefcase, Sofa, Dumbbell, Gamepad2, Users, Car,
} from 'lucide-react';
import { getCheckinSummaries } from '../lib/checkins';
import type { DailyCheckinSummary } from '../lib/checkins';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (dateStr === today.toISOString().slice(0, 10)) return 'Oggi';
  if (dateStr === yesterday.toISOString().slice(0, 10)) return 'Ieri';

  return date.toLocaleDateString('it-IT', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function formatMonthYear(dateStr: string): string {
  const [y, m] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, 1);
  const label = date.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function ratingColor(value: number | null, inverse = false): string {
  if (value == null) return 'bg-muted text-muted-foreground';
  const v = inverse ? 6 - value : value;
  if (v >= 4) return 'bg-green-500/15 text-green-700 dark:text-green-400';
  if (v >= 3) return 'bg-amber-500/15 text-amber-700 dark:text-amber-400';
  return 'bg-red-500/15 text-red-700 dark:text-red-400';
}

function ratingLabel(value: number | null, labels: string[]): string {
  if (value == null) return '-';
  return labels[value - 1] || String(value);
}

const MOOD_LABELS = ['Male', 'Poco', 'Medio', 'Bene', 'Ottimo'];
const SLEEP_LABELS = ['Male', 'Poco', 'Medio', 'Bene', 'Ottimo'];
const STRESS_LABELS = ['Alto', 'Medio+', 'Medio', 'Basso', 'Minimo'];
const FOCUS_LABELS = ['Male', 'Poco', 'Medio', 'Bene', 'Ottimo'];
const ACTIVITY_LABELS = ['Nessuna', 'Leggera', 'Moderata', 'Buona', 'Intensa'];
const MEAL_LABELS = ['Saltato', 'Snack', 'Veloce', 'Buono', 'Completo'];

const CURRENT_ACTIVITY_MAP: Record<number, { label: string; icon: typeof BookOpen; color: string }> = {
  1: { label: 'Studio', icon: BookOpen, color: 'text-blue-600 dark:text-blue-400' },
  2: { label: 'Lavoro', icon: Briefcase, color: 'text-slate-600 dark:text-slate-400' },
  3: { label: 'Pausa', icon: Sofa, color: 'text-teal-600 dark:text-teal-400' },
  4: { label: 'Sport', icon: Dumbbell, color: 'text-orange-600 dark:text-orange-400' },
  5: { label: 'Tempo libero', icon: Gamepad2, color: 'text-purple-600 dark:text-purple-400' },
  6: { label: 'Sociale', icon: Users, color: 'text-pink-600 dark:text-pink-400' },
  7: { label: 'Spostamenti', icon: Car, color: 'text-amber-600 dark:text-amber-400' },
};

/** Count how many metrics were logged for a day */
function completionCount(s: DailyCheckinSummary): number {
  let count = 0;
  if (s.sleepQuality != null) count++;
  if (s.mood != null) count++;
  if (s.stress != null) count++;
  if (s.focusLevel != null) count++;
  if (s.activityDone != null) count++;
  if (s.mealQuality != null) count++;
  if (s.water > 0) count++;
  if (s.caffeine > 0) count++;
  if (s.nap != null) count++;
  if (s.supplement > 0) count++;
  if (s.screenBreak > 0) count++;
  if (s.activities.length > 0) count++;
  return count;
}

// ---------------------------------------------------------------------------
// Day detail card (expanded view)
// ---------------------------------------------------------------------------

function DayDetail({ summary: s }: { summary: DailyCheckinSummary }) {
  const metrics: Array<{
    icon: typeof Moon;
    label: string;
    value: string;
    color: string;
    show: boolean;
  }> = [
    {
      icon: Moon,
      label: 'Sonno',
      value: ratingLabel(s.sleepQuality, SLEEP_LABELS),
      color: ratingColor(s.sleepQuality),
      show: s.sleepQuality != null,
    },
    {
      icon: Heart,
      label: 'Umore',
      value: ratingLabel(s.mood, MOOD_LABELS),
      color: ratingColor(s.mood),
      show: s.mood != null,
    },
    {
      icon: Zap,
      label: 'Stress',
      value: ratingLabel(s.stress, STRESS_LABELS),
      color: ratingColor(s.stress, true),
      show: s.stress != null,
    },
    {
      icon: Brain,
      label: 'Focus',
      value: ratingLabel(s.focusLevel, FOCUS_LABELS),
      color: ratingColor(s.focusLevel),
      show: s.focusLevel != null,
    },
    {
      icon: Activity,
      label: 'Movimento',
      value: ratingLabel(s.activityDone, ACTIVITY_LABELS),
      color: ratingColor(s.activityDone),
      show: s.activityDone != null,
    },
    {
      icon: UtensilsCrossed,
      label: 'Pasto',
      value: ratingLabel(s.mealQuality, MEAL_LABELS),
      color: ratingColor(s.mealQuality),
      show: s.mealQuality != null,
    },
    {
      icon: Droplets,
      label: 'Acqua',
      value: `${s.water} bicchieri`,
      color: s.water >= 6 ? 'bg-green-500/15 text-green-700 dark:text-green-400' : s.water >= 3 ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400' : 'bg-red-500/15 text-red-700 dark:text-red-400',
      show: s.water > 0,
    },
    {
      icon: Coffee,
      label: 'Caffeina',
      value: `${s.caffeine} ${s.caffeine === 1 ? 'caffe' : 'caffe'}`,
      color: s.caffeine <= 3 ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400' : 'bg-red-500/15 text-red-700 dark:text-red-400',
      show: s.caffeine > 0,
    },
    {
      icon: BedDouble,
      label: 'Pisolino',
      value: 'Si',
      color: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400',
      show: s.nap != null,
    },
    {
      icon: Pill,
      label: 'Integratori',
      value: `${s.supplement}`,
      color: 'bg-teal-500/15 text-teal-700 dark:text-teal-400',
      show: s.supplement > 0,
    },
    {
      icon: MonitorOff,
      label: 'Pause schermo',
      value: `${s.screenBreak}`,
      color: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-400',
      show: s.screenBreak > 0,
    },
  ];

  const visible = metrics.filter(m => m.show);

  return (
    <div className="space-y-3 pt-2">
      {/* Metric badges */}
      {visible.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {visible.map((m) => {
            const Icon = m.icon;
            return (
              <div key={m.label} className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 ${m.color}`}>
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="text-[11px] font-medium">{m.label}</span>
                <span className="text-[11px] ml-auto font-semibold">{m.value}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Activity timeline */}
      {s.activities.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground mb-1.5">Attivita</p>
          <div className="flex flex-wrap gap-1.5">
            {s.activities.map((a, i) => {
              const info = CURRENT_ACTIVITY_MAP[a.activity];
              if (!info) return null;
              const Icon = info.icon;
              return (
                <span key={i} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 bg-muted text-[10px] ${info.color}`}>
                  <Icon className="h-3 w-3" />
                  {a.time} {info.label}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Caffeine times */}
      {s.caffeineTimes.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground mb-1">Orari caffeina</p>
          <div className="flex flex-wrap gap-1">
            {s.caffeineTimes.map((t, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px]">
                <Coffee className="h-2.5 w-2.5" /> {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {visible.length === 0 && (
        <p className="text-xs text-muted-foreground italic">Nessun dato registrato</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Day row (collapsed summary)
// ---------------------------------------------------------------------------

function DayRow({ summary, expanded, onToggle }: {
  summary: DailyCheckinSummary;
  expanded: boolean;
  onToggle: () => void;
}) {
  const count = completionCount(summary);

  // Quick mood/sleep/stress indicator dots
  const dots: Array<{ color: string; title: string }> = [];
  if (summary.mood != null) {
    const v = summary.mood;
    dots.push({
      color: v >= 4 ? 'bg-green-500' : v >= 3 ? 'bg-amber-500' : 'bg-red-500',
      title: `Umore: ${ratingLabel(summary.mood, MOOD_LABELS)}`,
    });
  }
  if (summary.sleepQuality != null) {
    const v = summary.sleepQuality;
    dots.push({
      color: v >= 4 ? 'bg-blue-500' : v >= 3 ? 'bg-amber-500' : 'bg-red-500',
      title: `Sonno: ${ratingLabel(summary.sleepQuality, SLEEP_LABELS)}`,
    });
  }
  if (summary.stress != null) {
    const v = summary.stress;
    dots.push({
      color: v >= 4 ? 'bg-green-500' : v >= 3 ? 'bg-amber-500' : 'bg-red-500',
      title: `Stress: ${ratingLabel(summary.stress, STRESS_LABELS)}`,
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-3.5 py-3 text-left hover:bg-muted/50 transition-colors"
      >
        {/* Date */}
        <div className="min-w-[72px]">
          <p className="text-sm font-semibold">{formatDate(summary.date)}</p>
        </div>

        {/* Indicator dots */}
        <div className="flex items-center gap-1">
          {dots.map((d, i) => (
            <span key={i} className={`w-2 h-2 rounded-full ${d.color}`} title={d.title} />
          ))}
        </div>

        {/* Completion badge */}
        <span className="ml-auto text-[10px] text-muted-foreground">
          {count} dati
        </span>

        {/* Water quick indicator */}
        {summary.water > 0 && (
          <span className="text-[10px] text-blue-600 dark:text-blue-400 flex items-center gap-0.5">
            <Droplets className="h-3 w-3" />{summary.water}
          </span>
        )}

        {/* Expand icon */}
        <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="px-3.5 pb-3 border-t border-border">
          <DayDetail summary={summary} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const INITIAL_DAYS = 30;
const LOAD_MORE_DAYS = 90;
const MAX_DAYS = 365;

export default function DailyHistory({ userId }: { userId: number }) {
  const [summaries, setSummaries] = useState<DailyCheckinSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [daysLoaded, setDaysLoaded] = useState(INITIAL_DAYS);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [sectionOpen, setSectionOpen] = useState(false);

  const loadHistory = useCallback(async (days: number) => {
    setLoading(true);
    try {
      const data = await getCheckinSummaries(userId, days);
      setSummaries(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadHistory(daysLoaded);
  }, [daysLoaded, loadHistory]);

  // Sorted newest first
  const sorted = useMemo(
    () => [...summaries].sort((a, b) => b.date.localeCompare(a.date)),
    [summaries],
  );

  // Group by month
  const grouped = useMemo(() => {
    const map = new Map<string, DailyCheckinSummary[]>();
    for (const s of sorted) {
      const monthKey = s.date.slice(0, 7); // YYYY-MM
      const arr = map.get(monthKey) || [];
      arr.push(s);
      map.set(monthKey, arr);
    }
    return Array.from(map.entries());
  }, [sorted]);

  const canLoadMore = daysLoaded < MAX_DAYS && sorted.length >= daysLoaded * 0.3;

  if (sorted.length === 0 && !loading) return null;

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setSectionOpen(prev => !prev)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/30 transition-colors"
      >
        <span className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center shrink-0">
          <Calendar className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Le tue giornate</p>
          <p className="text-xs text-muted-foreground">
            {sorted.length} giorn{sorted.length === 1 ? 'ata' : 'ate'} registrat{sorted.length === 1 ? 'a' : 'e'}
          </p>
        </div>
        <ChevronDown className={`h-5 w-5 text-muted-foreground shrink-0 transition-transform duration-200 ${sectionOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Content */}
      {sectionOpen && (
        <div className="px-3 pb-3 space-y-4">
          {loading && sorted.length === 0 && (
            <p className="text-center text-xs text-muted-foreground py-4">Caricamento...</p>
          )}

          {grouped.map(([monthKey, days]) => (
            <div key={monthKey}>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-2">
                {formatMonthYear(days[0].date)}
              </p>
              <div className="space-y-2">
                {days.map(s => (
                  <DayRow
                    key={s.date}
                    summary={s}
                    expanded={expandedDate === s.date}
                    onToggle={() => setExpandedDate(prev => prev === s.date ? null : s.date)}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Load more */}
          {canLoadMore && !loading && (
            <button
              onClick={() => setDaysLoaded(prev => Math.min(prev + LOAD_MORE_DAYS, MAX_DAYS))}
              className="w-full py-2.5 text-xs font-medium text-primary hover:underline"
            >
              Carica giornate precedenti
            </button>
          )}

          {loading && sorted.length > 0 && (
            <p className="text-center text-xs text-muted-foreground py-2">Caricamento...</p>
          )}
        </div>
      )}
    </div>
  );
}
