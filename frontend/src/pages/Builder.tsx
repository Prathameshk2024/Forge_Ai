import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  CloudOff,
  Download,
  ExternalLink,
  GraduationCap,
  Loader2,
  RotateCw,
  Send,
} from 'lucide-react';
import { StepsList } from '../components/StepsList';
import { FileExplorer } from '../components/FileExplorer';
import { TabView } from '../components/TabView';
import { CodeEditor } from '../components/CodeEditor';
import { PreviewFrame } from '../components/PreviewFrame';
import { AppHeader } from '../components/layout/AppHeader';
import { Button } from '../components/ui/Button';
import { MentorDrawer } from '../components/mentor/MentorDrawer';
import { FileItem, MentorExplanation, PreviewStatus, Step } from '../types';
import { parseXml } from '../steps';
import { useWebContainer } from '../hooks/useWebContainer';
import { useSequentialSteps } from '../hooks/useSequentialSteps';
import { useMentor } from '../hooks/useMentor';
import { useProjectPersistence } from '../hooks/useProjectPersistence';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ChatMessage, extractErrorMessage, fetchTemplate, isCancelled, sendChat } from '../lib/api';
import { buildTreeFromFlat, toMountStructure } from '../lib/fileTree';
import { lifecycleTasksFor } from '../lib/progress';
import { downloadProjectZip } from '../lib/exportProject';
import { projectDisplayName, slugifyProjectName } from '../lib/naming';
import { clearBuilderSession, readBuilderSession, writeBuilderSession } from '../lib/builderSession';
import { getProject } from '../lib/projects';
import { isFirebaseConfigured } from '../lib/firebase';

function nextStepId(steps: Step[]) {
  return steps.length ? Math.max(...steps.map((s) => s.id)) + 1 : 1;
}

interface BuilderRouteState {
  prompt?: string;
  /** Set when the builder is opened from the dashboard. */
  projectId?: string;
}

