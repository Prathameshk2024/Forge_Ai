import { useCallback, useEffect, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import { FileItem, MentorExplanation, Step } from '../types';
import { flattenFiles } from '../lib/fileTree';
import { createProject, saveMentorExplanation, updateProject } from '../lib/projects';
import { isFirebaseConfigured } from '../lib/firebase';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface Options {
  user: User | null;
  prompt: string;
  projectName: string;
  files: FileItem[];
  steps: Step[];
  /** Only persist once generation has settled, to avoid a write per file. */
  ready: boolean;
  /** Set when the builder was opened from history - updates instead of creating. */
  initialProjectId?: string | null;
}

const DEBOUNCE_MS = 1200;

/**
 * Saves the generated project to Firestore and keeps it up to date.
 *
 * Writes are debounced and skipped when nothing changed, so follow-up chat edits
 * update the same document instead of creating duplicates.
 */
export function useProjectPersistence({
  user,
  prompt,
  projectName,
  files,
  steps,
  ready,
  initialProjectId = null,
}: Options) {
  const [projectId, setProjectId] = useState<string | null>(initialProjectId);
  const [status, setStatus] = useState<SaveStatus>('idle');

  const timer = useRef<number>();
  const lastSignature = useRef('');
  /** The debounced write, kept so unmount and page-hide can force it through. */
  const flushPending = useRef<(() => Promise<void>) | null>(null);
  const projectIdRef = useRef<string | null>(initialProjectId);
  const pendingMentor = useRef<MentorExplanation | null>(null);

  projectIdRef.current = projectId;

  useEffect(() => {
    if (initialProjectId) setProjectId(initialProjectId);
  }, [initialProjectId]);

  useEffect(() => {
    if (!isFirebaseConfigured || !user || !ready) return;

    const flat = flattenFiles(files);
    if (!flat.length) return;

    // Cheap change detector: file count + total size + step count.
    const signature = `${flat.length}:${flat.reduce((sum, f) => sum + f.content.length, 0)}:${steps.length}`;
    if (signature === lastSignature.current) return;

    const write = async () => {
      setStatus('saving');
      try {
        const payload = {
          name: projectName,
          prompt,
          files: flat,
          steps,
          fileCount: flat.length,
          mentor: pendingMentor.current,
        };

        if (projectIdRef.current) {
          await updateProject(user.uid, projectIdRef.current, payload);
        } else {
          const id = await createProject(user.uid, payload);
          projectIdRef.current = id;
          setProjectId(id);
        }
        // Recorded only after the write lands. Marking it up front meant a
        // failed save could never be retried: the next run matched the stored
        // signature and returned early, silently losing the project.
        lastSignature.current = signature;
        setStatus('saved');
      } catch (e) {
        console.error('[ForgeAI] Failed to save project', e);
        setStatus('error');
      }
    };

    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(write, DEBOUNCE_MS);
    // Lets unmount and page-hide commit the pending write instead of dropping it.
    flushPending.current = write;

    /**
     * A debounce that is only ever cancelled loses the last save. Leaving the
     * builder - or closing the tab - within DEBOUNCE_MS of generation settling
     * used to discard the project entirely, which is exactly when a user is
     * most likely to navigate away.
     */
    const flushOnHide = () => {
      if (document.visibilityState === 'hidden' && flushPending.current) {
        window.clearTimeout(timer.current);
        const pending = flushPending.current;
        flushPending.current = null;
        void pending();
      }
    };
    document.addEventListener('visibilitychange', flushOnHide);

    return () => {
      document.removeEventListener('visibilitychange', flushOnHide);
      window.clearTimeout(timer.current);
    };
  }, [files, steps, ready, user, prompt, projectName]);

  // Commit anything still pending when the builder goes away for good.
  useEffect(
    () => () => {
      const pending = flushPending.current;
      flushPending.current = null;
      void pending?.();
    },
    []
  );

  /** Persists a mentor explanation, queuing it if the document does not exist yet. */
  const persistMentor = useCallback(
    async (mentor: MentorExplanation) => {
      pendingMentor.current = mentor;
      if (!isFirebaseConfigured || !user || !projectIdRef.current) return;
      try {
        await saveMentorExplanation(user.uid, projectIdRef.current, mentor);
      } catch (e) {
        console.error('[ForgeAI] Failed to save mentor explanation', e);
      }
    },
    [user]
  );

  // Flush a mentor explanation that arrived before the document existed.
  useEffect(() => {
    if (!projectId || !user || !pendingMentor.current) return;
    saveMentorExplanation(user.uid, projectId, pendingMentor.current).catch((e) =>
      console.error('[ForgeAI] Failed to save mentor explanation', e)
    );
  }, [projectId, user]);

  return { projectId, status, persistMentor };
}
