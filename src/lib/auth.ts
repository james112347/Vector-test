import { db } from '../db/db';
import type { User, Session } from '../db/schema';
import { supabase } from './supabase';

/**
 * Admin email - hardcoded owner of the app.
 * This email is always admin and auto-approved.
 */
const ADMIN_EMAIL = 'giacomosalvato81@gmail.com';

export function isAdminEmail(email: string): boolean {
  return email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

/**
 * Simple password hashing for local-only auth.
 * WARNING: This is NOT cryptographically secure for production.
 * Phase 1 stores data in IndexedDB on-device only.
 * Real backend auth with bcrypt will replace this.
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

/**
 * Generate a simple session token.
 */
function generateToken(): string {
  return crypto.randomUUID();
}

/**
 * Create a session for the given user.
 * Sessions expire after 30 days by default.
 */
export async function createSession(userId: number, expiresInDays = 30): Promise<Session> {
  const session: Session = {
    userId,
    token: generateToken(),
    expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
  };
  const id = await db.sessions.add(session);
  return { ...session, id };
}

/**
 * Check for a valid (non-expired) session.
 * Returns the session and associated user if found.
 */
export async function checkExistingSession(): Promise<{ session: Session; user: User } | null> {
  const now = new Date();
  const session = await db.sessions
    .where('expiresAt')
    .above(now)
    .first();

  if (!session || !session.userId) return null;

  const user = await db.users.get(session.userId);
  if (!user) {
    await db.sessions.delete(session.id!);
    return null;
  }

  // Sync approval status from Supabase (in case admin approved on another device)
  if (supabase && !user.isApproved) {
    const { data } = await supabase
      .from('app_users')
      .select('is_approved')
      .eq('email', user.email)
      .single();
    if (data?.is_approved) {
      await db.users.update(user.id!, { isApproved: true, updatedAt: new Date() });
      user.isApproved = true;
    }
  }

  return { session, user };
}

/**
 * Clear all sessions (logout).
 */
export async function clearSession(): Promise<void> {
  await db.sessions.clear();
}

/**
 * Clear expired sessions (housekeeping).
 */
export async function cleanExpiredSessions(): Promise<void> {
  const now = new Date();
  await db.sessions.where('expiresAt').below(now).delete();
}

/**
 * Register a new user.
 * Admin email is auto-approved and flagged as admin.
 * All other users require admin approval.
 * Syncs to Supabase for cross-device visibility.
 */
export async function registerUser(
  email: string,
  password: string,
  acceptedTerms: boolean
): Promise<User> {
  if (!acceptedTerms) {
    throw new Error('Devi accettare i Termini e Condizioni per registrarti.');
  }

  const existing = await db.users.where('email').equals(email).first();
  if (existing) {
    throw new Error('Un account con questa email esiste già.');
  }

  const passwordHash = await hashPassword(password);
  const now = new Date();
  const admin = isAdminEmail(email);

  const user: User = {
    email,
    passwordHash,
    hasAcceptedTerms: true,
    termsAcceptedAt: now,
    isApproved: admin,
    isAdmin: admin,
    createdAt: now,
    updatedAt: now,
  };

  const id = await db.users.add(user);

  // Sync to Supabase (no password hash — only metadata)
  if (supabase) {
    await supabase.from('app_users').upsert(
      {
        email,
        is_approved: admin,
        is_admin: admin,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      { onConflict: 'email' }
    );
  }

  return { ...user, id };
}

/**
 * Authenticate a user by email and password.
 * Throws specific error if user is not approved.
 * Checks Supabase for latest approval status.
 */
export async function authenticateUser(email: string, password: string): Promise<User> {
  const user = await db.users.where('email').equals(email).first();
  if (!user) {
    throw new Error('Email o password non validi.');
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    throw new Error('Email o password non validi.');
  }

  // Ensure admin email always has admin + approved flags
  if (isAdminEmail(email) && (!user.isAdmin || !user.isApproved)) {
    await db.users.update(user.id!, { isAdmin: true, isApproved: true, updatedAt: new Date() });
    user.isAdmin = true;
    user.isApproved = true;
  }

  // Check Supabase for latest approval status
  if (supabase && !user.isApproved) {
    const { data } = await supabase
      .from('app_users')
      .select('is_approved')
      .eq('email', email)
      .single();
    if (data?.is_approved) {
      await db.users.update(user.id!, { isApproved: true, updatedAt: new Date() });
      user.isApproved = true;
    }
  }

  if (!user.isApproved) {
    throw new Error('PENDING_APPROVAL');
  }

  return user;
}

/**
 * Approve a user (admin only).
 * Updates both local DB and Supabase.
 */
export async function approveUser(userId: number): Promise<void> {
  const user = await db.users.get(userId);
  await db.users.update(userId, { isApproved: true, updatedAt: new Date() });

  if (supabase && user) {
    await supabase
      .from('app_users')
      .update({ is_approved: true, updated_at: new Date().toISOString() })
      .eq('email', user.email);
  }
}

/**
 * Revoke a user's access (admin only).
 * Cannot revoke admin.
 */
export async function revokeUser(userId: number): Promise<void> {
  const user = await db.users.get(userId);
  if (user && isAdminEmail(user.email)) {
    throw new Error('Non puoi revocare l\'accesso all\'amministratore.');
  }
  await db.users.update(userId, { isApproved: false, updatedAt: new Date() });
  await db.sessions.where('userId').equals(userId).delete();

  if (supabase && user) {
    await supabase
      .from('app_users')
      .update({ is_approved: false, updated_at: new Date().toISOString() })
      .eq('email', user.email);
  }
}

/**
 * Delete a user (admin only).
 * Cannot delete admin.
 */
export async function deleteUser(userId: number): Promise<void> {
  const user = await db.users.get(userId);
  if (user && isAdminEmail(user.email)) {
    throw new Error('Non puoi eliminare l\'account amministratore.');
  }
  await db.sessions.where('userId').equals(userId).delete();
  await db.users.delete(userId);

  if (supabase && user) {
    await supabase.from('app_users').delete().eq('email', user.email);
  }
}

/**
 * Get all users.
 * If Supabase is available, merges remote users (from other devices)
 * with local users.
 */
export async function getAllUsers(): Promise<User[]> {
  const localUsers = await db.users.toArray();

  if (!supabase) return localUsers;

  const { data: remoteUsers } = await supabase
    .from('app_users')
    .select('*')
    .order('created_at', { ascending: true });

  if (!remoteUsers) return localUsers;

  // Build map by email — remote data has the authoritative approval status
  const localMap = new Map(localUsers.map(u => [u.email, u]));
  const merged: User[] = [];

  for (const remote of remoteUsers) {
    const local = localMap.get(remote.email);
    if (local) {
      // Update local approval status if changed remotely
      if (local.isApproved !== remote.is_approved) {
        await db.users.update(local.id!, { isApproved: remote.is_approved, updatedAt: new Date() });
        local.isApproved = remote.is_approved;
      }
      merged.push(local);
      localMap.delete(remote.email);
    } else {
      // Remote-only user (registered on another device)
      merged.push({
        id: remote.id,
        email: remote.email,
        passwordHash: '',
        hasAcceptedTerms: true,
        isApproved: remote.is_approved,
        isAdmin: remote.is_admin,
        createdAt: new Date(remote.created_at),
        updatedAt: new Date(remote.updated_at),
      });
    }
  }

  // Add any local-only users not yet in Supabase
  for (const local of localMap.values()) {
    merged.push(local);
  }

  return merged;
}

/**
 * Get count of pending (unapproved) users.
 * Reads from Supabase if available for cross-device accuracy.
 */
export async function getPendingUsersCount(): Promise<number> {
  if (supabase) {
    const { count } = await supabase
      .from('app_users')
      .select('*', { count: 'exact', head: true })
      .eq('is_approved', false);
    return count ?? 0;
  }
  return db.users.filter(u => !u.isApproved).count();
}

/**
 * Reset entire database (clears all users, sessions, preferences).
 * Used when user needs to start fresh.
 */
export async function resetDatabase(): Promise<void> {
  await db.sessions.clear();
  await db.users.clear();
  await db.userPreferences.clear();
  await db.energyLogs.clear();
}
