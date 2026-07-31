import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, GraduationCap, Download, History, Sparkles } from 'lucide-react';
import { AppHeader } from '../components/layout/AppHeader';
import { Logo } from '../components/brand/Logo';
import { Button } from '../components/ui/Button';
import { APP_NAME, APP_TAGLINE } from '../brand';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const EXAMPLE_PROMPTS = [
  'A portfolio site for a photographer with a gallery and contact form',
  'A landing page for a SaaS product with pricing tiers',
  'A recipe blog with search and category filters',
  'A to-do list app with due dates and priorities',
];

const HIGHLIGHTS = [
  { icon: Sparkles, label: 'Live build progress' },
  { icon: GraduationCap, label: 'AI Mentor explains every file' },
  { icon: Download, label: 'Download the full project' },
  { icon: History, label: 'Project history saved' },
];

export function Home() {
  const [prompt, setPrompt] = useState('');
  const [checkingAuth, setCheckingAuth] = useState(false);
  const navigate = useNavigate();
  const { requireAuth } = useAuth();
  const toast = useToast();

  /**
   * Generation is gated: an anonymous click opens the login modal and, once the
   * user signs in, continues straight into the builder with the same prompt.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = prompt.trim();
    if (!value || checkingAuth) return;

    setCheckingAuth(true);
    const allowed = await requireAuth();
    setCheckingAuth(false);

    if (!allowed) {
      toast.info('Sign in to start generating', 'Your projects are saved to your account.');
      return;
    }
    navigate('/builder', { state: { prompt: value } });
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      <AppHeader />

      <main className="flex-1 flex flex-col items-center justify-center p-4 py-10 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl" />
        </div>

        <div className="max-w-2xl w-full relative animate-slide-up">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center mb-6 shadow-lg shadow-blue-900/30 rounded-2xl">
              <Logo size={64} />
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-3 bg-gradient-to-r from-gray-100 to-gray-400 bg-clip-text text-transparent">
              Build a website with words
            </h1>
            <p className="text-lg text-gray-400 max-w-lg mx-auto">
              {APP_NAME} generates it, previews it live, and then teaches you exactly how it works.
            </p>
            <p className="mt-3 text-xs uppercase tracking-[0.2em] text-gray-500">{APP_TAGLINE}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl p-2 focus-within:ring-2 focus-within:ring-blue-500/60 transition-shadow">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                placeholder="Describe the website you want to build..."
                rows={4}
                className="w-full p-4 bg-transparent text-gray-100 resize-none placeholder-gray-500 focus:outline-none"
              />
              <div className="flex items-center justify-between gap-3 px-3 pb-2">
                <span className="text-xs text-gray-500 hidden sm:block">
                  Enter to generate &middot; Shift+Enter for a new line
                </span>
                <Button type="submit" size="lg" disabled={!prompt.trim()} loading={checkingAuth} className="ml-auto">
                  Generate
                  {!checkingAuth && <ArrowRight className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </form>

          <div className="mt-6">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              Try one of these
            </div>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_PROMPTS.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setPrompt(example)}
                  className="text-sm text-left text-gray-300 bg-gray-900 border border-gray-800 rounded-full px-4 py-2 hover:border-gray-600 hover:bg-gray-800 transition-colors"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          <ul className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {HIGHLIGHTS.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="flex flex-col items-center text-center gap-2 p-3 rounded-xl border border-gray-800/80 bg-gray-900/50"
              >
                <Icon className="w-4 h-4 text-blue-400" />
                <span className="text-[11px] leading-snug text-gray-400">{label}</span>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}
