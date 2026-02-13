// ---------------------------------------------------------------------------
// Hook React — useEnergyOrientation
// ---------------------------------------------------------------------------

import { useState, useEffect, useCallback, useRef } from 'react';
import type { OrientationResult, Recommendation, EnergyState } from './energy-orientation';
import {
  generateOrientation,
  logOrientationResponse,
  processOrientationNotifications,
} from './energy-orientation';

interface UseEnergyOrientationReturn {
  /** Risultato completo dell'orientamento */
  result: OrientationResult | null;
  /** Stato energetico corrente (shortcut) */
  energyState: EnergyState | null;
  /** Raccomandazioni ordinate (shortcut) */
  recommendations: Recommendation[];
  /** Caricamento in corso */
  loading: boolean;
  /** Errore */
  error: string;
  /** Rigenera l'orientamento */
  refresh: () => Promise<void>;
  /** Segna una raccomandazione come seguita */
  markFollowed: (rec: Recommendation) => Promise<void>;
  /** Segna una raccomandazione come ignorata */
  markDismissed: (rec: Recommendation) => Promise<void>;
}

/** Cache in sessionStorage per evitare chiamate ripetute */
const CACHE_KEY = 'vector_orientation_cache';
const CACHE_TTL = 15 * 60 * 1000; // 15 minuti

function getCached(): OrientationResult | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (Date.now() - cached.ts > CACHE_TTL) return null;
    // Ripristina le Date
    const result = cached.data as OrientationResult;
    result.generatedAt = new Date(result.generatedAt);
    result.energyState.assessedAt = new Date(result.energyState.assessedAt);
    return result;
  } catch { return null; }
}

function setCache(data: OrientationResult): void {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
  } catch { /* ignored */ }
}

export function useEnergyOrientation(userId: number | undefined): UseEnergyOrientationReturn {
  const [result, setResult] = useState<OrientationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const refreshing = useRef(false);

  const refresh = useCallback(async () => {
    if (!userId || refreshing.current) return;
    refreshing.current = true;
    setLoading(true);
    setError('');

    try {
      const orientation = await generateOrientation(userId);
      setResult(orientation);
      setCache(orientation);

      // Processa notifiche in background
      processOrientationNotifications(userId, orientation.notifications).catch(() => {});
    } catch (e) {
      setError((e as Error).message || 'Errore nel generare l\'orientamento');
    } finally {
      setLoading(false);
      refreshing.current = false;
    }
  }, [userId]);

  // Carica iniziale: usa cache o genera
  useEffect(() => {
    if (!userId) return;

    const cached = getCached();
    if (cached) {
      setResult(cached);
      return;
    }

    refresh();
  }, [userId, refresh]);

  // Rigenera quando l'app torna in primo piano
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        const cached = getCached();
        if (!cached) {
          refresh();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [refresh]);

  const markFollowed = useCallback(async (rec: Recommendation) => {
    if (!userId || !result) return;
    await logOrientationResponse(userId, result.energyState, rec, 'followed');
    // Aggiorna lo stato locale
    setResult(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        recommendations: prev.recommendations.map(r =>
          r.id === rec.id ? { ...r, followedAt: new Date() } : r
        ),
      };
    });
  }, [userId, result]);

  const markDismissed = useCallback(async (rec: Recommendation) => {
    if (!userId || !result) return;
    await logOrientationResponse(userId, result.energyState, rec, 'dismissed');
    setResult(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        recommendations: prev.recommendations.map(r =>
          r.id === rec.id ? { ...r, dismissedAt: new Date() } : r
        ),
      };
    });
  }, [userId, result]);

  return {
    result,
    energyState: result?.energyState ?? null,
    recommendations: result?.recommendations ?? [],
    loading,
    error,
    refresh,
    markFollowed,
    markDismissed,
  };
}
