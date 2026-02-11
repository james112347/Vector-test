import { db } from '../db/db';
import type { User, Session } from '../db/schema';

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
  return { ...user, id };
}

/**
 * Authenticate a user by email and password.
 * Throws specific error if user is not approved.
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

  if (!user.isApproved) {
    throw new Error('PENDING_APPROVAL');
  }

  return user;
}

/**
 * Approve a user (admin only).
 */
export async function approveUser(userId: number): Promise<void> {
  await db.users.update(userId, { isApproved: true, updatedAt: new Date() });
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
  // Clear their sessions
  await db.sessions.where('userId').equals(userId).delete();
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
}

/**
 * Get all users (admin view).
 */
export async function getAllUsers(): Promise<User[]> {
  return db.users.toArray();
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
