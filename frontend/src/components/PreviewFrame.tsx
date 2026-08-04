import { WebContainer, WebContainerProcess } from '@webcontainer/api';
import { useEffect, useRef, useState } from 'react';
import { MonitorPlay, RotateCw } from 'lucide-react';
import { PreviewStatus } from '../types';
import { EmptyState, ErrorState } from './ui/States';
import { Button } from './ui/Button';

interface PreviewFrameProps {
  webContainer?: WebContainer;
  /**
   * Gate for `npm install`: package.json must be mounted first, otherwise
   * install runs against an empty filesystem.
   *
   * This opens as soon as the *template* lands, which is well before the model
   * has finished writing the project - the whole point, since it lets the
   * slowest phase of a build overlap with generation instead of following it.
   */
  canInstall?: boolean;
  /**
   * Gate for the dev server, opened once generation has settled. Kept separate
   * from `canInstall` so Vite never boots over a half-written project.
   */
  canStart?: boolean;
  onReady?: (url: string) => void;
  onStatusChange?: (status: PreviewStatus) => void;
}

/** Resolves once `predicate` holds, or bails out early if `abort` goes true. */
function waitUntil(predicate: () => boolean, abort: () => boolean): Promise<boolean> {
  if (predicate()) return Promise.resolve(true);

  return new Promise((resolve) => {
    const id = window.setInterval(() => {
      if (abort()) {
        window.clearInterval(id);
        resolve(false);
      } else if (predicate()) {
        window.clearInterval(id);
        resolve(true);
      }
    }, 100);
  });
}

const STATUS_MESSAGE: Record<PreviewStatus, string> = {
  idle: 'Waiting for the first files...',
  booting: 'Booting environment...',
  installing: 'Installing dependencies...',
  starting: 'Starting dev server...',
  ready: '',
  error: 'Something went wrong while starting the preview.',
};

export function PreviewFrame({
  webContainer,
  canInstall = true,
  canStart = true,
  onReady,
  onStatusChange,
}: PreviewFrameProps) {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<PreviewStatus>('idle');
  const [installLog, setInstallLog] = useState('');
  const [iframeKey, setIframeKey] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const hasStarted = useRef(false);

  // Callbacks live in refs so an inline arrow from the parent never restarts the
  // install / dev-server sequence on re-render.
  const statusChangeRef = useRef(onStatusChange);
  statusChangeRef.current = onStatusChange;
  const readyRef = useRef(onReady);
  readyRef.current = onReady;

  useEffect(() => {
    statusChangeRef.current?.(status);
  }, [status]);

  // Read through a ref so opening the dev-server gate never re-runs the effect.
  // Re-running would tear down the install that is already in flight.
  const canStartRef = useRef(canStart);
  canStartRef.current = canStart;

  useEffect(() => {
    if (!webContainer || !canInstall || hasStarted.current) {
      return;
    }
    hasStarted.current = true;

    let cancelled = false;
    let activeProcess: WebContainerProcess | undefined;
    let unsubscribe: (() => void) | undefined;

    async function start(container: WebContainer) {
      try {
        setStatus('installing');
        // `npm install` is the slowest phase of a build. Audit and funding
        // metadata are pure network round-trips we never surface, and the
        // container has no TTY to render progress into.
        const installProcess = await container.spawn('npm', [
          'install',
          '--no-audit',
          '--no-fund',
          '--prefer-offline',
          '--progress=false',
        ]);
        activeProcess = installProcess;
        if (cancelled) return;
        // Output must be drained (even if unused) or the process can block on backpressure.
        //
        // pipeTo returns a promise that rejects when the stream is aborted -
        // which is exactly what killing the process or tearing down the
        // container does. It settles outside this try block, so without its own
        // catch it surfaces as an uncaught "Process aborted" on every unmount.
        installProcess.output
          .pipeTo(
            new WritableStream({
              write(chunk) {
                // Keep only the tail so a failing install can explain itself.
                setInstallLog((current) => `${current}${chunk}`.slice(-2000));
              },
            })
          )
          .catch(() => {
            // Expected on teardown; a real install failure shows up in the exit code.
          });
        const installExitCode = await installProcess.exit;
        if (cancelled) return;
        if (installExitCode !== 0) {
          setStatus('error');
          return;
        }

        setStatus('starting');

        // Install ran in parallel with generation, so the model may still be
        // writing. Booting Vite now would serve a half-written project and make
        // it re-optimise on every file that lands.
        const allowed = await waitUntil(() => canStartRef.current, () => cancelled);
        if (!allowed || cancelled) return;

        const devProcess = await container.spawn('npm', ['run', 'dev']);
        activeProcess = devProcess;
        if (cancelled) {
          devProcess.kill();
          return;
        }
        // Same as above: drained purely to avoid backpressure, and its rejection
        // on teardown must be swallowed rather than left uncaught.
        devProcess.output
          .pipeTo(new WritableStream({ write() {} }))
          .catch(() => {
            /* expected when the dev server is killed */
          });

        unsubscribe = container.on('server-ready', (_port, readyUrl) => {
          if (cancelled) return;
          setUrl(readyUrl);
          setStatus('ready');
          readyRef.current?.(readyUrl);
        });
      } catch (e) {
        if (!cancelled) {
          console.error(e);
          setStatus('error');
        }
      }
    }

    start(webContainer);

    return () => {
      cancelled = true;
      unsubscribe?.();
      activeProcess?.kill();
    };
    // `canStart` is deliberately absent: it is consumed through canStartRef so
    // opening the dev-server gate cannot restart the sequence mid-install.
  }, [webContainer, canInstall, attempt]);

  return (
    <div className="h-full flex flex-col bg-gray-950 rounded-lg overflow-hidden">
      {url && (
        <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-gray-800 bg-gray-900">
          <span className="flex-1 min-w-0 truncate text-xs text-gray-500 font-mono" title={url}>
            {url}
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIframeKey((k) => k + 1)}
            title="Reload preview"
            aria-label="Reload preview"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      <div className="flex-1 min-h-0 flex items-center justify-center text-gray-400">
        {status === 'error' ? (
          <ErrorState
            title="Preview failed to start"
            message={installLog ? installLog.trim().split('\n').slice(-3).join('\n') : STATUS_MESSAGE.error}
            className="m-4"
            action={
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  // `attempt` is an effect dependency, so bumping it re-runs the
                  // install/dev-server sequence from scratch.
                  hasStarted.current = false;
                  setInstallLog('');
                  setStatus('booting');
                  setAttempt((a) => a + 1);
                }}
              >
                <RotateCw className="w-3.5 h-3.5" />
                Retry
              </Button>
            }
          />
        ) : status === 'idle' ? (
          <EmptyState
            icon={MonitorPlay}
            title="Preview not started yet"
            description="Your live site appears here as soon as the first files are generated."
          />
        ) : status !== 'ready' ? (
          <div className="text-center space-y-3">
            <div className="w-8 h-8 border-2 border-gray-800 border-t-blue-500 rounded-full animate-spin mx-auto" />
            <p className="text-sm">{STATUS_MESSAGE[status]}</p>
          </div>
        ) : null}

        {url && (
          <iframe
            key={iframeKey}
            title="Website preview"
            width="100%"
            height="100%"
            src={url}
            className="bg-white h-full"
          />
        )}
      </div>
    </div>
  );
}
