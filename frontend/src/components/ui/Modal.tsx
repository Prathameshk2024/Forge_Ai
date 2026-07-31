import { ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  /** Tailwind max-width class for the panel. */
  maxWidth?: string;
  /** Hide the close affordances when the flow must be completed. */
  dismissible?: boolean;
}

/**
 * Centered dialog rendered in a portal so it escapes any `overflow-hidden`
 * ancestor (the Builder layout has several).
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  maxWidth = 'max-w-md',
  dismissible = true,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissible) onClose();
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose, dismissible]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={dismissible ? onClose : undefined}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative w-full ${maxWidth} bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto`}
      >
        {(title || dismissible) && (
          <div className="flex items-start justify-between gap-4 p-6 pb-0">
            <div className="min-w-0">
              {title && <h2 className="text-lg font-semibold text-gray-100">{title}</h2>}
              {description && <p className="text-sm text-gray-400 mt-1">{description}</p>}
            </div>
            {dismissible && (
              <button
                onClick={onClose}
                aria-label="Close dialog"
                className="shrink-0 p-1.5 -mr-1.5 -mt-1.5 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-gray-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>,
    document.body
  );
}
