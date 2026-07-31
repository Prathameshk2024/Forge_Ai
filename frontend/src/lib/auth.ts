import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
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

export async function signInWithGoogle(): Promise<User> {
  const credential = await signInWithPopup(requireAuthInstance(), googleProvider);
  return credential.user;
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
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Sign-in popup was closed before finishing.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in popup. Allow popups and try again.';
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
