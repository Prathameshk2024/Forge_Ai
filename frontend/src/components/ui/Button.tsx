import { ButtonHTMLAttributes, forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Shows a spinner and blocks interaction. */
  loading?: boolean;
  fullWidth?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-blue-600 text-white hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-500 shadow-sm shadow-blue-900/20',
  secondary:
    'bg-gray-800 text-gray-100 hover:bg-gray-700 border border-gray-700 disabled:text-gray-500',
  ghost: 'text-gray-400 hover:text-gray-100 hover:bg-gray-800 disabled:text-gray-600',
  danger: 'bg-red-600 text-white hover:bg-red-500 disabled:bg-gray-800 disabled:text-gray-500',
};

const SIZES: Record<Size, string> = {
  sm: 'text-xs px-3 py-1.5 gap-1.5 rounded-lg',
  md: 'text-sm px-4 py-2 gap-2 rounded-lg',
  lg: 'text-base px-5 py-2.5 gap-2 rounded-xl',
};

/**
 * The single button used by every new surface. Keeps focus rings, disabled
 * styling and the loading spinner consistent across the app.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, fullWidth = false, className = '', children, disabled, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center font-medium transition-all duration-150
        focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950
        disabled:cursor-not-allowed active:scale-[0.98]
        ${VARIANTS[variant]} ${SIZES[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
});
