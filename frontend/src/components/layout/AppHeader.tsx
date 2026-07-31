import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '../brand/Logo';
import { APP_NAME, APP_TAGLINE } from '../../brand';
import { ThemeToggle } from '../ui/ThemeToggle';
import { UserMenu } from '../auth/UserMenu';

interface AppHeaderProps {
  /** Renders a back arrow before the logo when provided. */
  onBack?: () => void;
  /** Contextual label shown next to the brand (e.g. the current prompt). */
  context?: ReactNode;
  /** Status pills / actions rendered before the theme + account controls. */
  actions?: ReactNode;
}

/**
 * Shared application header: ForgeAI mark, wordmark and tagline on the left,
 * page actions plus theme and account controls on the right. Used by every
 * page so branding stays consistent.
 */
export function AppHeader({ onBack, context, actions }: AppHeaderProps) {
  return (
    <header className="shrink-0 bg-gray-900 border-b border-gray-800 px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        {onBack && (
          <button
            onClick={onBack}
            aria-label="Go back"
            className="shrink-0 p-1.5 -ml-1.5 rounded-lg text-gray-400 hover:text-gray-100 hover:bg-gray-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}

        <Link to="/" className="flex items-center gap-2.5 shrink-0 group" title={`${APP_NAME} - ${APP_TAGLINE}`}>
          <Logo size={34} className="transition-transform duration-200 group-hover:scale-105" />
          <span className="hidden xs:flex flex-col leading-tight">
            <span className="text-base font-semibold text-gray-100 tracking-tight">{APP_NAME}</span>
            <span className="hidden sm:block text-[10px] uppercase tracking-[0.14em] text-gray-500">
              {APP_TAGLINE}
            </span>
          </span>
        </Link>

        {context && (
          <div className="hidden md:flex items-center gap-3 min-w-0 pl-3 ml-1 border-l border-gray-800">
            {context}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {actions}
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
