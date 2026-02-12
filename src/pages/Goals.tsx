import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useAuthState } from '../contexts/AuthContext';
import {
  getAllGoals,
  createGoal,
  deleteGoal,
  completeGoal,
  pauseGoal,
  resumeGoal,
  logGoalProgress,
  getGoalStats,
  getGoalEnergyBudget,
  getOptimalGoalSchedule,
  generateGoalSetupAdvice,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  TIMEFRAME_LABELS,
  STATUS_LABELS,
  GOAL_TEMPLATES,
  type CreateGoalInput,
  type GoalStats,
  type EnergyBudget,
  type GoalSetupAdvice,
  type GoalScheduleSlot,
} from '../lib/goals';
import type { Goal, GoalCategory, GoalTimeframe } from '../db/schema';
import { CHRONOTYPE_LABELS, type Chronotype } from '../lib/energy-engine';
import {
  Target,
  Plus,
  Check,
  Pause,
  Play,
  Trash2,
  Flame,
  Trophy,
  ChevronDown,
  ChevronUp,
  Sparkles,
  BookOpen,
  Battery,
  Clock,
  AlertTriangle,
  Calendar,
  Brain,
  Zap,
  Loader2,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Energy Budget Card
// ---------------------------------------------------------------------------

function EnergyBudgetCard({ budget }: { budget: EnergyBudget }) {
  const usedPct = budget.dailyCapacity > 0
    ? Math.round((budget.allocatedToGoals / (budget.dailyCapacity * 0.6)) * 100)
    : 0;
  const barColor = budget.overloaded ? '#ef4444' : usedPct > 70 ? '#f59e0b' : '#22c55e';

  return (
    <Card>
      <CardContent className="py-3 space-y-2">
        <div className="flex items-center gap-2">
          <Battery className="h-4 w-4 text-primary" />
          <p className="text-xs font-semibold">Budget energetico giornaliero</p>
        </div>
        <div className="flex items-center gap-3 text-[10px]">
          <div className="flex-1">
            <div className="flex justify-between mb-1">
              <span className="text-muted-foreground">
                Allocato: {budget.allocatedToGoals} / {Math.round(budget.dailyCapacity * 0.6)} disponibile
              </span>
              <span className="font-bold" style={{ color: barColor }}>{usedPct}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5">
              <div
                className="h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, usedPct)}%`, backgroundColor: barColor }}
              />
            </div>
          </div>
        </div>
        {budget.overloaded && (
          <div className="flex items-center gap-1.5 text-[10px] text-red-500">
            <AlertTriangle className="h-3 w-3" />
            Troppi obiettivi attivi. Rischio sovraccarico.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Schedule Card
// ---------------------------------------------------------------------------

function ScheduleCard({ schedule, chronotype, peakWindows }: {
  schedule: GoalScheduleSlot[];
  chronotype: Chronotype;
  peakWindows: { peakCognitive: string; peakPhysical: string; recovery: string; creative: string };
}) {
  if (schedule.length === 0) return null;
  const chrono = CHRONOTYPE_LABELS[chronotype];

  return (
    <Card>
      <CardContent className="py-3 space-y-2">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          <p className="text-xs font-semibold">Programma ottimale ({chrono.name})</p>
        </div>
        <div className="space-y-1.5">
          {schedule.map(slot => (
            <div key={slot.goalId} className="flex items-center gap-2 text-[10px]">
              <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="font-mono font-medium w-20 shrink-0">{slot.suggestedTime}</span>
              <span className="truncate flex-1">{slot.wish}</span>
              <span
                className="text-[9px] px-1 py-0.5 rounded shrink-0"
                style={{
                  backgroundColor: CATEGORY_COLORS[slot.category] + '20',
                  color: CATEGORY_COLORS[slot.category],
                }}
              >
                {slot.reason}
              </span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1 pt-1 border-t border-border">
          <div className="text-[9px] text-muted-foreground">
            <Brain className="h-2.5 w-2.5 inline mr-0.5" />Cognitivo: {peakWindows.peakCognitive}
          </div>
          <div className="text-[9px] text-muted-foreground">
            <Zap className="h-2.5 w-2.5 inline mr-0.5" />Fisico: {peakWindows.peakPhysical}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Stats Bar
// ---------------------------------------------------------------------------

function StatsBar({ stats }: { stats: GoalStats }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      <div className="rounded-lg bg-primary/10 p-2 text-center">
        <p className="text-lg font-bold text-primary">{stats.activeGoals}</p>
        <p className="text-[10px] text-muted-foreground">Attivi</p>
      </div>
      <div className="rounded-lg bg-green-500/10 p-2 text-center">
        <p className="text-lg font-bold text-green-600 dark:text-green-400">{stats.completedGoals}</p>
        <p className="text-[10px] text-muted-foreground">Completati</p>
      </div>
      <div className="rounded-lg bg-orange-500/10 p-2 text-center">
        <p className="text-lg font-bold text-orange-600 dark:text-orange-400">{stats.currentStreak}</p>
        <p className="text-[10px] text-muted-foreground">Streak</p>
      </div>
      <div className="rounded-lg bg-violet-500/10 p-2 text-center">
        <p className="text-lg font-bold text-violet-600 dark:text-violet-400">
          {Math.round(stats.completionRate * 100)}%
        </p>
        <p className="text-[10px] text-muted-foreground">Successo</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Goal Card
// ---------------------------------------------------------------------------

function GoalCard({
  goal,
  onComplete,
  onPause,
  onResume,
  onDelete,
  onLogProgress,
}: {
  goal: Goal;
  onComplete: () => void;
  onPause: () => void;
  onResume: () => void;
  onDelete: () => void;
  onLogProgress: (value: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [progressInput, setProgressInput] = useState('');
  const color = CATEGORY_COLORS[goal.category];
  const isActive = goal.status === 'active';

  const progressPct = goal.targetValue
    ? Math.min(100, Math.round((goal.currentProgress / goal.targetValue) * 100))
    : goal.currentProgress > 0 ? 100 : 0;

  return (
    <div className={`rounded-xl border p-3 transition-all ${
      goal.status === 'completed' ? 'opacity-60 border-green-500/30' :
      goal.status === 'paused' ? 'opacity-70 border-amber-500/30' :
      'border-border'
    }`}>
      {/* Header */}
      <div className="flex items-start gap-2">
        <span
          className="mt-0.5 w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{
              backgroundColor: color + '20',
              color,
            }}>
              {CATEGORY_LABELS[goal.category]}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {TIMEFRAME_LABELS[goal.timeframe]}
            </span>
            <span className="text-[10px] text-muted-foreground ml-auto">
              {STATUS_LABELS[goal.status]}
            </span>
          </div>
          <p className="text-sm font-medium">{goal.wish}</p>

          {/* Progress bar */}
          {goal.targetValue != null && isActive && (
            <div className="mt-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-muted-foreground">
                  {goal.currentProgress}/{goal.targetValue} {goal.targetUnit || ''}
                </span>
                <span className="text-[10px] font-bold" style={{ color }}>
                  {progressPct}%
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%`, backgroundColor: color }}
                />
              </div>
            </div>
          )}

          {/* Streak */}
          {goal.streak > 0 && (
            <div className="flex items-center gap-1 mt-1.5">
              <Flame className="h-3.5 w-3.5 text-orange-500" />
              <span className="text-xs text-orange-600 dark:text-orange-400 font-semibold">
                {goal.streak} giorni di fila
              </span>
              {goal.bestStreak > goal.streak && (
                <span className="text-[10px] text-muted-foreground ml-1">
                  (record: {goal.bestStreak})
                </span>
              )}
            </div>
          )}
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 hover:bg-muted rounded"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* Expanded details (WOOP) */}
      {expanded && (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Risultato desiderato</p>
            <p className="text-xs mt-0.5">{goal.outcome}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Ostacolo interno</p>
            <p className="text-xs mt-0.5">{goal.obstacle}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide">
              Se... allora... (piano)
            </p>
            <p className="text-xs mt-0.5 italic">{goal.plan}</p>
          </div>
          {goal.aiAdvice && (
            <div className="rounded-lg bg-primary/5 border border-primary/10 p-2">
              <p className="text-[10px] font-semibold text-primary flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Consiglio IA
              </p>
              <p className="text-xs mt-0.5">{goal.aiAdvice}</p>
            </div>
          )}
          {goal.notes && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Note</p>
              <p className="text-xs mt-0.5">{goal.notes}</p>
            </div>
          )}

          {/* Log progress */}
          {isActive && goal.targetValue != null && (
            <div className="flex gap-2 pt-1">
              <Input
                type="number"
                placeholder="Valore"
                value={progressInput}
                onChange={e => setProgressInput(e.target.value)}
                className="h-8 text-sm flex-1"
              />
              <Button
                size="sm"
                className="h-8 text-xs"
                disabled={!progressInput}
                onClick={() => {
                  const val = parseFloat(progressInput);
                  if (!isNaN(val)) {
                    onLogProgress(val);
                    setProgressInput('');
                  }
                }}
              >
                Registra
              </Button>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            {isActive && (
              <>
                <Button size="sm" variant="default" className="h-7 text-xs flex-1" onClick={onComplete}>
                  <Check className="h-3 w-3 mr-1" /> Completato
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onPause}>
                  <Pause className="h-3 w-3" />
                </Button>
              </>
            )}
            {goal.status === 'paused' && (
              <Button size="sm" variant="default" className="h-7 text-xs flex-1" onClick={onResume}>
                <Play className="h-3 w-3 mr-1" /> Riprendi
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-7 text-xs text-red-500" onClick={onDelete}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AI Advice Panel
// ---------------------------------------------------------------------------

function AIAdvicePanel({ advice, onApplyPlan }: {
  advice: GoalSetupAdvice;
  onApplyPlan: (plan: string) => void;
}) {
  return (
    <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 space-y-2">
      <p className="text-xs font-semibold text-primary flex items-center gap-1">
        <Sparkles className="h-3.5 w-3.5" /> Analisi IA del tuo obiettivo
      </p>

      {advice.optimalTimeOfDay && (
        <div className="flex items-start gap-2">
          <Clock className="h-3 w-3 text-indigo-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-[10px] font-medium">Momento migliore</p>
            <p className="text-[10px] text-muted-foreground">{advice.optimalTimeOfDay}</p>
          </div>
        </div>
      )}

      {advice.estimatedEnergyCost && (
        <div className="flex items-start gap-2">
          <Battery className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-[10px] font-medium">
              Costo energetico: <span className={
                advice.estimatedEnergyCost === 'alto' ? 'text-red-500' :
                advice.estimatedEnergyCost === 'medio' ? 'text-amber-500' : 'text-green-500'
              }>{advice.estimatedEnergyCost}</span>
            </p>
          </div>
        </div>
      )}

      {advice.suggestedTarget != null && (
        <div className="flex items-start gap-2">
          <Target className="h-3 w-3 text-green-500 mt-0.5 shrink-0" />
          <p className="text-[10px]">
            Target suggerito: <span className="font-bold">{advice.suggestedTarget}</span>
            {advice.suggestedUnit && ` ${advice.suggestedUnit}`}
          </p>
        </div>
      )}

      {advice.conflicts.length > 0 && (
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-3 w-3 text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-[10px] font-medium text-red-600 dark:text-red-400">Conflitti rilevati</p>
            {advice.conflicts.map((c, i) => (
              <p key={i} className="text-[10px] text-muted-foreground">- {c}</p>
            ))}
          </div>
        </div>
      )}

      {advice.implementationTips.length > 0 && (
        <div>
          <p className="text-[10px] font-medium mb-0.5">Consigli specifici</p>
          {advice.implementationTips.map((tip, i) => (
            <p key={i} className="text-[10px] text-muted-foreground">- {tip}</p>
          ))}
        </div>
      )}

      {advice.improvedPlan && (
        <div className="rounded-md bg-background border border-primary/20 p-2">
          <p className="text-[10px] font-medium text-primary">Piano migliorato dall'IA:</p>
          <p className="text-[10px] italic mt-0.5">{advice.improvedPlan}</p>
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-[10px] mt-1"
            onClick={() => onApplyPlan(advice.improvedPlan)}
          >
            Usa questo piano
          </Button>
        </div>
      )}

      {advice.expectedTimeline && (
        <p className="text-[10px] text-muted-foreground">
          Timeline: {advice.expectedTimeline}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create Goal Form (with AI wizard)
// ---------------------------------------------------------------------------

function CreateGoalForm({
  userId,
  onSubmit,
  onCancel,
}: {
  userId: number;
  onSubmit: (input: CreateGoalInput) => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<'template' | 'custom'>('template');
  const [wish, setWish] = useState('');
  const [outcome, setOutcome] = useState('');
  const [obstacle, setObstacle] = useState('');
  const [plan, setPlan] = useState('');
  const [category, setCategory] = useState<GoalCategory>('energy');
  const [timeframe, setTimeframe] = useState<GoalTimeframe>('daily');
  const [targetValue, setTargetValue] = useState('');
  const [targetUnit, setTargetUnit] = useState('');

  // AI advice
  const [aiAdvice, setAiAdvice] = useState<GoalSetupAdvice | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const handleTemplateSelect = (t: typeof GOAL_TEMPLATES[0]) => {
    setWish(t.wish);
    setOutcome(t.outcome);
    setObstacle(t.obstacle);
    setPlan(t.plan);
    setCategory(t.category);
    setTimeframe(t.timeframe);
    if (t.targetValue) setTargetValue(String(t.targetValue));
    if (t.targetUnit) setTargetUnit(t.targetUnit);
    setMode('custom');
  };

  // Trigger AI analysis when wish + category are filled
  const requestAIAdvice = async () => {
    if (!wish.trim()) return;
    setAiLoading(true);
    try {
      const advice = await generateGoalSetupAdvice(userId, {
        wish, outcome, obstacle, plan, category, timeframe,
      });
      setAiAdvice(advice);
    } catch {
      // AI not available, silently ignore
    } finally {
      setAiLoading(false);
    }
  };

  const canSubmit = wish.trim() && outcome.trim() && obstacle.trim() && plan.trim();

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({
      wish: wish.trim(),
      outcome: outcome.trim(),
      obstacle: obstacle.trim(),
      plan: plan.trim(),
      category,
      timeframe,
      targetValue: targetValue ? parseFloat(targetValue) : null,
      targetUnit: targetUnit || null,
      linkedCheckinType: aiAdvice?.linkedCheckinSuggestion ?? null,
    });
  };

  if (mode === 'template') {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Scegli un obiettivo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {GOAL_TEMPLATES.map((t, i) => (
            <button
              key={i}
              onClick={() => handleTemplateSelect(t)}
              className="w-full text-left rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{
                  backgroundColor: CATEGORY_COLORS[t.category] + '20',
                  color: CATEGORY_COLORS[t.category],
                }}>
                  {CATEGORY_LABELS[t.category]}
                </span>
              </div>
              <p className="text-sm font-medium">{t.wish}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t.outcome}</p>
            </button>
          ))}

          <div className="pt-2 flex gap-2">
            <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => setMode('custom')}>
              Crea personalizzato
            </Button>
            <Button size="sm" variant="ghost" className="text-xs" onClick={onCancel}>
              Annulla
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-4 w-4" />
          Nuovo obiettivo (WOOP)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Il metodo WOOP: Desiderio, Risultato, Ostacolo, Piano. Scientificamente provato (ES: 0.28-0.47).
        </p>

        <div>
          <Label className="text-xs font-semibold">W — Desiderio (Wish)</Label>
          <Input
            value={wish}
            onChange={e => setWish(e.target.value)}
            placeholder="Cosa vuoi ottenere?"
            className="mt-1 h-9 text-sm"
          />
        </div>

        {/* Category & Timeframe */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Categoria</Label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value as GoalCategory)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm h-9"
            >
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs">Frequenza</Label>
            <select
              value={timeframe}
              onChange={e => setTimeframe(e.target.value as GoalTimeframe)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm h-9"
            >
              {Object.entries(TIMEFRAME_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>

        {/* AI Analysis button */}
        {wish.trim() && (
          <Button
            size="sm"
            variant="outline"
            className="w-full text-xs h-8"
            onClick={requestAIAdvice}
            disabled={aiLoading}
          >
            {aiLoading ? (
              <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Analisi IA in corso...</>
            ) : (
              <><Sparkles className="h-3 w-3 mr-1" /> Chiedi consiglio all'IA</>
            )}
          </Button>
        )}

        {/* AI Advice */}
        {aiAdvice && (
          <AIAdvicePanel
            advice={aiAdvice}
            onApplyPlan={(p) => setPlan(p)}
          />
        )}

        <div>
          <Label className="text-xs font-semibold">O — Risultato (Outcome)</Label>
          <textarea
            value={outcome}
            onChange={e => setOutcome(e.target.value)}
            placeholder="Qual e' il miglior risultato possibile?"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none h-16"
          />
        </div>

        <div>
          <Label className="text-xs font-semibold">O — Ostacolo (Obstacle)</Label>
          <textarea
            value={obstacle}
            onChange={e => setObstacle(e.target.value)}
            placeholder="Qual e' il tuo ostacolo interno principale?"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none h-16"
          />
        </div>

        <div>
          <Label className="text-xs font-semibold text-red-600 dark:text-red-400">P — Piano (If-Then)</Label>
          <textarea
            value={plan}
            onChange={e => setPlan(e.target.value)}
            placeholder="Se [situazione], allora [azione]..."
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none h-16"
          />
        </div>

        {/* Target */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Target (opzionale)</Label>
            <Input
              type="number"
              value={targetValue}
              onChange={e => setTargetValue(e.target.value)}
              placeholder={aiAdvice?.suggestedTarget != null ? String(aiAdvice.suggestedTarget) : 'es. 8'}
              className="mt-1 h-9 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">Unita</Label>
            <Input
              value={targetUnit}
              onChange={e => setTargetUnit(e.target.value)}
              placeholder={aiAdvice?.suggestedUnit ?? 'es. bicchieri'}
              className="mt-1 h-9 text-sm"
            />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            size="sm"
            className="flex-1 text-xs"
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Crea obiettivo
          </Button>
          <Button size="sm" variant="ghost" className="text-xs" onClick={onCancel}>
            Annulla
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function Goals() {
  const { user } = useAuthState();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [stats, setStats] = useState<GoalStats | null>(null);
  const [budget, setBudget] = useState<EnergyBudget | null>(null);
  const [schedule, setSchedule] = useState<{ schedule: GoalScheduleSlot[]; chronotype: Chronotype; peakWindows: ReturnType<typeof import('../lib/energy-engine').getOptimalWindows> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('active');

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [allGoals, goalStats, energyBudget, goalSchedule] = await Promise.all([
        getAllGoals(user.id),
        getGoalStats(user.id),
        getGoalEnergyBudget(user.id).catch(() => null),
        getOptimalGoalSchedule(user.id).catch(() => null),
      ]);
      setGoals(allGoals);
      setStats(goalStats);
      setBudget(energyBudget);
      setSchedule(goalSchedule);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreate = async (input: CreateGoalInput) => {
    if (!user?.id) return;
    await createGoal(user.id, input);
    setShowCreate(false);
    loadData();
  };

  const handleComplete = async (goalId: number) => {
    await completeGoal(goalId);
    loadData();
  };

  const handlePause = async (goalId: number) => {
    await pauseGoal(goalId);
    loadData();
  };

  const handleResume = async (goalId: number) => {
    await resumeGoal(goalId);
    loadData();
  };

  const handleDelete = async (goalId: number) => {
    await deleteGoal(goalId);
    loadData();
  };

  const handleLogProgress = async (goalId: number, value: number) => {
    if (!user?.id) return;
    await logGoalProgress(user.id, goalId, value);
    loadData();
  };

  const filteredGoals = goals.filter(g => {
    if (filter === 'active') return g.status === 'active' || g.status === 'paused';
    if (filter === 'completed') return g.status === 'completed';
    return true;
  });

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-muted-foreground text-sm mt-2">Caricamento...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">Obiettivi</h1>
        </div>
        {!showCreate && (
          <Button size="sm" onClick={() => setShowCreate(true)} className="h-8">
            <Plus className="h-4 w-4 mr-1" />
            Nuovo
          </Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground -mt-2">
        WOOP + IA: obiettivi intelligenti calibrati sulla tua energia
      </p>

      {/* Energy budget */}
      {budget && budget.goalAllocations.length > 0 && <EnergyBudgetCard budget={budget} />}

      {/* Optimal schedule */}
      {schedule && schedule.schedule.length > 0 && (
        <ScheduleCard
          schedule={schedule.schedule}
          chronotype={schedule.chronotype}
          peakWindows={schedule.peakWindows}
        />
      )}

      {/* Stats */}
      {stats && stats.totalGoals > 0 && <StatsBar stats={stats} />}

      {/* Create form */}
      {showCreate && user?.id && (
        <CreateGoalForm
          userId={user.id}
          onSubmit={handleCreate}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {/* Filter tabs */}
      {goals.length > 0 && (
        <div className="flex gap-1 rounded-lg bg-muted p-0.5">
          {(['active', 'completed', 'all'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === f
                  ? 'bg-background shadow text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {f === 'active' ? 'Attivi' : f === 'completed' ? 'Completati' : 'Tutti'}
            </button>
          ))}
        </div>
      )}

      {/* Goals list */}
      {filteredGoals.length > 0 ? (
        <div className="space-y-3">
          {filteredGoals.map(goal => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onComplete={() => handleComplete(goal.id!)}
              onPause={() => handlePause(goal.id!)}
              onResume={() => handleResume(goal.id!)}
              onDelete={() => handleDelete(goal.id!)}
              onLogProgress={(v) => handleLogProgress(goal.id!, v)}
            />
          ))}
        </div>
      ) : (
        !showCreate && (
          <Card>
            <CardContent className="py-8 text-center space-y-3">
              <Trophy className="h-10 w-10 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {filter === 'completed'
                  ? 'Nessun obiettivo completato ancora'
                  : 'Nessun obiettivo attivo'}
              </p>
              <Button size="sm" variant="outline" onClick={() => setShowCreate(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Crea il tuo primo obiettivo
              </Button>
            </CardContent>
          </Card>
        )
      )}

      {/* Info footer */}
      <p className="text-[10px] text-center text-muted-foreground px-4">
        WOOP (Oettingen, 2012): effect size g=0.28-0.47. Obiettivi con piani Se-Allora hanno 2-3x probabilita di essere raggiunti. L'IA analizza il tuo cronotipo, la tua energia e i tuoi pattern per ottimizzare ogni obiettivo.
      </p>
    </div>
  );
}
