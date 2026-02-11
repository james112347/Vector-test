import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import type { User } from '../db/schema';
import {
  checkExistingSession,
  clearSession,
  createSession,
  authenticateUser,
  registerUser,
  cleanExpiredSessions,
} from '../lib/auth';

// --- Types ---

interface AuthState {
  user: User | null;
  isSignedIn: boolean;
  isLoading: boolean;
}

interface AuthActions {
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  register: (email: string, password: string, acceptedTerms: boolean) => Promise<void>;
}

// --- Contexts ---

const AuthStateContext = createContext<AuthState | null>(null);
const AuthActionsContext = createContext<AuthActions | null>(null);

// --- Provider ---

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    async function initAuth() {
      try {
        await cleanExpiredSessions();
        const result = await checkExistingSession();
        if (result) {
          setUser(result.user);
        }
      } catch (error) {
        console.error('Auth initialization failed:', error);
      } finally {
        setIsLoading(false);
      }
    }
    initAuth();
  }, []);

  // Stable actions (memoized to prevent re-renders)
  const actions = useMemo<AuthActions>(
    () => ({
      signIn: async (email: string, password: string) => {
        const authenticatedUser = await authenticateUser(email, password);
        await createSession(authenticatedUser.id!);
        setUser(authenticatedUser);
      },

      signOut: async () => {
        await clearSession();
        setUser(null);
      },

      register: async (email: string, password: string, acceptedTerms: boolean) => {
        const newUser = await registerUser(email, password, acceptedTerms);
        // Only create session if user is approved (first user / admin)
        if (newUser.isApproved) {
          await createSession(newUser.id!);
          setUser(newUser);
        }
        // If not approved, don't create session - user stays on register page
      },
    }),
    []
  );

  const state = useMemo<AuthState>(
    () => ({
      user,
      isSignedIn: !!user,
      isLoading,
    }),
    [user, isLoading]
  );

  return (
    <AuthStateContext.Provider value={state}>
      <AuthActionsContext.Provider value={actions}>
        {children}
      </AuthActionsContext.Provider>
    </AuthStateContext.Provider>
  );
}

// --- Hooks ---

export function useAuthState(): AuthState {
  const context = useContext(AuthStateContext);
  if (!context) {
    throw new Error('useAuthState must be used within an AuthProvider');
  }
  return context;
}

export function useAuthActions(): AuthActions {
  const context = useContext(AuthActionsContext);
  if (!context) {
    throw new Error('useAuthActions must be used within an AuthProvider');
  }
  return context;
}

/**
 * Convenience hook that combines state and actions.
 * Use useAuthState or useAuthActions separately if you need
 * to optimize re-renders.
 */
export function useAuth() {
  return { ...useAuthState(), ...useAuthActions() };
}
