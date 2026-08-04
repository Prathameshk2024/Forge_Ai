/**
 * A redirect sign-in throws the whole document away, so anything the user was
 * part-way through (a typed prompt, the intent to open the builder) has to
 * survive in storage rather than in React state.
 *
 * sessionStorage is the right scope: it is per-tab and clears itself when the
 * tab closes, so a half-finished intent never leaks into a later visit.
 */

const KEY = 'intellibuild:auth-intent';

export interface AuthIntent {
  /** Where the user should land once they are signed in. */
  path: string;
  /** Prompt to resume generation with, when the intent came from a prompt box. */
  prompt?: string;
}

export function saveAuthIntent(intent: AuthIntent): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(intent));
  } catch {
    // Private-mode or storage-full: the user just re-clicks after signing in.
  }
}

/** Reads and clears the intent - it must only ever be replayed once. */
export function takeAuthIntent(): AuthIntent | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<AuthIntent>;
    if (typeof parsed?.path !== 'string') return null;

    return typeof parsed.prompt === 'string'
      ? { path: parsed.path, prompt: parsed.prompt }
      : { path: parsed.path };
  } catch {
    return null;
  }
}

export function clearAuthIntent(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* nothing to clean up */
  }
}
