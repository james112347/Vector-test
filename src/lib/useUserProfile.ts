import { useState, useEffect, useCallback } from 'react';
import { db } from '../db/db';
import type { UserProfile } from '../db/schema';

export function useUserProfile(userId: number | undefined) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }
    const p = await db.userProfiles.where('userId').equals(userId).first();
    setProfile(p ?? null);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { profile, loading, reload };
}
