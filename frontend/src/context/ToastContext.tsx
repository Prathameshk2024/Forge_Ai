import { createContext, useCallback, useContext, useMemo, useRef, useState, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
  /** Optional secondary line, e.g. an error detail. */
  detail?: string;
}

interface ToastContextValue {
  toast: {
    success: (message: string, detail?: string) => void;
    error: (message: string, detail?: string) => void;
    info: (message: string, detail?: string) => void;
    warning: (message: string, detail?: string) => void;
  };
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DURATION = 4500;

const STYLES: Record<ToastVariant, { icon: typeof Info; accent: string; ring: string }> = {
  success: { icon: CheckCircle2, accent: 'text-green-400', ring: 'ring-green-500/20' },
  error: { icon: XCircle, accent: 'text-red-400', ring: 'ring-red-500/20' },
  info: { icon: Info, accent: 'text-blue-400', ring: 'ring-blue-500/20' },
  warning: { icon: AlertTriangle, accent: 'text-amber-400', ring: 'ring-amber-500/20' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (variant: ToastVariant, message: string, detail?: string) => {
      const id = nextId.current++;
      setToasts((current) => [...current.slice(-3), { id, message, variant, detail }]);
      window.setTimeout(() => dismiss(id), DURATION);
    },
    [dismiss]
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      dismiss,
      toast: {
        success: (m, d) => push('success', m, d),
        error: (m, d) => push('error', m, d),
        info: (m, d) => push('info', m, d),
        warning: (m, d) => push('warning', m, d),
      },
    }),
    [push, dismiss]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 w-[min(22rem,calc(100vw-2rem))]">
          {toasts.map((t) => {
            const { icon: Icon, accent, ring } = STYLES[t.variant];
            return (
              <div
                key={t.id}
                role="status"
                className={`flex items-start gap-3 bg-gray-900 border border-gray-800 ring-1 ${ring} rounded-xl shadow-2xl px-4 py-3 animate-slide-up`}
              >
                <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${accent}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-100 break-words">{t.message}</p>
                  {t.detail && <p className="text-xs text-gray-500 mt-0.5 break-words">{t.detail}</p>}
                </div>
                <button
                  onClick={() => dismiss(t.id)}
                  aria-label="Dismiss notification"
                  className="shrink-0 text-gray-600 hover:text-gray-300 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a <ToastProvider>');
  return ctx.toast;
}
