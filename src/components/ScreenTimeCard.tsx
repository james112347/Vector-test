import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Smartphone } from 'lucide-react';
import { useScreenTime } from '../lib/useScreenTime';
import { formatMinutes } from '../lib/screen-time';

// ---------------------------------------------------------------------------
// Mini bar chart settimanale
// ---------------------------------------------------------------------------

function WeekBars({ data }: { data: Array<{ day: string; minutes: number }> }) {
  const max = Math.max(...data.map(d => d.minutes), 30);
  return (
    <div className="flex items-end gap-1 h-14">
      {data.map((d, i) => {
        const h = d.minutes > 0 ? Math.max(6, (d.minutes / max) * 100) : 0;
        const isToday = i === data.length - 1;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
            <div
              className="w-full rounded-t-sm transition-all"
              style={{
                height: `${h}%`,
                backgroundColor: isToday ? '#3b82f6' : '#94a3b8',
                opacity: isToday ? 1 : 0.35,
                minHeight: d.minutes > 0 ? 4 : 0,
              }}
            />
            <span className="text-[8px] text-muted-foreground leading-none">{d.day}</span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente principale
// ---------------------------------------------------------------------------

export default function ScreenTimeCard({ userId }: { userId: number }) {
  const { today, weekData } = useScreenTime(userId);

  const dayNames = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
  const chartData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().slice(0, 10);
    const log = weekData.find(l => l.date === dateStr);
    return {
      day: dayNames[d.getDay()],
      minutes: log?.minutes ?? 0,
    };
  });

  const weekTotal = chartData.reduce((s, d) => s + d.minutes, 0);
  const weekAvg = weekData.length > 0 ? Math.round(weekTotal / Math.max(1, weekData.filter(w => w.minutes > 0).length)) : 0;

  return (
    <Card>
      <CardHeader className="pb-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-blue-500" />
            <CardTitle className="text-base">Tempo su Vector</CardTitle>
          </div>
          <span className="text-lg font-bold tabular-nums text-blue-600 dark:text-blue-400">
            {today ? formatMinutes(today.minutes) : '--'}
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        {/* Stats inline */}
        <div className="flex items-center gap-3 flex-wrap">
          {today && today.sessions > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
              {today.sessions} {today.sessions === 1 ? 'sessione' : 'sessioni'}
            </span>
          )}
          {today && today.longestSession > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground">
              max {formatMinutes(today.longestSession)}
            </span>
          )}
          {weekAvg > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground">
              media {formatMinutes(weekAvg)}/g
            </span>
          )}
        </div>

        {/* Mini chart settimanale */}
        <WeekBars data={chartData} />
      </CardContent>
    </Card>
  );
}
