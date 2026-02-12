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

  let valid = await verifyPassword(password, user.passwordHash);

  // If local password fails, check if password was reset remotely via Supabase
  if (!valid && supabase) {
    const { data } = await supabase
      .from('app_users')
      .select('password_hash')
      .eq('email', email)
      .single();
    if (data?.password_hash) {
      valid = await verifyPassword(password, data.password_hash);
      if (valid) {
        // Sync the remotely-reset password to local DB
        await db.users.update(user.id!, {
          passwordHash: data.password_hash,
          updatedAt: new Date(),
        });
      }
    }
  }

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
 * Updates both local DB (by email) and Supabase.
 * The email parameter is the authoritative identifier to avoid
 * ID collisions between Supabase and local IndexedDB auto-increment IDs.
 */
export async function approveUser(userId: number, email?: string): Promise<void> {
  // Update local DB by email (not by ID — IDs can collide between Supabase and IndexedDB)
  const targetEmail = email;
  if (targetEmail) {
    const localUser = await db.users.where('email').equals(targetEmail).first();
    if (localUser) {
      await db.users.update(localUser.id!, { isApproved: true, updatedAt: new Date() });
    }
  } else {
    // Fallback to ID lookup when no email provided
    await db.users.update(userId, { isApproved: true, updatedAt: new Date() });
  }

  if (supabase && targetEmail) {
    const { error } = await supabase
      .from('app_users')
      .update({ is_approved: true, updated_at: new Date().toISOString() })
      .eq('email', targetEmail);
    if (error) throw new Error(`Errore approvazione: ${error.message}`);
  }
}

/**
 * Revoke a user's access (admin only).
 * Cannot revoke admin.
 * Uses email as authoritative identifier to avoid ID collisions.
 */
export async function revokeUser(userId: number, email?: string): Promise<void> {
  const targetEmail = email;

  if (targetEmail && isAdminEmail(targetEmail)) {
    throw new Error('Non puoi revocare l\'accesso all\'amministratore.');
  }

  if (targetEmail) {
    const localUser = await db.users.where('email').equals(targetEmail).first();
    if (localUser) {
      await db.users.update(localUser.id!, { isApproved: false, updatedAt: new Date() });
      await db.sessions.where('userId').equals(localUser.id!).delete();
    }
  } else {
    await db.users.update(userId, { isApproved: false, updatedAt: new Date() });
    await db.sessions.where('userId').equals(userId).delete();
  }

  if (supabase && targetEmail) {
    const { error } = await supabase
      .from('app_users')
      .update({ is_approved: false, updated_at: new Date().toISOString() })
      .eq('email', targetEmail);
    if (error) throw new Error(`Errore revoca: ${error.message}`);
  }
}

/**
 * Delete a user (admin only).
 * Cannot delete admin.
 * Uses email as authoritative identifier to avoid ID collisions.
 */
export async function deleteUser(userId: number, email?: string): Promise<void> {
  const targetEmail = email;

  if (targetEmail && isAdminEmail(targetEmail)) {
    throw new Error('Non puoi eliminare l\'account amministratore.');
  }

  if (targetEmail) {
    const localUser = await db.users.where('email').equals(targetEmail).first();
    if (localUser) {
      await db.sessions.where('userId').equals(localUser.id!).delete();
      await db.users.delete(localUser.id!);
    }
  } else {
    await db.users.update(userId, { isApproved: false });
    await db.sessions.where('userId').equals(userId).delete();
    await db.users.delete(userId);
  }

  if (supabase && targetEmail) {
    const { error } = await supabase.from('app_users').delete().eq('email', targetEmail);
    if (error) throw new Error(`Errore eliminazione: ${error.message}`);
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
 * Request a password reset email.
 * Calls the Supabase Edge Function which generates a token and sends an email.
 * Always succeeds (for security — doesn't reveal if email exists).
 */
export async function requestPasswordReset(email: string): Promise<void> {
  if (!supabase) {
    throw new Error('Il servizio di reset password non e disponibile. Contatta l\'amministratore.');
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  const response = await fetch(`${supabaseUrl}/functions/v1/send-reset-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({ action: 'request', email: email.trim().toLowerCase() }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Errore durante l\'invio dell\'email.');
  }
}

/**
 * Validate a password reset token.
 * Returns true if token is valid and not expired.
 */
export async function validateResetToken(email: string, token: string): Promise<boolean> {
  if (!supabase) return false;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  const response = await fetch(`${supabaseUrl}/functions/v1/send-reset-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({ action: 'validate', email, token }),
  });

  if (!response.ok) return false;
  const data = await response.json();
  return data.valid === true;
}

/**
 * Reset password using a valid token from the email link.
 * Updates password both in Supabase (via Edge Function) and locally.
 */
export async function resetPasswordWithToken(
  email: string,
  token: string,
  newPassword: string,
): Promise<void> {
  if (!supabase) {
    throw new Error('Il servizio di reset password non e disponibile.');
  }

  const passwordHash = await hashPassword(newPassword);
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  const response = await fetch(`${supabaseUrl}/functions/v1/send-reset-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({ action: 'reset', email, token, passwordHash }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Errore durante il reset della password.');
  }

  // Also update locally if user exists on this device
  const user = await db.users.where('email').equals(email).first();
  if (user) {
    await db.users.update(user.id!, { passwordHash, updatedAt: new Date() });
    await db.sessions.where('userId').equals(user.id!).delete();
  }
}

/**
 * Admin: reset a user's password to a temporary value.
 * Only works if the user account exists locally.
 */
export async function adminResetPassword(email: string, tempPassword: string): Promise<void> {
  const user = await db.users.where('email').equals(email).first();
  if (!user) {
    throw new Error('Account non presente localmente. Il reset funziona solo sullo stesso dispositivo.');
  }
  const passwordHash = await hashPassword(tempPassword);
  await db.users.update(user.id!, { passwordHash, updatedAt: new Date() });
  await db.sessions.where('userId').equals(user.id!).delete();
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
