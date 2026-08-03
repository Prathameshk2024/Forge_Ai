import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithRedirect,
  signOut,
  updateProfile,
  User,
} from 'firebase/auth';
import { auth, googleProvider } from './firebase';

/**
 * Thin wrappers around the Firebase Auth SDK. Kept free of React so both the
 * AuthProvider and the AuthModal can use them without importing each other.
 */

function requireAuthInstance() {
  if (!auth) {
    throw Object.assign(new Error('Firebase is not configured.'), { code: 'auth/not-configured' });
  }
  return auth;
}

/**
 * Google sign-in via full-page redirect rather than a popup.
 *
 * The builder needs `Cross-Origin-Opener-Policy: same-origin` so WebContainer
 * gets the cross-origin isolation SharedArrayBuffer requires. That header puts
 * any popup in a separate browsing context group, which severs `window.opener`
 * and leaves `signInWithPopup` unable to hand the credential back - it hangs or
 * throws instead. A top-level navigation is unaffected by COOP, so redirect is
 * the only popup-free flow that works on a cross-origin-isolated page.
 *
 * Never resolves on success: the document is replaced. The result is picked up
 * on the way back by `consumeGoogleRedirectResult`.
 */
export async function startGoogleSignIn(): Promise<void> {
  await signInWithRedirect(requireAuthInstance(), googleProvider);
}

/**
 * Completes a redirect sign-in after the browser lands back on the app.
 * Returns the user when this load followed a sign-in, `null` on a normal load.
 */
export async function consumeGoogleRedirectResult(): Promise<User | null> {
  if (!auth) return null;
  const credential = await getRedirectResult(auth);
  return credential?.user ?? null;
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const credential = await signInWithEmailAndPassword(requireAuthInstance(), email.trim(), password);
  return credential.user;
}

export async function signUpWithEmail(name: string, email: string, password: string): Promise<User> {
  const credential = await createUserWithEmailAndPassword(requireAuthInstance(), email.trim(), password);
  if (name.trim()) {
    await updateProfile(credential.user, { displayName: name.trim() });
  }
  return credential.user;
}

export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(requireAuthInstance(), email.trim());
}

export async function logout(): Promise<void> {
  if (!auth) return;
  await signOut(auth);
}

/** Turns Firebase error codes into copy a human can act on. */
export function mapAuthError(error: unknown): string {
  const code = (error as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/not-configured':
      return 'Firebase is not configured. Add your keys to frontend/.env to enable sign-in.';
    case 'auth/invalid-email':
      return 'That email address looks invalid.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password.';
    case 'auth/email-already-in-use':
      return 'An account already exists with this email. Try signing in instead.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/unauthorized-domain':
      return 'This domain is not authorised in Firebase. Add it under Authentication -> Settings -> Authorized domains.';
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with this email using a different sign-in method. Sign in that way instead.';
    case 'auth/web-storage-unsupported':
      return 'Your browser is blocking site storage, which sign-in needs. Allow cookies for this site and try again.';
    case 'auth/redirect-cancelled-by-user':
      return 'Sign-in was cancelled before finishing.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/operation-not-allowed':
      return 'This sign-in method is not enabled in the Firebase console.';
    default:
      return (error as Error)?.message ?? 'Authentication failed. Please try again.';
  }
}
