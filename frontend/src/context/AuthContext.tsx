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
import { logout as logoutUser } from '../lib/auth';
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
  requireAuth: () => Promise<boolean>;
  openAuthModal: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(isFirebaseConfigured);
  const [modalOpen, setModalOpen] = useState(false);

  // Holds the `requireAuth` promise resolver while the modal is open.
  const pendingGate = useRef<((allowed: boolean) => void) | null>(null);

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
    () =>
      new Promise<boolean>((resolve) => {
        if (!isFirebaseConfigured || user) {
          resolve(true);
          return;
        }
        pendingGate.current = resolve;
        setModalOpen(true);
      }),
    [user]
  );

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
      <AuthModal open={modalOpen} onClose={closeModal} onAuthenticated={handleAuthenticated} />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an <AuthProvider>');
  return ctx;
}
