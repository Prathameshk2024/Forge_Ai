import { FormEvent, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { Lock, Mail, UserRound } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Logo } from '../brand/Logo';
import { APP_NAME } from '../../brand';
import { isFirebaseConfigured } from '../../lib/firebase';
import {
  mapAuthError,
  resetPassword,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
} from '../../lib/auth';
import { useToast } from '../../context/ToastContext';

type Mode = 'signin' | 'signup' | 'reset';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  /** Called with the freshly authenticated user so queued actions can resume. */
  onAuthenticated: (user: User) => void;
}

const COPY: Record<Mode, { title: string; description: string; submit: string }> = {
  signin: {
    title: `Sign in to ${APP_NAME}`,
    description: 'Sign in to generate projects, save them and open the AI Mentor.',
    submit: 'Sign in',
  },
  signup: {
    title: `Create your ${APP_NAME} account`,
    description: 'Your generated projects and mentor explanations are saved to your account.',
    submit: 'Create account',
  },
  reset: {
    title: 'Reset your password',
    description: "We'll email you a link to choose a new password.",
    submit: 'Send reset link',
  },
};

function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.06 12.25c0-.85-.08-1.67-.22-2.45H12v4.64h6.2a5.3 5.3 0 0 1-2.3 3.48v2.9h3.72c2.18-2 3.44-4.96 3.44-8.57Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.1 0 5.7-1.03 7.62-2.78l-3.72-2.9c-1.03.7-2.35 1.11-3.9 1.11-3 0-5.54-2.02-6.45-4.74H1.7v2.98A11.5 11.5 0 0 0 12 24Z"
      />
      <path fill="#FBBC05" d="M5.55 14.69a6.9 6.9 0 0 1 0-4.38V7.33H1.7a11.5 11.5 0 0 0 0 10.34l3.85-2.98Z" />
      <path
        fill="#EA4335"
        d="M12 4.75c1.69 0 3.2.58 4.4 1.72l3.29-3.29C17.7 1.2 15.1 0 12 0 7.5 0 3.6 2.58 1.7 6.33l3.85 2.98C6.46 6.77 9 4.75 12 4.75Z"
      />
    </svg>
  );
}

/**
 * Google + Email/Password sign-in. Rendered once by the AuthProvider so any
 * gated action (Generate, Save, Mentor...) can raise it on demand.
 */
export function AuthModal({ open, onClose, onAuthenticated }: AuthModalProps) {
  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'google' | 'email' | null>(null);
  const toast = useToast();

  // Reset transient state whenever the modal is (re)opened.
  useEffect(() => {
    if (open) {
      setError('');
      setBusy(null);
      setPassword('');
    }
  }, [open]);

  const copy = COPY[mode];

  async function handleGoogle() {
    setError('');
    setBusy('google');
    try {
      const user = await signInWithGoogle();
      toast.success(`Welcome, ${user.displayName ?? 'friend'}!`);
      onAuthenticated(user);
    } catch (e) {
      setError(mapAuthError(e));
    } finally {
      setBusy(null);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy('email');
    try {
      if (mode === 'reset') {
        await resetPassword(email);
        toast.success('Reset link sent', `Check ${email} for the email.`);
        setMode('signin');
        return;
      }
      const user =
        mode === 'signin'
          ? await signInWithEmail(email, password)
          : await signUpWithEmail(name, email, password);
      toast.success(mode === 'signin' ? 'Signed in' : 'Account created');
      onAuthenticated(user);
    } catch (e) {
      setError(mapAuthError(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-sm">
      <div className="flex flex-col items-center text-center mb-6">
        <Logo size={44} className="mb-3" />
        <h2 className="text-lg font-semibold text-gray-100">{copy.title}</h2>
        <p className="text-sm text-gray-400 mt-1">{copy.description}</p>
      </div>

      {!isFirebaseConfigured && (
        <p className="mb-4 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
          Firebase is not configured yet. Copy <code>frontend/.env.example</code> to{' '}
          <code>frontend/.env</code> and add your project keys to enable sign-in.
        </p>
      )}

      {mode !== 'reset' && (
        <>
          <Button
            type="button"
            variant="secondary"
            fullWidth
            size="lg"
            loading={busy === 'google'}
            disabled={busy !== null}
            onClick={handleGoogle}
          >
            {busy !== 'google' && <GoogleIcon />}
            Continue with Google
          </Button>

          <div className="flex items-center gap-3 my-5">
            <span className="h-px flex-1 bg-gray-800" />
            <span className="text-xs text-gray-500">or</span>
            <span className="h-px flex-1 bg-gray-800" />
          </div>
        </>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        {mode === 'signup' && (
          <Field
            icon={<UserRound className="w-4 h-4" />}
            type="text"
            placeholder="Your name"
            value={name}
            onChange={setName}
            autoComplete="name"
          />
        )}
        <Field
          icon={<Mail className="w-4 h-4" />}
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          required
        />
        {mode !== 'reset' && (
          <Field
            icon={<Lock className="w-4 h-4" />}
            type="password"
            placeholder="Password"
            value={password}
            onChange={setPassword}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            required
            minLength={6}
          />
        )}

        {error && (
          <p role="alert" className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <Button type="submit" fullWidth size="lg" loading={busy === 'email'} disabled={busy !== null}>
          {copy.submit}
        </Button>
      </form>

      <div className="mt-5 flex flex-col items-center gap-2 text-xs text-gray-500">
        {mode === 'signin' && (
          <>
            <button type="button" className="hover:text-gray-300 transition-colors" onClick={() => setMode('reset')}>
              Forgot your password?
            </button>
            <p>
              New here?{' '}
              <button type="button" className="text-blue-400 hover:text-blue-300" onClick={() => setMode('signup')}>
                Create an account
              </button>
            </p>
          </>
        )}
        {mode !== 'signin' && (
          <p>
            Already have an account?{' '}
            <button type="button" className="text-blue-400 hover:text-blue-300" onClick={() => setMode('signin')}>
              Sign in
            </button>
          </p>
        )}
      </div>
    </Modal>
  );
}

interface FieldProps {
  icon: React.ReactNode;
  type: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
}

function Field({ icon, type, placeholder, value, onChange, ...rest }: FieldProps) {
  return (
    <label className="flex items-center gap-3 bg-gray-950 border border-gray-800 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-blue-500/50 transition-shadow">
      <span className="text-gray-500 shrink-0">{icon}</span>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-transparent text-sm text-gray-100 placeholder-gray-500 focus:outline-none min-w-0"
        {...rest}
      />
    </label>
  );
}
