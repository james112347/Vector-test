---
phase: 01-pwa-shell-auth-design-system
plan: 03
subsystem: authentication
tags: [auth, database, indexeddb, dexie, context, state-management]

dependency_graph:
  requires:
    - "01-01 (Vite + React setup)"
  provides:
    - "Dexie database with User, Session, UserPreferences tables"
    - "Auth helper functions (password hashing, session management)"
    - "Split AuthContext (state + actions)"
  affects:
    - "01-04 (Auth pages will consume AuthContext)"
    - "Future protected routes (will use useAuthState)"

tech_stack:
  added:
    - library: dexie
      version: "^4.3.0"
      purpose: "IndexedDB wrapper for client-side database"
    - library: dexie-react-hooks
      version: "^4.2.0"
      purpose: "React hooks for Dexie (not yet used, for future optimization)"
  patterns:
    - "Split Context Pattern (separate state/actions contexts)"
    - "Session persistence via IndexedDB"
    - "Client-side password hashing (SHA-256, local-only)"

key_files:
  created:
    - path: "src/db/schema.ts"
      loc: 25
      purpose: "TypeScript interfaces for User, Session, UserPreferences"
    - path: "src/db/db.ts"
      loc: 30
      purpose: "Dexie VectorDB instance with table definitions"
    - path: "src/lib/auth.ts"
      loc: 134
      purpose: "Auth helpers (hash, verify, register, authenticate, session CRUD)"
    - path: "src/contexts/AuthContext.tsx"
      loc: 128
      purpose: "Split AuthContext provider with hooks"
  modified: []

decisions:
  - decision: "Use split context pattern (AuthStateContext + AuthActionsContext)"
    rationale: "Prevents unnecessary re-renders when only actions are needed"
    alternatives: ["Single context", "Redux", "Zustand"]

  - decision: "SHA-256 password hashing for Phase 1"
    rationale: "Client-only PWA needs local auth. Backend bcrypt will replace this in Phase 3"
    security_note: "NOT production-grade - flagged for replacement with backend auth"

  - decision: "30-day session expiration"
    rationale: "Balance between convenience and security for local-only app"

  - decision: "Request persistent storage on init"
    rationale: "Prevent browser from evicting IndexedDB under storage pressure"

metrics:
  duration_minutes: 2.5
  tasks_completed: 2
  files_created: 4
  loc_added: 317
  commits: 2
  completed_date: "2026-02-11"
---

# Phase 01 Plan 03: Auth Data Layer & Context Summary

**One-liner:** Dexie.js database with User/Session tables, auth helpers (SHA-256 hashing, session CRUD), and split AuthContext for performance-optimized state management

## Objective

Build the authentication data layer and state management: Dexie.js database with User and Session tables, auth helper functions (password hashing, session management), and the React AuthContext that provides auth state to the entire app.

## Implementation Summary

### Task 1: Database Schema and Auth Helpers

Created the complete Dexie.js database layer:

**Database Schema** (`src/db/schema.ts`):
- `User`: email (unique), passwordHash, hasAcceptedTerms, termsAcceptedAt, createdAt, updatedAt
- `Session`: userId, token (UUID), expiresAt, createdAt
- `UserPreferences`: userId, theme (light|dark|system), updatedAt

**Database Instance** (`src/db/db.ts`):
- VectorDB class extending Dexie
- Table definitions with indexes: `users: '++id, &email'` (unique email)
- Persistent storage request to prevent browser eviction

**Auth Helpers** (`src/lib/auth.ts`):
- Password hashing: SHA-256 via crypto.subtle.digest (flagged as temporary for Phase 1)
- Registration: `registerUser` with T&C enforcement and duplicate email check
- Authentication: `authenticateUser` with email/password validation
- Session management: `createSession`, `checkExistingSession`, `clearSession`
- Housekeeping: `cleanExpiredSessions` for expired session cleanup

**Commit:** `b2a30ec` - feat(01-03): create Dexie database schema and auth helpers

### Task 2: Split AuthContext

Created performance-optimized React context:

**Split Context Pattern**:
- `AuthStateContext`: user, isSignedIn, isLoading (only changes when auth state changes)
- `AuthActionsContext`: signIn, signOut, register (stable, memoized)

**Session Persistence**:
- `useEffect` on mount checks IndexedDB for valid session
- Cleans expired sessions on initialization
- Restores user state if session found

**Exported Hooks**:
- `useAuthState()`: Subscribe to state only (optimizes components that don't need actions)
- `useAuthActions()`: Get stable action functions only
- `useAuth()`: Convenience hook combining both (for components that need both)

**Commit:** `ae6b00e` - feat(01-03): create split AuthContext for auth state management

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

All success criteria met:

- [x] `npm run build` completes without errors
- [x] Database schema defines User (email unique, passwordHash, T&C fields) and Session (token, expiresAt)
- [x] Auth helpers handle: register with T&C, authenticate, session CRUD, expired session cleanup
- [x] AuthContext checks for existing session on mount (session persistence)
- [x] Split context pattern separates state from actions
- [x] All exports are typed and compilable

**Build output:** 32 modules transformed, 195.64 KB bundle (61.73 KB gzipped)

## Key Technical Details

### Password Security

**Phase 1 Implementation:**
```typescript
// WARNING: This is NOT cryptographically secure for production
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  // ... convert to hex string
}
```

**Rationale:** Phase 1 is client-only PWA with local-device-only data. No backend, no network transmission. SHA-256 prevents plaintext storage in IndexedDB.

**Replacement:** Phase 3 will introduce backend auth with bcrypt/argon2 for production-grade security.

### Session Persistence

Sessions persist across browser restarts via IndexedDB:
1. On app mount: `cleanExpiredSessions()` → `checkExistingSession()`
2. If valid session found → restore user state
3. If session expired → clean up and show logged-out state

**Expiration:** 30 days (configurable via `createSession(userId, expiresInDays)`)

### Context Performance Optimization

**Why split contexts?**
- Component subscribing to `useAuthActions()` doesn't re-render when user state changes
- Component subscribing to `useAuthState()` doesn't re-render when actions are memoized
- Reduces unnecessary renders in large component trees

**Example:**
```typescript
// Navbar: only needs state (will re-render when user changes)
const { isSignedIn, user } = useAuthState();

// Login form: only needs actions (won't re-render when user changes)
const { signIn } = useAuthActions();

// Profile page: needs both
const { user, signOut } = useAuth();
```

## Dependencies for Next Plans

**Plan 01-04 (Auth Pages)** can now:
- Import `AuthProvider` and wrap app
- Use `useAuth()` in login/register/logout pages
- Import types from `src/db/schema.ts`

**Protected Routes** (future):
- Use `useAuthState()` to check `isSignedIn`
- Redirect to login if not authenticated

## Files Created

1. **src/db/schema.ts** - TypeScript interfaces for database entities
2. **src/db/db.ts** - Dexie database instance with table definitions
3. **src/lib/auth.ts** - Authentication helper functions
4. **src/contexts/AuthContext.tsx** - Split context provider and hooks

## Self-Check: PASSED

All claimed artifacts verified:

**Files:**
- FOUND: src/db/schema.ts
- FOUND: src/db/db.ts
- FOUND: src/lib/auth.ts
- FOUND: src/contexts/AuthContext.tsx

**Commits:**
- FOUND: b2a30ec (Task 1)
- FOUND: ae6b00e (Task 2)
