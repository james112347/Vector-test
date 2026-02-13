import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useAuthState } from '../contexts/AuthContext';
import {
  analyzePatterns,
  analyzeTrends,
  findCorrelations,
  generatePredictions,
  generateWeeklyReport,
} from '../lib/ml-engine';
import type {
  DetectedPattern,
  TrendAnalysis,
  Correlation,
  Prediction,
  WeeklyReport,
} from '../lib/ml-engine';
import {
  Brain,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  AlertTriangle,
  Target,
  BarChart3,
  RefreshCw,
  Calendar,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TREND_ICON = {
  improving: TrendingUp,
  stable: Minus,
  declining: TrendingDown,
} as const;

const TREND_COLOR = {
  improving: 'text-green-600 dark:text-green-400',
  stable: 'text-gray-500',
  declining: 'text-red-600 dark:text-red-400',
} as const;

const TREND_BG = {
  improving: 'bg-green-500/10',
  stable: 'bg-gray-500/10',
  declining: 'bg-red-500/10',
} as const;

const TREND_LABEL_IT = {
  improving: 'miglioramento',
  stable: 'stabile',
  declining: 'riduzione',
} as const;

const CONF_LEVEL = (c: number): string =>
  c >= 0.7 ? 'Alta' : c >= 0.4 ? 'Media' : 'Bassa';

const CONF_STYLE = (c: number): string =>
  c >= 0.7
    ? 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20'
    : c >= 0.4
      ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
      : 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20';

const GRADE_COLOR: Record<string, string> = {
  A: 'text-green-600 dark:text-green-400 bg-green-500/10',
  B: 'text-blue-600 dark:text-blue-400 bg-blue-500/10',
  C: 'text-amber-600 dark:text-amber-400 bg-amber-500/10',
  D: 'text-orange-600 dark:text-orange-400 bg-orange-500/10',
  F: 'text-red-600 dark:text-red-400 bg-red-500/10',
};

// ---------------------------------------------------------------------------
// Skeleton & empty states
// ---------------------------------------------------------------------------

function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-4 w-4 rounded bg-muted" />
          <div className="h-3 rounded bg-muted flex-1" style={{ maxWidth: `${60 + i * 15}%` }} />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ section }: { section: string }) {
  return (
    <div className="flex flex-col items-center py-6 text-center">
      <Activity className="h-8 w-8 text-muted-foreground/40 mb-2" />
      <p className="text-sm text-muted-foreground">
        Dati insufficienti per {section}
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        Registra almeno 7 giorni di dati per vedere l'analisi.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trend Row
// ---------------------------------------------------------------------------

function TrendRow({ label, trend }: { label: string; trend: 'improving' | 'stable' | 'declining' }) {
  const Icon = TREND_ICON[trend];
  const color = TREND_COLOR[trend];
  const bg = TREND_BG[trend];
  return (
    <div className="flex items-center gap-3">
      <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${bg} shrink-0`}>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <p className="text-sm font-medium flex-1">{label}</p>
      <span className={`text-sm font-semibold ${color}`}>
        {TREND_LABEL_IT[trend]}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function Insights() {
  const { user } = useAuthState();

  const [trends, setTrends] = useState<TrendAnalysis | null>(null);
  const [patterns, setPatterns] = useState<DetectedPattern[] | null>(null);
  const [correlations, setCorrelations] = useState<Correlation[] | null>(null);
  const [predictions, setPredictions] = useState<Prediction[] | null>(null);
  const [report, setReport] = useState<WeeklyReport | null>(null);

  const [trendsLoading, setTrendsLoading] = useState(true);
  const [patternsLoading, setPatternsLoading] = useState(true);
  const [corrLoading, setCorrLoading] = useState(true);
  const [predLoading, setPredLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadAll = useCallback(async () => {
    const uid = user?.id;
    if (!uid) return;

    const doTrends = async () => {
      setTrendsLoading(true);
      try { setTrends(await analyzeTrends(uid, '7d')); } catch { setTrends(null); }
      finally { setTrendsLoading(false); }
    };
    const doPatterns = async () => {
      setPatternsLoading(true);
      try { setPatterns(await analyzePatterns(uid)); } catch { setPatterns(null); }
      finally { setPatternsLoading(false); }
    };
    const doCorr = async () => {
      setCorrLoading(true);
      try { setCorrelations(await findCorrelations(uid)); } catch { setCorrelations(null); }
      finally { setCorrLoading(false); }
    };
    const doPred = async () => {
      setPredLoading(true);
      try { setPredictions(await generatePredictions(uid)); } catch { setPredictions(null); }
      finally { setPredLoading(false); }
    };
    const doReport = async () => {
      setReportLoading(true);
      try { setReport(await generateWeeklyReport(uid)); } catch { setReport(null); }
      finally { setReportLoading(false); }
    };

    await Promise.all([doTrends(), doPatterns(), doCorr(), doPred(), doReport()]);
  }, [user?.id]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  const anyLoading = trendsLoading || patternsLoading || corrLoading || predLoading || reportLoading;

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold">Intelligence</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Analisi dei tuoi dati</p>
        </div>
        <Button size="sm" variant="ghost" onClick={handleRefresh} disabled={refreshing || anyLoading} className="h-8 w-8 p-0">
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* ----- TREND 7 GIORNI ----- */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Trend 7 giorni</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {trendsLoading ? <Skeleton lines={5} /> : !trends ? (
            <EmptyState section="i trend" />
          ) : (
            <div className="space-y-2.5">
              <TrendRow label="Energia" trend={trends.energyTrend} />
              <TrendRow label="Sonno" trend={trends.sleepTrend} />
              <TrendRow label="Stress" trend={trends.stressTrend} />
              <TrendRow label="Umore" trend={trends.moodTrend} />
              <TrendRow label="Idratazione" trend={trends.hydrationTrend} />
              {trends.highlights.length > 0 && (
                <div className="mt-3 space-y-1.5 border-t border-border pt-3">
                  {trends.highlights.map((h, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className={`mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                        h.sentiment === 'positive' ? 'bg-green-500' : h.sentiment === 'negative' ? 'bg-red-500' : 'bg-gray-400'
                      }`} />
                      <div>
                        <p className="text-xs font-medium">{h.metric}: {h.change}</p>
                        <p className="text-[10px] text-muted-foreground">{h.insight}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ----- PATTERN RILEVATI ----- */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Pattern rilevati</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {patternsLoading ? <Skeleton lines={2} /> : !patterns || patterns.length === 0 ? (
            <EmptyState section="i pattern" />
          ) : (
            <div className="space-y-3">
              {patterns.map((p, i) => (
                <div key={i} className="rounded-lg border border-border p-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${CONF_STYLE(p.confidence)}`}>
                      {CONF_LEVEL(p.confidence)}
                    </span>
                    <span className="text-[10px] text-muted-foreground capitalize">{p.type.replace(/_/g, ' ')}</span>
                  </div>
                  <p className="text-sm">{p.description}</p>
                  {p.recommendation && (
                    <p className="text-xs text-primary font-medium">{p.recommendation}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ----- CORRELAZIONI ----- */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Correlazioni</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {corrLoading ? <Skeleton lines={3} /> : !correlations || correlations.length === 0 ? (
            <EmptyState section="le correlazioni" />
          ) : (
            <div className="space-y-3">
              {correlations.map((c, i) => {
                const positive = c.direction === 'positive';
                const barW = Math.round(Math.abs(c.strength) * 100);
                const barColor = positive ? 'bg-green-500' : 'bg-red-500';
                const textColor = positive ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400';
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm">{c.factorA} → {c.factorB}</p>
                      <span className={`text-sm font-mono font-semibold ${textColor}`}>
                        {c.strength > 0 ? '+' : ''}{c.strength.toFixed(2)}
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full ${barColor}`} style={{ width: `${barW}%` }} />
                    </div>
                    <p className="text-[10px] text-muted-foreground">{c.explanation}</p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ----- PREVISIONI ----- */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Previsioni</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {predLoading ? <Skeleton lines={2} /> : !predictions || predictions.length === 0 ? (
            <EmptyState section="le previsioni" />
          ) : (
            <div className="space-y-3">
              {predictions.map((p, i) => {
                const isWarn = p.type === 'crash_warning';
                const border = isWarn ? 'border-amber-500/30 bg-amber-500/5' : 'border-border';
                const Icon = isWarn ? AlertTriangle : Target;
                const iconColor = isWarn ? 'text-amber-600 dark:text-amber-400' : 'text-primary';
                return (
                  <div key={i} className={`rounded-lg border p-3 ${border}`}>
                    <div className="flex items-start gap-2">
                      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${iconColor}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{p.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{p.body}</p>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="text-[10px] text-muted-foreground">{p.timeHorizon}</span>
                          <span className={`text-[10px] font-medium ${
                            p.urgency === 'high' ? 'text-red-500' : p.urgency === 'medium' ? 'text-amber-500' : 'text-gray-400'
                          }`}>
                            {p.urgency === 'high' ? 'urgente' : p.urgency === 'medium' ? 'attenzione' : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ----- REPORT SETTIMANALE ----- */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Report settimanale</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {reportLoading ? <Skeleton lines={4} /> : !report ? (
            <EmptyState section="il report settimanale" />
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className={`flex items-center justify-center w-16 h-16 rounded-xl ${GRADE_COLOR[report.overallGrade] ?? GRADE_COLOR.C}`}>
                  <span className="text-3xl font-bold">{report.overallGrade}</span>
                </div>
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Miglior giorno</span>
                    <span className="text-sm font-medium">
                      {report.bestDay.day}
                      <span className="text-xs text-muted-foreground ml-1">({report.bestDay.score})</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Peggior giorno</span>
                    <span className="text-sm font-medium">
                      {report.worstDay.day}
                      <span className="text-xs text-muted-foreground ml-1">({report.worstDay.score})</span>
                    </span>
                  </div>
                </div>
              </div>

              {report.topInsight && (
                <p className="text-sm text-muted-foreground">{report.topInsight}</p>
              )}

              {report.actionItems.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Da fare questa settimana
                  </p>
                  <ol className="space-y-1.5">
                    {report.actionItems.map((item: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <p className="text-sm">{item}</p>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-[10px] text-center text-muted-foreground px-4">
        L'analisi si basa sui dati degli ultimi 7-30 giorni. Piu dati registri, piu accurate saranno le previsioni.
      </p>
    </div>
  );
}
