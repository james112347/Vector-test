/**
 * Cross-device data sync via Supabase.
 *
 * Uses the existing `feedbacks` table with a special category (`_data_sync`)
 * to store user data as a JSON blob in the `chat_history` column.
 * This avoids needing new Supabase tables (which require admin/service-role access).
 */
import { db } from '../db/db';
import { supabase } from './supabase';

const SYNC_CATEGORY = '_data_sync';

/** Push all local user data to Supabase for cross-device access. */
export async function pushDataToSupabase(userEmail: string, userId: number): Promise<void> {
  if (!supabase) return;

  const email = userEmail.toLowerCase();

  try {
    // Gather all local data
    const energyLogs = await db.energyLogs.where('userId').equals(userId).toArray();
    const profile = await db.userProfiles.where('userId').equals(userId).first();
    const checkins = await db.quickCheckins.where('userId').equals(userId).toArray();

    const syncData = {
      energy_logs: energyLogs.map(l => ({
        date: l.date,
        physical: l.physical,
        mental: l.mental,
        emotional: l.emotional,
        workHoursToday: l.workHoursToday,
        notes: l.notes,
        createdAt: l.createdAt.toISOString(),
        updatedAt: l.updatedAt.toISOString(),
      })),
      profile: profile ? {
        name: profile.name,
        birthYear: profile.birthYear,
        gender: profile.gender,
        heightCm: profile.heightCm,
        weightKg: profile.weightKg,
        occupation: profile.occupation,
        workType: profile.workType,
        dailyWorkHours: profile.dailyWorkHours,
        workSchedule: profile.workSchedule,
        activityLevel: profile.activityLevel,
        sleepHours: profile.sleepHours,
        smokingFrequency: profile.smokingFrequency,
        alcoholFrequency: profile.alcoholFrequency,
        caffeineDaily: profile.caffeineDaily,
        goal: profile.goal,
        notes: profile.notes,
        completedAt: profile.completedAt.toISOString(),
        updatedAt: profile.updatedAt.toISOString(),
      } : null,
      checkins: checkins.map(c => ({
        date: c.date,
        time: c.time,
        type: c.type,
        value: c.value,
        createdAt: c.createdAt.toISOString(),
      })),
      synced_at: new Date().toISOString(),
    };

    // Check if a sync record already exists for this user
    const { data: existing } = await supabase
      .from('feedbacks')
      .select('id')
      .eq('user_email', email)
      .eq('category', SYNC_CATEGORY)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('feedbacks')
        .update({
          chat_history: syncData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('feedbacks')
        .insert({
          user_email: email,
          category: SYNC_CATEGORY,
          message: 'data_sync',
          chat_history: syncData,
          status: 'draft',
        });
    }
  } catch (e) {
    console.warn('Data sync push failed:', e);
  }
}

interface SyncPayload {
  energy_logs: Array<{
    date: string;
    physical: number;
    mental: number;
    emotional: number;
    workHoursToday?: number;
    notes?: string;
    createdAt: string;
    updatedAt: string;
  }>;
  profile: {
    name: string;
    birthYear: number;
    gender: string;
    heightCm: number;
    weightKg: number;
    occupation: string;
    workType?: string;
    dailyWorkHours: number;
    workSchedule: string;
    activityLevel: string;
    sleepHours: number;
    smokingFrequency: string;
    alcoholFrequency: string;
    caffeineDaily: number;
    goal: string;
    notes?: string;
    completedAt: string;
    updatedAt: string;
  } | null;
  checkins: Array<{
    date: string;
    time: string;
    type: string;
    value: number;
    createdAt: string;
  }>;
}

/** Pull user data from Supabase and populate local IndexedDB. */
export async function pullDataFromSupabase(userEmail: string, userId: number): Promise<void> {
  if (!supabase) return;

  const email = userEmail.toLowerCase();

  try {
    const { data: syncRecord } = await supabase
      .from('feedbacks')
      .select('chat_history')
      .eq('user_email', email)
      .eq('category', SYNC_CATEGORY)
      .maybeSingle();

    if (!syncRecord?.chat_history) return;

    const data = syncRecord.chat_history as SyncPayload;

    // Import energy logs (skip duplicates by date)
    if (data.energy_logs?.length) {
      for (const log of data.energy_logs) {
        const exists = await db.energyLogs
          .where('[userId+date]')
          .equals([userId, log.date])
          .first();
        if (!exists) {
          await db.energyLogs.add({
            userId,
            date: log.date,
            physical: log.physical,
            mental: log.mental,
            emotional: log.emotional,
            workHoursToday: log.workHoursToday,
            notes: log.notes,
            createdAt: new Date(log.createdAt),
            updatedAt: new Date(log.updatedAt),
          });
        }
      }
    }

    // Import profile (only if not already present locally)
    if (data.profile) {
      const existingProfile = await db.userProfiles.where('userId').equals(userId).first();
      if (!existingProfile) {
        await db.userProfiles.add({
          userId,
          name: data.profile.name,
          birthYear: data.profile.birthYear,
          gender: data.profile.gender as 'male' | 'female' | 'other' | 'prefer_not_to_say',
          heightCm: data.profile.heightCm,
          weightKg: data.profile.weightKg,
          occupation: data.profile.occupation as 'student' | 'worker' | 'student_worker' | 'unemployed' | 'retired',
          workType: data.profile.workType,
          dailyWorkHours: data.profile.dailyWorkHours,
          workSchedule: data.profile.workSchedule as 'regular' | 'shifts' | 'flexible' | 'irregular',
          activityLevel: data.profile.activityLevel as 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active',
          sleepHours: data.profile.sleepHours,
          smokingFrequency: data.profile.smokingFrequency as 'never' | 'occasional' | 'daily' | 'heavy',
          alcoholFrequency: data.profile.alcoholFrequency as 'never' | 'occasional' | 'weekly' | 'daily',
          caffeineDaily: data.profile.caffeineDaily,
          goal: data.profile.goal as 'more_energy' | 'better_sleep' | 'fitness' | 'stress' | 'general_wellness',
          notes: data.profile.notes,
          completedAt: new Date(data.profile.completedAt),
          updatedAt: new Date(data.profile.updatedAt),
        });
      }
    }

    // Import check-ins (skip duplicates by date+time+type)
    if (data.checkins?.length) {
      for (const ci of data.checkins) {
        const exists = await db.quickCheckins
          .where('[userId+date+type]')
          .equals([userId, ci.date, ci.type])
          .and(c => c.time === ci.time)
          .first();
        if (!exists) {
          await db.quickCheckins.add({
            userId,
            date: ci.date,
            time: ci.time,
            type: ci.type as 'sleep_quality' | 'water' | 'caffeine' | 'meal_time' | 'focus' | 'activity_done',
            value: ci.value,
            createdAt: new Date(ci.createdAt),
          });
        }
      }
    }
  } catch (e) {
    console.warn('Data sync pull failed:', e);
  }
}
