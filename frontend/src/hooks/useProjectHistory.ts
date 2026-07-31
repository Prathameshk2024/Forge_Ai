import { useCallback, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { StoredProject } from '../types';
import { deleteProject, listProjects } from '../lib/projects';
import { isFirebaseConfigured } from '../lib/firebase';

/** Loads the signed-in user's saved projects for the dashboard. */
export function useProjectHistory(user: User | null) {
  const [projects, setProjects] = useState<StoredProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!isFirebaseConfigured || !user) {
      setProjects([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      setProjects(await listProjects(user.uid));
    } catch (e) {
      console.error('[ForgeAI] Failed to load project history', e);
      setError('Could not load your projects. Check your connection and Firestore rules.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const remove = useCallback(
    async (projectId: string) => {
      if (!user) return;
      // Optimistic: the row disappears immediately, restored on failure.
      const previous = projects;
      setProjects((current) => current.filter((p) => p.id !== projectId));
      try {
        await deleteProject(user.uid, projectId);
      } catch (e) {
        console.error('[ForgeAI] Failed to delete project', e);
        setProjects(previous);
        throw e;
      }
    },
    [user, projects]
  );

  return { projects, loading, error, refresh, remove };
}
