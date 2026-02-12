import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useAuthState } from '../contexts/AuthContext';
import {
  analyzeFoodImage,
  compressImage,
  createThumbnail,
  saveFoodLog,
  getTodayFoodLogs,
  deleteFoodLog,
  getTodayCalorieSummary,
  type FoodAnalysis,
  type FoodItem,
} from '../lib/food-ai';
import { isAIAvailable } from '../lib/ai';
import type { FoodLog } from '../db/schema';

const MEAL_LABELS: Record<string, string> = {
  colazione: 'Colazione',
  pranzo: 'Pranzo',
  cena: 'Cena',
  spuntino: 'Spuntino',
};

const CONFIDENCE_COLORS: Record<string, string> = {
  alta: 'text-green-600 dark:text-green-400 bg-green-500/10',
  media: 'text-amber-600 dark:text-amber-400 bg-amber-500/10',
  bassa: 'text-red-600 dark:text-red-400 bg-red-500/10',
};

function MacroBar({ label, value, unit, color, max }: {
  label: string; value: number; unit: string; color: string; max: number;
}) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{Math.round(value)}{unit}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function FoodItemRow({ item }: { item: FoodItem }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.name}</p>
        <p className="text-xs text-muted-foreground">{item.portion}</p>
      </div>
      <div className="text-right shrink-0 ml-3">
        <p className="text-sm font-bold">{item.calories} kcal</p>
        <p className="text-[10px] text-muted-foreground">
          P:{Math.round(item.protein)}g C:{Math.round(item.carbs)}g G:{Math.round(item.fat)}g
        </p>
      </div>
    </div>
  );
}

