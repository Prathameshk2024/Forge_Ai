import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, LayoutDashboard, LogOut, UserRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useClickOutside } from '../../hooks/useClickOutside';
import { Button } from '../ui/Button';

function initials(name: string | null, email: string | null) {
  const source = name?.trim() || email?.trim() || '?';
  return source
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

/** Avatar + dropdown with the dashboard link and logout. */
export function UserMenu() {
  const { user, initializing, isConfigured, logout, openAuthModal } = useAuth();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const toast = useToast();

  useClickOutside(containerRef, useCallback(() => setOpen(false), []), open);

  if (initializing) {
    return <div className="w-8 h-8 rounded-full bg-gray-800 animate-pulse" aria-hidden />;
  }

  if (!user) {
    return (
      <Button size="sm" variant="secondary" onClick={openAuthModal} disabled={!isConfigured}>
        <UserRound className="w-3.5 h-3.5" />
        Sign in
      </Button>
    );
  }

  async function handleLogout() {
    setOpen(false);
    try {
      await logout();
      toast.info('Signed out');
      navigate('/');
    } catch {
      toast.error('Could not sign out. Please try again.');
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full border border-gray-800 hover:border-gray-700 hover:bg-gray-800 transition-colors"
      >
        {user.photoURL ? (
          <img src={user.photoURL} alt="" className="w-7 h-7 rounded-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <span className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xs font-semibold flex items-center justify-center">
            {initials(user.displayName, user.email)}
          </span>
        )}
        <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-60 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl overflow-hidden z-50 animate-scale-in origin-top-right"
        >
          <div className="px-4 py-3 border-b border-gray-800">
            <p className="text-sm font-medium text-gray-100 truncate">{user.displayName ?? 'IntelliBuild user'}</p>
            <p className="text-xs text-gray-500 truncate">{user.email}</p>
          </div>
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false);
              navigate('/dashboard');
            }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800 hover:text-gray-100 transition-colors"
          >
            <LayoutDashboard className="w-4 h-4 text-gray-500" />
            My projects
          </button>
          <button
            role="menuitem"
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
