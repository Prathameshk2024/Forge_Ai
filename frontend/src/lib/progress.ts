import { LifecycleTask, PreviewStatus, TaskStatus } from '../types';

const RANK: Record<PreviewStatus, number> = {
  idle: 0,
  booting: 1,
  installing: 2,
  starting: 3,
  ready: 4,
  error: 0,
};

/**
 * Maps the WebContainer preview lifecycle onto the two extra rows shown at the
 * bottom of the build sidebar ("Installing dependencies" / "Starting dev
 * server"), so environment setup is part of the same progress percentage.
 *
 * `lastActive` is the most recent non-error status; it tells us which stage an
 * error belongs to.
 */
export function lifecycleTasksFor(status: PreviewStatus, lastActive: PreviewStatus): LifecycleTask[] {
  if (status === 'idle') return [];

  const reached = RANK[status === 'error' ? lastActive : status];
  const stageStatus = (stage: number): TaskStatus => {
    if (reached > stage) return 'completed';
    if (reached === stage) return status === 'error' ? 'error' : 'in-progress';
    return 'pending';
  };

  return [
    {
      id: 'lifecycle-install',
      label: 'Dependencies installed',
      activeLabel: 'Installing dependencies',
      status: stageStatus(RANK.installing),
    },
    {
      id: 'lifecycle-server',
      label: 'Server running',
      activeLabel: 'Starting development server',
      status: stageStatus(RANK.starting),
    },
  ];
}
