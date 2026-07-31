/**
 * Per-tab record of the builder session.
 *
 * React Router keeps `location.state` across a browser refresh, which would
 * silently restart a generation that the reload just killed. This marker lets
 * the Builder tell the three cases apart:
 *   - no marker            -> fresh navigation, start generating
 *   - marker "running"     -> the refresh terminated a generation, ask the user
 *   - marker "done"        -> reload the finished project from history instead
 *
 * sessionStorage is the right scope: it dies with the tab, and never leaks
 * between two builder tabs' independent generations.
 */

const KEY = 'forgeai:builder-session';

export interface BuilderSession {
  prompt: string;
  status: 'running' | 'done';
  projectId?: string | null;
}

export function readBuilderSession(): BuilderSession | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BuilderSession;
    return typeof parsed?.prompt === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

export function writeBuilderSession(session: BuilderSession): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    /* storage disabled - the refresh guard simply degrades to a restart */
  }
}

export function clearBuilderSession(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
