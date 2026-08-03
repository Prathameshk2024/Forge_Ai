import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../lib/firebase';
import { consumeGoogleRedirectResult, logout as logoutUser } from '../lib/auth';
import { AuthIntent, clearAuthIntent, saveAuthIntent } from '../lib/authIntent';
import { AuthModal } from '../components/auth/AuthModal';

interface AuthContextValue {
  user: User | null;
  /** True until Firebase has restored (or rejected) the persisted session. */
  initializing: boolean;
  isConfigured: boolean;
  logout: () => Promise<void>;
  /**
   * Guarantees a signed-in user before an action runs. Opens the login modal
   * when needed and resolves `true` once the user is authenticated, `false` if
   * they dismissed it. Resolves `true` immediately when Firebase is not
   * configured so local development is never blocked.
   */
  requireAuth: (intent?: AuthIntent) => Promise<boolean>;
  openAuthModal: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(isFirebaseConfigured);
  const [modalOpen, setModalOpen] = useState(false);

  // Holds the `requireAuth` promise resolver while the modal is open.
  const pendingGate = useRef<((allowed: boolean) => void) | null>(null);
  /** What to resume after a redirect sign-in, captured at requireAuth time. */
  const pendingIntent = useRef<AuthIntent | null>(null);

  useEffect(() => {
    if (!auth) return;
    // Fires once on load with the persisted user (or null) - this is what keeps
    // the session alive across refreshes.
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setInitializing(false);
    });
    return unsubscribe;
  }, []);

  // Google sign-in leaves the page entirely, so the credential arrives on the
  // *next* load. onAuthStateChanged already restores the session; this call is
  // what surfaces a failed redirect (unauthorised domain, blocked storage)
  // instead of silently returning the user signed-out.
  useEffect(() => {
    if (!auth) return;
    consumeGoogleRedirectResult().catch((e) => {
      // A failed redirect has nothing left to resume.
      clearAuthIntent();
      console.error('[ForgeAI] Google sign-in did not complete', e);
    });
  }, []);

  const settleGate = useCallback((allowed: boolean) => {
    pendingGate.current?.(allowed);
    pendingGate.current = null;
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    settleGate(false);
  }, [settleGate]);

  const handleAuthenticated = useCallback(
    (nextUser: User) => {
      // Resolve the gate right away instead of waiting for the auth listener,
      // so the queued action (e.g. Generate) continues without a visible delay.
      setUser(nextUser);
      setModalOpen(false);
      settleGate(true);
    },
    [settleGate]
  );

  const logout = useCallback(async () => {
    await logoutUser();
  }, []);

  const requireAuth = useCallback(
    (intent?: AuthIntent) =>
      new Promise<boolean>((resolve) => {
        if (!isFirebaseConfigured || user) {
          resolve(true);
          return;
        }
        // Only persisted if the user actually starts a redirect sign-in, so a
        // dismissed modal leaves no stale intent behind.
        pendingIntent.current = intent ?? null;
        pendingGate.current = resolve;
        setModalOpen(true);
      }),
    [user]
  );

  /**
   * The modal is about to hand the tab over to Google. This promise will never
   * settle, so persist whatever the user was trying to do before we lose it.
   */
  const handleRedirectStart = useCallback(() => {
    if (pendingIntent.current) saveAuthIntent(pendingIntent.current);
  }, []);

  const openAuthModal = useCallback(() => setModalOpen(true), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      initializing,
      isConfigured: isFirebaseConfigured,
      logout,
      requireAuth,
      openAuthModal,
    }),
    [user, initializing, logout, requireAuth, openAuthModal]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      <AuthModal
        open={modalOpen}
        onClose={closeModal}
        onAuthenticated={handleAuthenticated}
        onRedirectStart={handleRedirectStart}
      />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an <AuthProvider>');
  return ctx;
}
