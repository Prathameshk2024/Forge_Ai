import { useEffect, useRef } from 'react';
import { CheckCircle2, Loader2, ListChecks, XCircle } from 'lucide-react';
import { LifecycleTask, Step, TaskStatus } from '../types';
import { ProgressBar } from './ui/States';

interface StepsListProps {
  steps: Step[];
  currentStep: number;
  onStepClick: (stepId: number) => void;
  /** Environment tasks (install, dev server) appended after the file steps. */
  lifecycle?: LifecycleTask[];
  /** Whether a generation request is still streaming in more steps. */
  isBuilding?: boolean;
}

interface Row {
  key: string;
  label: string;
  status: TaskStatus;
  stepId?: number;
}

/**
 * Live build log. Renders completed tasks as green checkmarks and at most one
 * active task with a spinner; anything still queued is collapsed into a single
 * muted line so the panel always reads "what is happening right now".
 */
export function StepsList({ steps, currentStep, onStepClick, lifecycle = [], isBuilding = false }: StepsListProps) {
  const activeRef = useRef<HTMLDivElement>(null);

  const rows: Row[] = [
    ...steps.map<Row>((step) => ({
      key: `step-${step.id}`,
      label: step.title,
      status: step.status,
      stepId: step.id,
    })),
    ...lifecycle.map<Row>((task) => ({
      key: task.id,
      label: task.status === 'in-progress' ? task.activeLabel : task.label,
      status: task.status,
    })),
  ];

  const total = rows.length;
  const completed = rows.filter((row) => row.status === 'completed').length;
  const active = rows.find((row) => row.status === 'in-progress');
  const failed = rows.some((row) => row.status === 'error');

  // While building, the trailing queue is hidden behind a counter; once every
  // task settles the full list is shown as a build summary.
  const visible = isBuilding || active ? rows.filter((row) => row.status !== 'pending') : rows;
  const queued = total - visible.length;

  // A raw percentage would jump to 100% between chat responses, so an unfinished
  // build is capped at 99%.
  const rawPercent = total ? Math.round((completed / total) * 100) : 0;
  const percent = isBuilding || active ? Math.min(rawPercent, 99) : rawPercent;

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [active?.key]);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg shadow-lg h-full flex flex-col overflow-hidden">
      <div className="shrink-0 px-4 py-3 border-b border-gray-800">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-gray-100 flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-gray-400" />
            Build Progress
          </h2>
          {total > 0 && (
            <span
              className={`text-xs font-medium tabular-nums ${
                percent === 100 ? 'text-green-400' : 'text-blue-400'
              }`}
            >
              {percent}%
            </span>
          )}
        </div>
        {total > 0 && (
          <>
            <ProgressBar value={percent} className="mt-3" />
            <p className="text-[11px] text-gray-500 mt-1.5">
              {completed} of {total} tasks complete
            </p>
          </>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1">
        {total === 0 && (
          <p className="text-sm text-gray-500 px-1 py-2">
            {isBuilding ? 'Planning your project...' : 'Steps will appear here once generation starts.'}
          </p>
        )}

        {visible.map((row) => {
          const isActive = row.status === 'in-progress';
          const selectable = row.stepId !== undefined;
          return (
            <div
              key={row.key}
              ref={isActive ? activeRef : undefined}
              onClick={selectable ? () => onStepClick(row.stepId!) : undefined}
              className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg border transition-colors animate-fade-in ${
                selectable ? 'cursor-pointer' : ''
              } ${
                isActive
                  ? 'bg-blue-500/10 border-blue-500/30'
                  : selectable && currentStep === row.stepId
                  ? 'bg-gray-800 border-gray-700'
                  : 'border-transparent hover:bg-gray-800/60'
              }`}
            >
              {row.status === 'completed' ? (
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
              ) : row.status === 'error' ? (
                <XCircle className="w-4 h-4 text-red-500 shrink-0" />
              ) : isActive ? (
                <Loader2 className="w-4 h-4 text-blue-400 shrink-0 animate-spin" />
              ) : (
                <span className="w-4 h-4 shrink-0 rounded-full border border-gray-700" />
              )}
              <span
                className={`text-sm truncate ${
                  row.status === 'completed'
                    ? 'text-gray-400'
                    : row.status === 'error'
                    ? 'text-red-300'
                    : isActive
                    ? 'text-gray-100 font-medium'
                    : 'text-gray-500'
                }`}
                title={row.label}
              >
                {row.label}
              </span>
            </div>
          );
        })}

        {queued > 0 && (
          <p className="text-xs text-gray-600 px-2 pt-1">
            +{queued} task{queued > 1 ? 's' : ''} queued
          </p>
        )}

        {failed && (
          <p className="text-xs text-red-400 px-2 pt-1">A task failed. Check the preview panel for details.</p>
        )}
      </div>
    </div>
  );
}
