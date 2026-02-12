import { db } from '../db/db';
import type { User, Session } from '../db/schema';
import { supabase } from './supabase';
import { pullDataFromSupabase, pushDataToSupabase } from './data-sync';

// ---------------------------------------------------------------------------
// Session persistence in localStorage (survives IndexedDB eviction)
// ---------------------------------------------------------------------------

const LS_SESSION_KEY = 'vector_session';

interface SavedSession {
  email: string;
  token: string;
  expiresAt: string;
}

function saveSessionToLS(email: string, token: string, expiresAt: Date): void {
  try {
    localStorage.setItem(LS_SESSION_KEY, JSON.stringify({
      email,
      token,
      expiresAt: expiresAt.toISOString(),
    }));
  } catch {
    // localStorage full or unavailable — not critical
  }
}

function getSessionFromLS(): SavedSession | null {
  try {
    const raw = localStorage.getItem(LS_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedSession;
    if (new Date(parsed.expiresAt) <= new Date()) {
      localStorage.removeItem(LS_SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function clearSessionFromLS(): void {
  localStorage.removeItem(LS_SESSION_KEY);
}

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

  // Save in localStorage as backup (survives IndexedDB eviction)
  const user = await db.users.get(userId);
  if (user) {
    saveSessionToLS(user.email, session.token, session.expiresAt);
  }

  return { ...session, id };
}

/**
 * Check for a valid (non-expired) session.
 * Returns the session and associated user if found.
 *
 * If IndexedDB was cleared (e.g., browser eviction), tries to restore
 * the session from localStorage + Supabase automatically.
 * This ensures PWA / bookmark users stay logged in.
 */
export async function checkExistingSession(): Promise<{ session: Session; user: User } | null> {
  const now = new Date();

  // 1. Try IndexedDB first (primary)
  const session = await db.sessions
    .where('expiresAt')
    .above(now)
    .first();

  if (session?.userId) {
    const user = await db.users.get(session.userId);
    if (user) {
      // Sync user data to/from Supabase on session resume
      if (supabase) {
        try {
          const { data } = await supabase
            .from('app_users')
            .select('is_approved, password_hash')
            .eq('email', user.email)
            .single();
          if (data) {
            // Pull: update local approval status if changed remotely
            if (data.is_approved && !user.isApproved) {
              await db.users.update(user.id!, { isApproved: true, updatedAt: new Date() });
              user.isApproved = true;
            }
            // Push: sync password_hash to Supabase if missing there
            if (!data.password_hash && user.passwordHash) {
              supabase.from('app_users')
                .update({ password_hash: user.passwordHash, updated_at: new Date().toISOString() })
                .eq('email', user.email)
                .then(({ error }) => {
                  if (error) console.warn('Could not push password_hash:', error.message);
                });
            }
          } else {
            // User not in Supabase at all — push full record
            supabase.from('app_users').upsert(
              {
                email: user.email,
                password_hash: user.passwordHash,
                is_approved: user.isApproved ?? true,
                is_admin: user.isAdmin ?? false,
                created_at: user.createdAt?.toISOString() ?? new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'email' }
            ).then(({ error }) => {
              if (error) console.warn('Could not push user to Supabase:', error.message);
            });
          }
        } catch {
          console.warn('Could not sync with Supabase, using local data');
        }
      }
      return { session, user };
    }
    await db.sessions.delete(session.id!);
  }

  // 2. IndexedDB empty — try restoring from localStorage + Supabase
  const saved = getSessionFromLS();
  if (!saved || !supabase) return null;

  try {
    const { data, error } = await supabase
      .from('app_users')
      .select('*')
      .eq('email', saved.email)
      .single();

    if (error || !data) {
      clearSessionFromLS();
      return null;
    }

    if (!data.is_approved) {
      clearSessionFromLS();
      return null;
    }

    // Re-create local user from Supabase data
    const restoredUser: User = {
      email: data.email,
      passwordHash: data.password_hash || '',
      hasAcceptedTerms: true,
      isApproved: data.is_approved,
      isAdmin: data.is_admin ?? false,
      createdAt: new Date(data.created_at),
      updatedAt: now,
    };
    const userId = await db.users.add(restoredUser);
    restoredUser.id = userId;

    // Re-create session in IndexedDB
    const restoredSession: Session = {
      userId,
      token: saved.token,
      expiresAt: new Date(saved.expiresAt),
      createdAt: now,
    };
    const sessionId = await db.sessions.add(restoredSession);
    restoredSession.id = sessionId;

    console.log('Session restored from localStorage + Supabase for:', saved.email);
    return { session: restoredSession, user: restoredUser };
  } catch (e) {
    console.warn('Could not restore session from Supabase:', e);
    return null;
  }
}

/**
 * Clear all sessions (logout).
 */
export async function clearSession(): Promise<void> {
  await db.sessions.clear();
  clearSessionFromLS();
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

  // Normalize email to lowercase
  const normalizedEmail = email.trim().toLowerCase();

  const existing = await db.users.where('email').equals(normalizedEmail).first();
  if (existing) {
    throw new Error('Un account con questa email esiste già.');
  }

  // Also check Supabase for existing account (registered on another device)
  if (supabase) {
    try {
      const { data } = await supabase
        .from('app_users')
        .select('email')
        .eq('email', normalizedEmail)
        .single();
      if (data) {
        throw new Error('Un account con questa email esiste già. Prova ad accedere.');
      }
    } catch (e) {
      // If it's our own error, rethrow
      if (e instanceof Error && e.message.includes('esiste')) throw e;
      // Network error — proceed with registration
    }
  }

  const passwordHash = await hashPassword(password);
  const now = new Date();
  const admin = isAdminEmail(normalizedEmail);

  const user: User = {
    email: normalizedEmail,
    passwordHash,
    hasAcceptedTerms: true,
    termsAcceptedAt: now,
    isApproved: admin,
    isAdmin: admin,
    createdAt: now,
    updatedAt: now,
  };

  const id = await db.users.add(user);

  // Sync to Supabase (includes password hash for cross-device login)
  if (supabase) {
    await supabase.from('app_users').upsert(
      {
        email: normalizedEmail,
        password_hash: passwordHash,
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
  // Normalize email to lowercase to prevent case-sensitivity issues
  const normalizedEmail = email.trim().toLowerCase();

  let user = await db.users.where('email').equals(normalizedEmail).first();

  // If user not found locally, try to fetch from Supabase (cross-device login)
  if (!user && supabase) {
    try {
      // Use ilike for case-insensitive match (handles old data stored with mixed case)
      const { data, error } = await supabase
        .from('app_users')
        .select('*')
        .ilike('email', normalizedEmail)
        .single();
      if (error && error.code !== 'PGRST116') {
        // PGRST116 = "not found", any other error is a connectivity/server issue
        throw error;
      }
      if (data) {
        if (!data.password_hash) {
          // User exists in Supabase but password was never synced.
          // First bookmark/PWA login: hash the entered password and save it.
          // This is safe because the user was already approved by an admin.
          const passwordHash = await hashPassword(password);
          // Save hash to Supabase for future logins
          supabase.from('app_users')
            .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
            .ilike('email', normalizedEmail)
            .then(({ error: updateErr }) => {
              if (updateErr) console.warn('Could not save password hash to Supabase:', updateErr.message);
            });
          // Create local user
          const now = new Date();
          const localUser: User = {
            email: normalizedEmail,
            passwordHash,
            hasAcceptedTerms: true,
            isApproved: data.is_approved ?? false,
            isAdmin: data.is_admin ?? false,
            createdAt: new Date(data.created_at),
            updatedAt: now,
          };
          const id = await db.users.add(localUser);
          user = { ...localUser, id };
        } else {
          const valid = await verifyPassword(password, data.password_hash);
          if (!valid) throw new Error('Email o password non validi.');
          // Create local copy of this user (always store normalized email)
          const now = new Date();
          const localUser: User = {
            email: normalizedEmail,
            passwordHash: data.password_hash,
            hasAcceptedTerms: true,
            isApproved: data.is_approved ?? false,
            isAdmin: data.is_admin ?? false,
            createdAt: new Date(data.created_at),
            updatedAt: now,
          };
          const id = await db.users.add(localUser);
          user = { ...localUser, id };
        }

        // Pull user data (energy logs, profile, check-ins) from Supabase.
        // Await so data is ready before the user sees the dashboard.
        if (user?.id) {
          await pullDataFromSupabase(normalizedEmail, user.id).catch(() => {});
        }

        // Also normalize the email in Supabase if it was stored with mixed case
        if (data.email !== normalizedEmail) {
          supabase.from('app_users')
            .update({ email: normalizedEmail, updated_at: new Date().toISOString() })
            .eq('email', data.email)
            .then(() => {});
        }
      }
    } catch (e) {
      // If it's our own auth error, rethrow
      if (e instanceof Error && e.message === 'Email o password non validi.') throw e;
      // Network/Supabase error — inform user clearly
      console.error('Supabase auth fetch failed:', e);
      if (!user) {
        throw new Error('Impossibile connettersi al server. Verifica la connessione internet e riprova.');
      }
    }
  }

  if (!user) {
    throw new Error('Email o password non validi.');
  }

  let valid = await verifyPassword(password, user.passwordHash);

  // If local password fails, check if password was reset remotely via Supabase
  if (!valid && supabase) {
    try {
      const { data } = await supabase
        .from('app_users')
        .select('password_hash')
        .eq('email', normalizedEmail)
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
    } catch {
      // Network error during password sync check — use local password result
      console.warn('Could not check remote password, using local auth only');
    }
  }

  if (!valid) {
    throw new Error('Email o password non validi.');
  }

  // Sync user data (including password_hash) to Supabase after successful local login.
  // This ensures cross-device / bookmark / PWA login works next time.
  if (supabase) {
    const now = new Date();
    supabase.from('app_users').upsert(
      {
        email: normalizedEmail,
        password_hash: user.passwordHash,
        is_approved: user.isApproved ?? true,
        is_admin: user.isAdmin ?? false,
        created_at: user.createdAt?.toISOString() ?? now.toISOString(),
        updated_at: now.toISOString(),
      },
      { onConflict: 'email' }
    ).then(({ error }) => {
      if (error) console.warn('Could not sync user to Supabase:', error.message);
    });

    // Also push local data (energy logs, profile, check-ins) to Supabase
    if (user.id) {
      pushDataToSupabase(normalizedEmail, user.id).catch(() => {});
    }
  }

  // Ensure admin email always has admin + approved flags
  if (isAdminEmail(normalizedEmail) && (!user.isAdmin || !user.isApproved)) {
    await db.users.update(user.id!, { isAdmin: true, isApproved: true, updatedAt: new Date() });
    user.isAdmin = true;
    user.isApproved = true;
  }

  // Check Supabase for latest approval status (always check, not just if locally unapproved)
  if (supabase && !user.isApproved) {
    try {
      const { data } = await supabase
        .from('app_users')
        .select('is_approved')
        .ilike('email', normalizedEmail)
        .single();
      if (data?.is_approved) {
        await db.users.update(user.id!, { isApproved: true, updatedAt: new Date() });
        user.isApproved = true;
      }
    } catch {
      // Network error — use local approval status
      console.warn('Could not sync approval status');
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
    // Use ilike for case-insensitive match to prevent silent 0-row updates
    const { error } = await supabase
      .from('app_users')
      .update({ is_approved: true, updated_at: new Date().toISOString() })
      .ilike('email', targetEmail);
    if (error) throw new Error(`Errore approvazione: ${error.message}`);

    // Verify the update actually took effect
    const { data: verify } = await supabase
      .from('app_users')
      .select('is_approved')
      .ilike('email', targetEmail)
      .single();
    if (!verify?.is_approved) {
      throw new Error('Approvazione non riuscita: il dato non è stato salvato su Supabase. Riprova.');
    }
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
      .ilike('email', targetEmail);
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
    const { error } = await supabase.from('app_users').delete().ilike('email', targetEmail);
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

  let remoteUsers;
  try {
    const result = await supabase
      .from('app_users')
      .select('*')
      .order('created_at', { ascending: true });
    if (result.error) {
      console.warn('Supabase fetch users error:', result.error.message);
      return localUsers;
    }
    remoteUsers = result.data;
  } catch (e) {
    console.warn('Could not fetch remote users, using local data only:', e);
    return localUsers;
  }

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
    try {
      const { count } = await supabase
        .from('app_users')
        .select('*', { count: 'exact', head: true })
        .eq('is_approved', false);
      return count ?? 0;
    } catch {
      // Fallback to local count on network error
    }
  }
  return db.users.filter(u => !u.isApproved).count();
}


/**
 * Admin: reset a user's password to a temporary value.
 * Syncs the new password hash to Supabase so the user can log in from any device.
 */
export async function adminResetPassword(email: string, tempPassword: string): Promise<void> {
  const passwordHash = await hashPassword(tempPassword);

  // Update locally if user exists on this device
  const user = await db.users.where('email').equals(email).first();
  if (user) {
    await db.users.update(user.id!, { passwordHash, updatedAt: new Date() });
    await db.sessions.where('userId').equals(user.id!).delete();
  }

  // Sync to Supabase (so user can log in from any device with the new password)
  if (supabase) {
    const { error } = await supabase
      .from('app_users')
      .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
      .eq('email', email);
    if (error) throw new Error(`Errore sincronizzazione password: ${error.message}`);
  }
}

/**
 * Change password for the currently logged-in user.
 * Verifies the old password before setting the new one.
 * Syncs to Supabase for cross-device access.
 */
export async function changePassword(
  userId: number,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await db.users.get(userId);
  if (!user) throw new Error('Utente non trovato.');

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) throw new Error('La password attuale non e corretta.');

  if (newPassword.length < 6) throw new Error('La nuova password deve avere almeno 6 caratteri.');

  const passwordHash = await hashPassword(newPassword);
  await db.users.update(userId, { passwordHash, updatedAt: new Date() });

  // Sync to Supabase
  if (supabase) {
    await supabase
      .from('app_users')
      .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
      .eq('email', user.email);
  }
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
