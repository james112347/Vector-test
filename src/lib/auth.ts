import { db } from '../db/db';
import type { User, Session } from '../db/schema';

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
 * Uses crypto.randomUUID() for uniqueness.
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
    // Orphaned session, clean up
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
 * New users are NOT approved by default - admin must approve.
 * Returns the created user or throws if email already exists.
 */
export async function registerUser(
  email: string,
  password: string,
  acceptedTerms: boolean
): Promise<User> {
  if (!acceptedTerms) {
    throw new Error('Devi accettare i Termini e Condizioni per registrarti.');
  }

  // Check for existing user
  const existing = await db.users.where('email').equals(email).first();
  if (existing) {
    throw new Error('Un account con questa email esiste già.');
  }

  const passwordHash = await hashPassword(password);
  const now = new Date();

  // First user ever becomes admin and is auto-approved
  const userCount = await db.users.count();
  const isFirstUser = userCount === 0;

  const user: User = {
    email,
    passwordHash,
    hasAcceptedTerms: true,
    termsAcceptedAt: now,
    isApproved: isFirstUser,
    isAdmin: isFirstUser,
    createdAt: now,
    updatedAt: now,
  };

  const id = await db.users.add(user);
  return { ...user, id };
}

/**
 * Authenticate a user by email and password.
 * Returns the user or throws on invalid credentials.
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
 * Get all pending (unapproved) users.
 */
export async function getPendingUsers(): Promise<User[]> {
  return db.users.filter(u => !u.isApproved).toArray();
}

/**
 * Get all users (admin view).
 */
export async function getAllUsers(): Promise<User[]> {
  return db.users.toArray();
}
