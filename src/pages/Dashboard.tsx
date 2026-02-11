import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useAuthState } from '../contexts/AuthContext';
import { getTodayLog, getRecentLogs } from '../lib/energy';
import type { EnergyLog } from '../db/schema';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

function EnergyRing({ value, label, color }: { value: number; label: string; color: string }) {
  const percentage = value * 10;
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative w-20 h-20">
        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r={radius} fill="none" stroke="currentColor" className="text-muted" strokeWidth="6" />
          <circle
            cx="40" cy="40" r={radius} fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-500"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-lg font-bold">{value}</span>
      </div>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuthState();
  const navigate = useNavigate();
  const [todayLog, setTodayLog] = useState<EnergyLog | null>(null);
  const [weekLogs, setWeekLogs] = useState<EnergyLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    Promise.all([
      getTodayLog(user.id),
      getRecentLogs(user.id, 7),
    ]).then(([today, week]) => {
      setTodayLog(today || null);
      setWeekLogs(week);
      setLoading(false);
    });
  }, [user?.id]);

  const chartData = weekLogs.map(log => {
    const [, , d] = log.date.split('-');
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
    const [y, m, day] = log.date.split('-').map(Number);
    const dateObj = new Date(y, m - 1, day);
    return {
      name: dayNames[dateObj.getDay()] + ' ' + d,
      Fisica: log.physical,
      Mentale: log.mental,
      Emotiva: log.emotional,
    };
  });

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground text-sm">Caricamento...</p>
      </div>
    );
  }

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buongiorno';
    if (hour < 18) return 'Buon pomeriggio';
    return 'Buonasera';
  };

  return (
    <div className="space-y-4 pb-24">
      <div>
        <h1 className="text-2xl font-bold">{greeting()}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          La tua dashboard energetica
        </p>
      </div>

      {/* Today's Energy */}
      {todayLog ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Energia di oggi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-around py-2">
              <EnergyRing value={todayLog.physical} label="Fisica" color="#3b82f6" />
              <EnergyRing value={todayLog.mental} label="Mentale" color="#22c55e" />
              <EnergyRing value={todayLog.emotional} label="Emotiva" color="#f59e0b" />
            </div>
            {todayLog.notes && (
              <p className="text-xs text-muted-foreground mt-3 text-center italic">
                "{todayLog.notes}"
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center space-y-3">
            <p className="text-muted-foreground text-sm">
              Non hai ancora registrato l'energia di oggi
            </p>
            <Button size="sm" onClick={() => navigate('/log')}>
              Registra ora
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Weekly Chart */}
      {chartData.length >= 2 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Ultimi 7 giorni</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    domain={[0, 10]}
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={25}
                  />
                  <Tooltip
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      backgroundColor: 'var(--card)',
                    }}
                  />
                  <Line type="monotone" dataKey="Fisica" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="Mentale" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="Emotiva" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 mt-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                <span className="text-xs text-muted-foreground">Fisica</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
                <span className="text-xs text-muted-foreground">Mentale</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <span className="text-xs text-muted-foreground">Emotiva</span>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Trend settimanale</CardTitle>
          </CardHeader>
          <CardContent className="py-6 text-center">
            <p className="text-sm text-muted-foreground">
              {chartData.length === 0
                ? 'Registra la tua energia per vedere il grafico'
                : 'Servono almeno 2 giorni per il grafico'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      {weekLogs.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-xs text-muted-foreground">Fisica</p>
              <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                {(weekLogs.reduce((s, l) => s + l.physical, 0) / weekLogs.length).toFixed(1)}
              </p>
              <p className="text-xs text-muted-foreground">media</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-xs text-muted-foreground">Mentale</p>
              <p className="text-lg font-bold text-green-600 dark:text-green-400">
                {(weekLogs.reduce((s, l) => s + l.mental, 0) / weekLogs.length).toFixed(1)}
              </p>
              <p className="text-xs text-muted-foreground">media</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-xs text-muted-foreground">Emotiva</p>
              <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
                {(weekLogs.reduce((s, l) => s + l.emotional, 0) / weekLogs.length).toFixed(1)}
              </p>
              <p className="text-xs text-muted-foreground">media</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
