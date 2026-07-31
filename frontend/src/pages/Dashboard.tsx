import { useNavigate } from 'react-router-dom';
import { Clock, FileCode2, GraduationCap, Plus, Sparkles, Trash2, FolderOpen, LogIn } from 'lucide-react';
import { AppHeader } from '../components/layout/AppHeader';
import { Button } from '../components/ui/Button';
import { EmptyState, ErrorState, Skeleton } from '../components/ui/States';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useProjectHistory } from '../hooks/useProjectHistory';
import { StoredProject } from '../types';

function formatDate(timestamp: number) {
  if (!timestamp) return 'Unknown date';
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Project history: every generation the signed-in user has saved. */
export function Dashboard() {
  const navigate = useNavigate();
  const { user, initializing, isConfigured, openAuthModal } = useAuth();
  const { projects, loading, error, refresh, remove } = useProjectHistory(user);
  const toast = useToast();

  async function handleDelete(project: StoredProject) {
    if (!window.confirm(`Delete "${project.name}"? This cannot be undone.`)) return;
    try {
      await remove(project.id);
      toast.success('Project deleted');
    } catch {
      toast.error('Could not delete the project. Please try again.');
    }
  }

  const open = (project: StoredProject) => navigate('/builder', { state: { projectId: project.id } });

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      <AppHeader
        onBack={() => navigate('/')}
        actions={
          <Button size="sm" onClick={() => navigate('/')}>
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New project</span>
          </Button>
        }
      />

      <main className="flex-1 w-full max-w-6xl mx-auto p-4 sm:p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">My projects</h1>
          <p className="text-sm text-gray-500 mt-1">
            Everything you have generated, with its files and mentor explanation.
          </p>
        </div>

        {!isConfigured ? (
          <EmptyState
            icon={FolderOpen}
            title="Project history needs Firebase"
            description="Add your Firebase keys to frontend/.env to save and revisit generated projects."
            className="min-h-[50vh]"
          />
        ) : initializing ? (
          <ProjectSkeletonGrid />
        ) : !user ? (
          <EmptyState
            icon={LogIn}
            title="Sign in to see your projects"
            description="Your generated projects are stored against your account."
            className="min-h-[50vh]"
            action={
              <Button size="sm" onClick={openAuthModal}>
                Sign in
              </Button>
            }
          />
        ) : loading ? (
          <ProjectSkeletonGrid />
        ) : error ? (
          <ErrorState
            message={error}
            action={
              <Button size="sm" variant="secondary" onClick={refresh}>
                Try again
              </Button>
            }
          />
        ) : projects.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="No projects yet"
            description="Generate your first project and it will show up here automatically."
            className="min-h-[50vh]"
            action={
              <Button size="sm" onClick={() => navigate('/')}>
                <Plus className="w-3.5 h-3.5" />
                Start building
              </Button>
            }
          />
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <li key={project.id}>
                <article
                  onClick={() => open(project)}
                  className="group h-full flex flex-col bg-gray-900 border border-gray-800 rounded-xl p-4 cursor-pointer transition-all duration-200 hover:border-gray-700 hover:-translate-y-0.5 hover:shadow-xl"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-sm font-semibold text-gray-100 line-clamp-2">{project.name}</h2>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(project);
                      }}
                      aria-label={`Delete ${project.name}`}
                      className="shrink-0 p-1.5 rounded-lg text-gray-600 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-red-400 hover:bg-red-500/10 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <p className="text-xs text-gray-500 mt-2 line-clamp-3 flex-1">{project.prompt}</p>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-4 pt-3 border-t border-gray-800 text-[11px] text-gray-500">
                    <span className="flex items-center gap-1">
                      <FileCode2 className="w-3 h-3" />
                      {project.fileCount} files
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(project.updatedAt || project.createdAt)}
                    </span>
                    {project.mentor && (
                      <span className="flex items-center gap-1 text-blue-400">
                        <GraduationCap className="w-3 h-3" />
                        Mentor ready
                      </span>
                    )}
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function ProjectSkeletonGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <Skeleton className="h-3 w-1/2 mt-4" />
        </div>
      ))}
    </div>
  );
}
