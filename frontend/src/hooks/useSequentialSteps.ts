import { Dispatch, SetStateAction, useEffect, useRef } from 'react';
import { FileItem, Step, StepType } from '../types';
import { upsertFile } from '../lib/fileTree';

interface Options {
  steps: Step[];
  setSteps: Dispatch<SetStateAction<Step[]>>;
  setFiles: Dispatch<SetStateAction<FileItem[]>>;
  /**
   * How long a step stays "in-progress" before flipping to completed (ms).
   *
   * This is pure presentation, but it sits on the critical path: package.json
   * cannot mount - and so `npm install` cannot begin - until the steps ahead of
   * it have drained. At 160ms an 18-file project spent ~3s doing nothing but
   * animating.
   */
  delay?: number;
}

/**
 * Drains pending steps one at a time so the sidebar reads like a live build log:
 * exactly one task is `in-progress`, everything before it is a green check.
 *
 * The original implementation flipped every pending step to `completed` in a
 * single pass, so the user never saw the intermediate states. Here each step is
 * marked in-progress, its file is written to the tree after `delay`, and only
 * then does the next step start.
 */
export function useSequentialSteps({ steps, setSteps, setFiles, delay = 60 }: Options) {
  // Guards the effect while a step is mid-flight; without it the state updates
  // below would immediately re-enter and start every step at once.
  const busy = useRef(false);
  const timer = useRef<number>();

  useEffect(() => {
    if (busy.current) return;

    const next = steps.find((step) => step.status === 'pending');
    if (!next) return;

    busy.current = true;
    setSteps((current) =>
      current.map((step) => (step.id === next.id ? { ...step, status: 'in-progress' } : step))
    );

    timer.current = window.setTimeout(() => {
      if (next.type === StepType.CreateFile && next.path) {
        setFiles((current) => upsertFile(current, next.path!, next.code ?? ''));
      }
      setSteps((current) =>
        current.map((step) => (step.id === next.id ? { ...step, status: 'completed' } : step))
      );
      busy.current = false;
    }, delay);
  }, [steps, setSteps, setFiles, delay]);

  // Only cancels on unmount - cancelling on every re-render would kill the
  // in-flight step and stall the queue.
  useEffect(() => () => window.clearTimeout(timer.current), []);
}
