import { ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Rendered next to the close button (actions, badges...). */
  headerActions?: ReactNode;
  children: ReactNode;
  /** Tailwind width classes for the panel. */
  width?: string;
}

/** Right-side slide-over panel. Used by the AI Mentor. */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  headerActions,
  children,
  width = 'w-full sm:w-[32rem] lg:w-[40rem]',
}: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        className={`relative ${width} h-full bg-gray-900 border-l border-gray-800 shadow-2xl flex flex-col animate-slide-in-right`}
      >
        <header className="shrink-0 flex items-start justify-between gap-4 px-6 py-4 border-b border-gray-800">
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold text-gray-100 truncate">{title}</h2>}
            {subtitle && <p className="text-xs text-gray-500 mt-0.5 truncate">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {headerActions}
            <button
              onClick={onClose}
              aria-label="Close panel"
              className="p-2 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-gray-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>
        <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
      </aside>
    </div>,
    document.body
  );
}