export function Builder() {
  const location = useLocation();
  const navigate = useNavigate();
  const routeState = (location.state as BuilderRouteState | null) ?? {};

  const { user, initializing, requireAuth } = useAuth();
  const toast = useToast();
  const webcontainer = useWebContainer();

  const [prompt, setProjectPrompt] = useState(routeState.prompt ?? '');
  const [steps, setSteps] = useState<Step[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [llmMessages, setLlmMessages] = useState<ChatMessage[]>([]);
  const [userPrompt, setUserPrompt] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  /** A refresh killed the generation that was running in this tab. */
  const [interrupted, setInterrupted] = useState(false);
  const [restoring, setRestoring] = useState(Boolean(routeState.projectId));
  const [restoredProjectId, setRestoredProjectId] = useState<string | null>(routeState.projectId ?? null);
  const [restoredMentor, setRestoredMentor] = useState<MentorExplanation | null>(null);

  const [activeTab, setActiveTab] = useState<'code' | 'preview'>('code');
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [currentStep, setCurrentStep] = useState(1);

  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>('idle');
  const [previewUrl, setPreviewUrl] = useState('');
  const [mountReady, setMountReady] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [mentorOpen, setMentorOpen] = useState(false);

  const lastActivePreview = useRef<PreviewStatus>('idle');
  if (previewStatus !== 'error') lastActivePreview.current = previewStatus;

  const projectName = useMemo(() => projectDisplayName(prompt), [prompt]);

  // Tracks the one generation request allowed to be in flight. Starting a new
  // request aborts whichever one is currently running; unmounting aborts it too.
  const activeRequest = useRef<AbortController | null>(null);

  function beginRequest() {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    return controller;
  }

  useEffect(() => {
    return () => {
      activeRequest.current?.abort();
      // Leaving the builder on purpose ends the session; a refresh does not run
      // this cleanup, which is exactly how the refresh guard detects a reload.
      clearBuilderSession();
    };
  }, []);

  // Steps are drained one at a time, writing their file into the tree as they
  // complete - this is what makes the sidebar behave like a live build log.
  useSequentialSteps({ steps, setSteps, setFiles });

  // Mount the generated tree into the WebContainer whenever it changes.
  useEffect(() => {
    if (!files.length || !webcontainer) return;
    let cancelled = false;

    webcontainer
      .mount(toMountStructure(files))
      .then(() => {
        // `npm install` may only start once package.json is actually on disk.
        if (!cancelled && files.some((file) => file.name === 'package.json')) setMountReady(true);
      })
      .catch((e) => console.error('[ForgeAI] Failed to mount project', e));

    return () => {
      cancelled = true;
    };
  }, [files, webcontainer]);

  const runGeneration = useCallback(
    async (promptText: string) => {
      const controller = beginRequest();
      setError('');
      setInterrupted(false);
      setLoading(true);
      writeBuilderSession({ prompt: promptText, status: 'running' });

      try {
        const { prompts, uiPrompts } = await fetchTemplate(promptText, controller.signal);

        setSteps(parseXml(uiPrompts[0]).map((step) => ({ ...step, status: 'pending' as const })));

        const conversation: ChatMessage[] = [...prompts, promptText].map((content) => ({
          role: 'user' as const,
          content,
        }));
        const response = await sendChat(conversation, controller.signal);

        setSteps((current) => [
          ...current,
          ...parseXml(response).map((step, index) => ({
            ...step,
            id: nextStepId(current) + index,
            status: 'pending' as const,
          })),
        ]);
        setLlmMessages([...conversation, { role: 'assistant', content: response }]);
        toast.success('Project generated', 'Installing dependencies and starting the preview.');
      } catch (e) {
        if (isCancelled(e)) return;
        const message = extractErrorMessage(
          e,
          'Something went wrong while generating the project. Please try again.'
        );
        setError(message);
        toast.error('Generation failed', message);
      } finally {
        if (activeRequest.current === controller) setLoading(false);
      }
    },
    [toast]
  );

  /** Loads a saved project from history instead of generating a new one. */
  const restoreProject = useCallback(
    async (projectId: string, uid: string) => {
      setRestoring(true);
      setError('');
      try {
        const project = await getProject(uid, projectId);
        if (!project) {
          setError('That project could not be found. It may have been deleted.');
          return;
        }
        setProjectPrompt(project.prompt);
        setFiles(buildTreeFromFlat(project.files));
        setSteps(project.steps.map((step) => ({ ...step, status: 'completed' as const })));
        setRestoredMentor(project.mentor);
        // Seed the conversation so follow-up requests still have the original intent.
        setLlmMessages(project.prompt ? [{ role: 'user', content: project.prompt }] : []);
        writeBuilderSession({ prompt: project.prompt, status: 'done', projectId });
        toast.info('Project restored', `${project.fileCount} files loaded from your history.`);
      } catch (e) {
        console.error('[ForgeAI] Failed to restore project', e);
        setError('Could not load that project. Check your connection and try again.');
      } finally {
        setRestoring(false);
      }
    },
    [toast]
  );

  // Entry point: restore, resume-after-refresh, or generate.
  const bootstrapped = useRef(false);
  useEffect(() => {
    if (bootstrapped.current || initializing) return;

    const openFromHistory = routeState.projectId;
    const requestedPrompt = routeState.prompt?.trim();

    if (!openFromHistory && !requestedPrompt) {
      navigate('/');
      return;
    }
    bootstrapped.current = true;

    if (openFromHistory) {
      if (!user) {
        setRestoring(false);
        setError('Sign in to open a project from your history.');
        return;
      }
      restoreProject(openFromHistory, user.uid);
      return;
    }

    const session = readBuilderSession();
    if (session && session.prompt === requestedPrompt) {
      // This tab already ran (or was running) this exact prompt.
      if (session.status === 'done' && session.projectId && user) {
        setRestoredProjectId(session.projectId);
        restoreProject(session.projectId, user.uid);
      } else {
        setInterrupted(true);
      }
      return;
    }

    (async () => {
      // Generation always requires a signed-in user; the modal resolves this.
      const allowed = await requireAuth();
      if (!allowed) {
        setError('Sign in to generate this project.');
        return;
      }
      runGeneration(requestedPrompt!);
    })();
  }, [initializing, user, routeState.projectId, routeState.prompt, navigate, requireAuth, restoreProject, runGeneration]);

  async function sendMessage() {
    const trimmed = userPrompt.trim();
    if (!trimmed || loading) return;

    const allowed = await requireAuth();
    if (!allowed) return;

    const newMessage: ChatMessage = { role: 'user', content: trimmed };
    const controller = beginRequest();
    try {
      setError('');
      setLoading(true);
      const response = await sendChat([...llmMessages, newMessage], controller.signal);

      setLlmMessages((current) => [...current, newMessage, { role: 'assistant', content: response }]);
      setSteps((current) => [
        ...current,
        ...parseXml(response).map((step, index) => ({
          ...step,
          id: nextStepId(current) + index,
          status: 'pending' as const,
        })),
      ]);
      setUserPrompt('');
    } catch (e) {
      if (isCancelled(e)) return;
      const message = extractErrorMessage(e, 'Failed to send message. Please try again.');
      setError(message);
      toast.error('Update failed', message);
    } finally {
      if (activeRequest.current === controller) setLoading(false);
    }
  }

  const hasPendingSteps = steps.some((step) => step.status !== 'completed');
  const isBuilding = loading || restoring || hasPendingSteps;
  const previewReady = previewStatus === 'ready';
  const settled = !loading && !restoring && !hasPendingSteps && files.length > 0;

  // --- Project history -------------------------------------------------------
  const { projectId, status: saveStatus, persistMentor } = useProjectPersistence({
    user,
    prompt,
    projectName,
    files,
    steps,
    ready: settled,
    initialProjectId: restoredProjectId,
  });

  // Once the project is saved, a refresh reloads it instead of regenerating.
  useEffect(() => {
    if (settled && prompt) {
      writeBuilderSession({ prompt, status: 'done', projectId });
    }
  }, [settled, prompt, projectId]);

  // --- AI Mentor -------------------------------------------------------------
  const { explanation, loading: mentorLoading, error: mentorError, explain } = useMentor({
    prompt,
    projectName,
    files,
    initialExplanation: restoredMentor,
    onExplained: persistMentor,
  });

  function openMentor() {
    setMentorOpen(true);
    explain();
  }

  // --- Download --------------------------------------------------------------
  async function handleDownload() {
    setDownloading(true);
    try {
      const count = await downloadProjectZip({
        webContainer: webcontainer,
        files,
        projectName: slugifyProjectName(projectName),
      });
      toast.success('Download ready', `${count} files packaged into a ZIP.`);
    } catch (e) {
      toast.error('Download failed', (e as Error).message);
    } finally {
      setDownloading(false);
    }
  }

  const lifecycle = lifecycleTasksFor(previewStatus, lastActivePreview.current);

  return (
    <div className="h-screen bg-gray-950 flex flex-col overflow-hidden">
      <AppHeader
        onBack={() => navigate('/')}
        context={
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-200 truncate max-w-xs" title={projectName}>
              {projectName}
            </p>
            <p className="text-xs text-gray-500 truncate max-w-xs" title={prompt}>
              {prompt}
            </p>
          </div>
        }
        actions={
          <>
            <span className="hidden lg:block">
              {isBuilding ? (
                <span className="flex items-center gap-2 text-xs text-blue-400 bg-blue-500/10 px-3 py-1.5 rounded-full">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Building...
                </span>
              ) : previewReady ? (
                <span className="flex items-center gap-2 text-xs text-green-400 bg-green-500/10 px-3 py-1.5 rounded-full">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Ready
                </span>
              ) : null}
            </span>

            {previewUrl && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => window.open(previewUrl, '_blank', 'noopener,noreferrer')}
                title="Open the running preview in a new tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden xl:inline">Open in New Tab</span>
              </Button>
            )}

            <Button
              size="sm"
              variant="secondary"
              onClick={handleDownload}
              loading={downloading}
              disabled={!files.length || downloading}
              title="Download the whole project as a ZIP"
            >
              {!downloading && <Download className="w-3.5 h-3.5" />}
              <span className="hidden xl:inline">Download</span>
            </Button>

            <Button
              size="sm"
              onClick={openMentor}
              disabled={!files.length || isBuilding}
              title="Let the AI Mentor explain this project"
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">AI Mentor</span>
            </Button>
          </>
        }
      />

      {isFirebaseConfigured && user && saveStatus === 'error' && (
        <div className="shrink-0 flex items-center gap-2 bg-amber-500/10 border-b border-amber-500/20 px-6 py-2 text-xs text-amber-300">
          <CloudOff className="w-3.5 h-3.5" />
          This project could not be saved to your history. Your files are still available here.
        </div>
      )}

      {interrupted && (
        <div className="shrink-0 flex flex-wrap items-center gap-3 bg-blue-500/10 border-b border-blue-500/20 px-6 py-3 text-sm text-blue-200">
          <span className="flex-1 min-w-[16rem]">
            The page was refreshed, which stopped the generation that was running. You are still signed in.
          </span>
          <Button size="sm" onClick={() => runGeneration(prompt)}>
            <RotateCw className="w-3.5 h-3.5" />
            Restart generation
          </Button>
          <Button size="sm" variant="ghost" onClick={() => navigate('/')}>
            Start something new
          </Button>
        </div>
      )}

      {error && (
        <div className="shrink-0 flex flex-wrap items-center gap-3 bg-red-900/40 border-b border-red-700/60 px-6 py-2 text-sm text-red-200">
          <span className="flex-1 min-w-[14rem]">{error}</span>
          {prompt && !isBuilding && (
            <Button size="sm" variant="secondary" onClick={() => runGeneration(prompt)}>
              <RotateCw className="w-3.5 h-3.5" />
              Try again
            </Button>
          )}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden">
        <div className="h-full grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-6 p-4 lg:p-6">
          <div className="min-h-[26rem] lg:min-h-0 lg:h-full flex flex-col gap-4">
            <div className="flex-1 min-h-0">
              <StepsList
                steps={steps}
                currentStep={currentStep}
                onStepClick={setCurrentStep}
                lifecycle={lifecycle}
                isBuilding={isBuilding}
              />
            </div>

            <div className="shrink-0">
              <div className="flex gap-2">
                <textarea
                  value={userPrompt}
                  onChange={(e) => setUserPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && userPrompt.trim() && !isBuilding) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  disabled={isBuilding}
                  placeholder={isBuilding ? 'Generating your project...' : 'Ask for a change...'}
                  rows={2}
                  className="flex-1 p-3 bg-gray-900 border border-gray-800 rounded-lg text-gray-100 placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/60 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
                />
                <Button
                  onClick={sendMessage}
                  disabled={!userPrompt.trim() || isBuilding}
                  loading={loading}
                  className="px-4"
                  title="Send"
                >
                  {!loading && <Send className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>

          <div className="min-h-[26rem] lg:min-h-0 lg:h-full">
            <FileExplorer files={files} onFileSelect={setSelectedFile} />
          </div>

          <div className="min-h-[26rem] lg:min-h-0 lg:h-full lg:col-span-2 bg-gray-900 border border-gray-800 rounded-lg shadow-lg flex flex-col overflow-hidden">
            <div className="shrink-0 border-b border-gray-800 px-2 pt-2">
              <TabView activeTab={activeTab} onTabChange={setActiveTab} />
            </div>
            <div className="flex-1 min-h-0">
              <div className={activeTab === 'code' ? 'h-full' : 'hidden'}>
                <CodeEditor file={selectedFile} />
              </div>
              <div className={activeTab === 'preview' ? 'h-full' : 'hidden'}>
                <PreviewFrame
                  webContainer={webcontainer}
                  canStart={mountReady}
                  onStatusChange={setPreviewStatus}
                  onReady={(url) => {
                    setPreviewUrl(url);
                    setActiveTab('preview');
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <MentorDrawer
        open={mentorOpen}
        onClose={() => setMentorOpen(false)}
        projectName={projectName}
        explanation={explanation}
        loading={mentorLoading}
        error={mentorError}
        onExplain={() => explain()}
        onRegenerate={() => explain({ force: true })}
      />
    </div>
  );
}
