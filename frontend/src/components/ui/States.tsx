import { ReactNode } from 'react';
import { AlertTriangle, LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/** Friendly placeholder for panels with nothing to show yet. */
export function EmptyState({ icon: Icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`h-full flex flex-col items-center justify-center text-center px-6 py-10 gap-3 ${className}`}>
      <div className="w-12 h-12 rounded-xl bg-gray-800 flex items-center justify-center">
        <Icon className="w-5 h-5 text-gray-500" />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-300">{title}</p>
        {description && <p className="text-xs text-gray-500 mt-1 max-w-xs">{description}</p>}
      </div>
      {action}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  message: string;
  action?: ReactNode;
  className?: string;
}

/** Inline error panel with an optional retry action. */
export function ErrorState({ title = 'Something went wrong', message, action, className = '' }: ErrorStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center px-6 py-8 gap-3 rounded-xl border border-red-500/30 bg-red-500/5 ${className}`}
    >
      <div className="w-11 h-11 rounded-xl bg-red-500/10 flex items-center justify-center">
        <AlertTriangle className="w-5 h-5 text-red-400" />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-100">{title}</p>
        <p className="text-xs text-gray-400 mt-1 max-w-sm">{message}</p>
      </div>
      {action}
    </div>
  );
}

/** Thin animated progress bar used by the build sidebar and mentor loading state. */
export function ProgressBar({ value, className = '' }: { value: number; className?: string }) {
  return (
    <div className={`h-1.5 w-full bg-gray-800 rounded-full overflow-hidden ${className}`}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

/** Content placeholder with a shimmer sweep. */
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-md bg-gray-800 ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-gray-700/60 to-transparent" />
    </div>
  );
}