export default function FoodScanner() {
  const { user } = useAuthState();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [compressedImage, setCompressedImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<FoodAnalysis | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // Today's logs
  const [todayLogs, setTodayLogs] = useState<FoodLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  const loadTodayLogs = useCallback(async () => {
    if (!user?.id) return;
    try {
      const logs = await getTodayFoodLogs(user.id);
      setTodayLogs(logs);
    } catch {
      // ignore
    } finally {
      setLoadingLogs(false);
    }
  }, [user?.id]);

  useEffect(() => { loadTodayLogs(); }, [loadTodayLogs]);

  const handleImageSelect = async (file: File) => {
    setError('');
    setAnalysis(null);
    setSaved(false);

    try {
      const compressed = await compressImage(file);
      setImagePreview(compressed);
      setCompressedImage(compressed);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageSelect(file);
    e.target.value = '';
  };

  const handleAnalyze = async () => {
    if (!compressedImage) return;
    setAnalyzing(true);
    setError('');
    setAnalysis(null);

    try {
      const result = await analyzeFoodImage(compressedImage);
      setAnalysis(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSave = async () => {
    if (!analysis || !user?.id) return;
    setSaving(true);
    try {
      const thumb = compressedImage ? await createThumbnail(compressedImage) : undefined;
      await saveFoodLog(user.id, analysis, thumb);
      setSaved(true);
      await loadTodayLogs();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteFoodLog(id);
      await loadTodayLogs();
    } catch {
      // ignore
    }
  };

  const handleReset = () => {
    setImagePreview(null);
    setCompressedImage(null);
    setAnalysis(null);
    setError('');
    setSaved(false);
  };

  const summary = getTodayCalorieSummary(todayLogs);

  if (!isAIAvailable()) {
    return (
      <div className="space-y-4 pb-24">
        <div>
          <h1 className="text-2xl font-bold">Food Scanner</h1>
          <p className="text-muted-foreground mt-1 text-sm">Analisi calorie con IA</p>
        </div>
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground text-sm">
              Per usare il Food Scanner serve una chiave API Groq configurata.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      <div>
        <h1 className="text-2xl font-bold">Food Scanner</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Scatta o carica una foto del tuo pasto
        </p>
      </div>

      {/* Today's Summary */}
      {todayLogs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Oggi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-around py-2">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{summary.total}</p>
                <p className="text-[10px] text-muted-foreground">kcal totali</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{Math.round(summary.protein)}g</p>
                <p className="text-[10px] text-muted-foreground">Proteine</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{Math.round(summary.carbs)}g</p>
                <p className="text-[10px] text-muted-foreground">Carbo</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-red-600 dark:text-red-400">{Math.round(summary.fat)}g</p>
                <p className="text-[10px] text-muted-foreground">Grassi</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center mt-1">
              {summary.meals} {summary.meals === 1 ? 'pasto registrato' : 'pasti registrati'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Capture / Upload */}
      {!imagePreview && (
        <Card>
          <CardContent className="py-6">
            <div className="flex flex-col gap-3">
              <Button
                size="lg"
                className="w-full gap-2"
                onClick={() => cameraInputRef.current?.click()}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Scatta foto
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full gap-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Carica dalla galleria
              </Button>
            </div>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </CardContent>
        </Card>
      )}

      {/* Image Preview */}
      {imagePreview && (
        <Card>
          <CardContent className="py-4">
            <div className="relative rounded-lg overflow-hidden">
              <img
                src={imagePreview}
                alt="Foto del pasto"
                className="w-full h-auto max-h-64 object-cover rounded-lg"
              />
              {!analyzing && !analysis && (
                <button
                  onClick={handleReset}
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Analyze button */}
            {!analysis && !analyzing && (
              <Button
                className="w-full mt-3 gap-2"
                onClick={handleAnalyze}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Analizza con IA
              </Button>
            )}

            {/* Loading */}
            {analyzing && (
              <div className="py-6 text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-3 border-primary border-t-transparent" />
                <p className="text-sm text-muted-foreground mt-3">Analisi in corso...</p>
                <p className="text-xs text-muted-foreground mt-1">L'IA sta identificando gli alimenti</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Card>
          <CardContent className="py-4">
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              <Button size="sm" variant="outline" className="mt-2" onClick={handleReset}>
                Riprova
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analysis Results */}
      {analysis && (
        <>
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Risultato analisi</CardTitle>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${CONFIDENCE_COLORS[analysis.confidence]}`}>
                    {analysis.confidence === 'alta' ? 'Alta precisione' : analysis.confidence === 'media' ? 'Media precisione' : 'Bassa precisione'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {MEAL_LABELS[analysis.mealType]}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Calorie totali */}
              <div className="text-center py-3 mb-3 rounded-lg bg-primary/5 border border-primary/10">
                <p className="text-3xl font-bold text-primary">{analysis.totalCalories}</p>
                <p className="text-xs text-muted-foreground">kcal totali stimate</p>
              </div>

              {/* Macro bars */}
              <div className="space-y-2.5 mb-4">
                <MacroBar label="Proteine" value={analysis.totalProtein} unit="g" color="#3b82f6" max={80} />
                <MacroBar label="Carboidrati" value={analysis.totalCarbs} unit="g" color="#f59e0b" max={120} />
                <MacroBar label="Grassi" value={analysis.totalFat} unit="g" color="#ef4444" max={60} />
              </div>

              {/* Food items */}
              <div className="border-t border-border pt-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  {analysis.foods.length} {analysis.foods.length === 1 ? 'alimento identificato' : 'alimenti identificati'}
                </p>
                {analysis.foods.map((item, i) => (
                  <FoodItemRow key={i} item={item} />
                ))}
              </div>

              {/* Health tip */}
              {analysis.healthTip && (
                <div className="mt-3 rounded-lg bg-green-500/10 border border-green-500/20 p-3">
                  <p className="text-xs font-medium text-green-600 dark:text-green-400">Consiglio nutrizionale</p>
                  <p className="text-xs mt-1">{analysis.healthTip}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 mt-4">
                {!saved ? (
                  <>
                    <Button className="flex-1 gap-1.5" onClick={handleSave} disabled={saving}>
                      {saving ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      Salva pasto
                    </Button>
                    <Button variant="outline" onClick={handleReset}>
                      Annulla
                    </Button>
                  </>
                ) : (
                  <div className="w-full text-center space-y-2">
                    <p className="text-sm font-medium text-green-600 dark:text-green-400">
                      Pasto salvato!
                    </p>
                    <Button variant="outline" className="w-full" onClick={handleReset}>
                      Scansiona un altro pasto
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Today's Food Logs */}
      {todayLogs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Pasti di oggi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {todayLogs.map(log => {
                const foods: FoodItem[] = JSON.parse(log.foodItems);
                return (
                  <div key={log.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {log.imageData && (
                          <img
                            src={log.imageData}
                            alt="Pasto"
                            className="w-10 h-10 rounded-md object-cover"
                          />
                        )}
                        <div>
                          <p className="text-sm font-medium">{MEAL_LABELS[log.mealType]}</p>
                          <p className="text-[10px] text-muted-foreground">{log.time}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">{log.totalCalories} kcal</span>
                        <button
                          onClick={() => log.id && handleDelete(log.id)}
                          className="text-muted-foreground hover:text-red-500 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-3 text-[10px] text-muted-foreground">
                      {foods.map((f, i) => (
                        <span key={i}>{f.name}</span>
                      ))}
                    </div>
                    <div className="flex gap-3 mt-1 text-[10px]">
                      <span className="text-blue-600 dark:text-blue-400">P:{Math.round(log.totalProtein)}g</span>
                      <span className="text-amber-600 dark:text-amber-400">C:{Math.round(log.totalCarbs)}g</span>
                      <span className="text-red-600 dark:text-red-400">G:{Math.round(log.totalFat)}g</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state for logs */}
      {!loadingLogs && todayLogs.length === 0 && !imagePreview && (
        <Card>
          <CardContent className="py-6 text-center">
            <p className="text-sm text-muted-foreground">
              Nessun pasto registrato oggi. Scatta una foto per iniziare!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
