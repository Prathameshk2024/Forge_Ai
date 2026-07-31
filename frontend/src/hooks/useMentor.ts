import { useCallback, useEffect, useRef, useState } from 'react';
import { FileItem, MentorExplanation } from '../types';
import { extractErrorMessage, fetchMentorExplanation, isCancelled } from '../lib/api';
import { flattenFiles } from '../lib/fileTree';

interface UseMentorOptions {
  prompt: string;
  projectName: string;
  files: FileItem[];
  /** Explanation loaded from project history, used instead of re-asking Gemini. */
  initialExplanation?: MentorExplanation | null;
  onExplained?: (explanation: MentorExplanation) => void;
}

/**
 * Owns the AI Mentor request lifecycle: one in-flight request at a time, the
 * result cached for the session, and an explicit `regenerate` for when the
 * project changed after the first explanation.
 */
export function useMentor({ prompt, projectName, files, initialExplanation, onExplained }: UseMentorOptions) {
  const [explanation, setExplanation] = useState<MentorExplanation | null>(initialExplanation ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const controllerRef = useRef<AbortController | null>(null);

  // A project restored from history arrives after the first render.
  useEffect(() => {
    if (initialExplanation) setExplanation(initialExplanation);
  }, [initialExplanation]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const explain = useCallback(
    async ({ force = false } = {}) => {
      if (loading) return;
      if (explanation && !force) return;

      const flat = flattenFiles(files);
      if (!flat.length) {
        setError('There are no generated files to explain yet.');
        return;
      }

      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;

      setLoading(true);
      setError('');
      try {
        const result = await fetchMentorExplanation(
          { prompt, projectName, files: flat },
          controller.signal
        );
        setExplanation(result);
        onExplained?.(result);
      } catch (e) {
        if (isCancelled(e)) return;
        setError(extractErrorMessage(e, 'The AI Mentor could not explain this project. Please try again.'));
      } finally {
        if (controllerRef.current === controller) setLoading(false);
      }
    },
    [loading, explanation, files, prompt, projectName, onExplained]
  );

  return { explanation, loading, error, explain, setExplanation };
}
