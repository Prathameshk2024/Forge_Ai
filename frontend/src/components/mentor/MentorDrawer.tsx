import { useState } from 'react';
import {
  BookOpen,
  Boxes,
  ChevronDown,
  FileCode2,
  FolderTree,
  GitBranch,
  GraduationCap,
  Lightbulb,
  MessageCircleQuestion,
  RefreshCw,
  ShieldCheck,
  Workflow,
} from 'lucide-react';
import { MentorExplanation } from '../../types';
import { Drawer } from '../ui/Drawer';
import { Button } from '../ui/Button';
import { EmptyState, ErrorState, Skeleton } from '../ui/States';
import { MentorText, renderInline } from './MentorText';

interface MentorDrawerProps {
  open: boolean;
  onClose: () => void;
  projectName: string;
  explanation: MentorExplanation | null;
  loading: boolean;
  error: string;
  onExplain: () => void;
  onRegenerate: () => void;
}

/** Right-side panel that teaches the user their freshly generated project. */
export function MentorDrawer({
  open,
  onClose,
  projectName,
  explanation,
  loading,
  error,
  onExplain,
  onRegenerate,
}: MentorDrawerProps) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-blue-400" />
          AI Mentor
        </span>
      }
      subtitle={projectName}
      headerActions={
        explanation && !loading ? (
          <Button size="sm" variant="ghost" onClick={onRegenerate} title="Ask the mentor again">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        ) : null
      }
    >
      {loading ? (
        <MentorSkeleton />
      ) : error ? (
        <div className="p-6">
          <ErrorState
            title="The mentor could not finish"
            message={error}
            action={
              <Button size="sm" variant="secondary" onClick={onExplain}>
                <RefreshCw className="w-3.5 h-3.5" />
                Try again
              </Button>
            }
          />
        </div>
      ) : !explanation ? (
        <EmptyState
          icon={GraduationCap}
          title="Understand this project"
          description="The AI Mentor reads every generated file and explains the architecture, the data flow and how to talk about it in an interview."
          action={
            <Button size="sm" onClick={onExplain}>
              <GraduationCap className="w-3.5 h-3.5" />
              Explain this project
            </Button>
          }
        />
      ) : (
        <MentorContent explanation={explanation} />
      )}
    </Drawer>
  );
}

function MentorContent({ explanation }: { explanation: MentorExplanation }) {
  return (
    <div className="divide-y divide-gray-800">
      <Section icon={BookOpen} title="Project Overview" defaultOpen>
        <MentorText>{explanation.projectOverview}</MentorText>
      </Section>

      <Section icon={FolderTree} title="Folder Structure" count={explanation.folderStructure.length} defaultOpen>
        <ul className="space-y-2.5">
          {explanation.folderStructure.map((entry, i) => (
            <li key={`${entry.path}-${i}`} className="flex flex-col gap-1">
              <code className="text-xs font-mono text-blue-300 bg-gray-800 self-start px-2 py-0.5 rounded">
                {entry.path}
              </code>
              <p className="text-sm text-gray-400 leading-relaxed">{renderInline(entry.purpose ?? '')}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section icon={FileCode2} title="Important Files" count={explanation.keyFiles.length}>
        <ul className="space-y-3">
          {explanation.keyFiles.map((entry, i) => (
            <li key={`${entry.path}-${i}`} className="rounded-lg border border-gray-800 bg-gray-950/40 p-3">
              <code className="text-xs font-mono text-purple-300 break-all">{entry.path}</code>
              <p className="text-sm text-gray-400 leading-relaxed mt-1.5">{renderInline(entry.purpose ?? '')}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section icon={Boxes} title="Component Relationships">
        <MentorText>{explanation.componentRelationships}</MentorText>
      </Section>

      <Section icon={Workflow} title="Data Flow">
        <MentorText>{explanation.dataFlow}</MentorText>
      </Section>

      <Section icon={GitBranch} title="Why This Architecture">
        <MentorText>{explanation.architectureRationale}</MentorText>
      </Section>

      <Section icon={GraduationCap} title="Explain Like I'm New" defaultOpen>
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
          <MentorText>{explanation.beginnerExplanation}</MentorText>
        </div>
      </Section>

      <Section icon={Lightbulb} title="Suggested Improvements" count={explanation.suggestedImprovements.length}>
        <ul className="space-y-2">
          {explanation.suggestedImprovements.map((item, i) => (
            <li key={i} className="flex gap-2.5 text-sm text-gray-300 leading-relaxed">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        icon={MessageCircleQuestion}
        title="Interview Questions"
        count={explanation.interviewQuestions.length}
      >
        <ul className="space-y-3">
          {explanation.interviewQuestions.map((qa, i) => (
            <li key={i} className="rounded-lg border border-gray-800 p-3">
              <p className="text-sm font-medium text-gray-100">
                {i + 1}. {renderInline(qa.question ?? '')}
              </p>
              <p className="text-sm text-gray-400 leading-relaxed mt-1.5">{renderInline(qa.answer ?? '')}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section icon={ShieldCheck} title="Best Practices Used" count={explanation.bestPractices.length}>
        <ul className="space-y-2">
          {explanation.bestPractices.map((item, i) => (
            <li key={i} className="flex gap-2.5 text-sm text-gray-300 leading-relaxed">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

interface SectionProps {
  icon: typeof BookOpen;
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

/** Collapsible section so a long explanation stays scannable. */
function Section({ icon: Icon, title, count, defaultOpen = false, children }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-6 py-3.5 text-left hover:bg-gray-800/50 transition-colors"
      >
        <Icon className="w-4 h-4 text-gray-500 shrink-0" />
        <span className="flex-1 text-sm font-medium text-gray-100">{title}</span>
        {typeof count === 'number' && count > 0 && (
          <span className="text-[11px] text-gray-500 tabular-nums">{count}</span>
        )}
        <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-6 pb-5 animate-fade-in">{children}</div>}
    </section>
  );
}

function MentorSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3 text-sm text-blue-400">
        <span className="w-4 h-4 border-2 border-gray-800 border-t-blue-500 rounded-full animate-spin" />
        Reading your project and writing the explanation...
      </div>
      {[0, 1, 2].map((block) => (
        <div key={block} className="space-y-2.5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-11/12" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      ))}
    </div>
  );
}
