import { useState, useCallback } from 'react';

const STORAGE_KEY = 'vector_app_settings';

export interface AppSettings {
  autoRefresh: boolean;
  notificationsEnabled: boolean;
}

const defaults: AppSettings = {
  autoRefresh: true,
  notificationsEnabled: false,
};

function load(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return defaults;
  }
}

function save(settings: AppSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(load);

  const update = useCallback((patch: Partial<AppSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      save(next);
      return next;
    });
  }, []);

  return { settings, update } as const;
}

/** Read settings outside of React (e.g. in effects). */
export function getAppSettings(): AppSettings {
  return load();
}
