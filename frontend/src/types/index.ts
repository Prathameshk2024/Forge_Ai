export enum StepType {
  CreateFile,
  CreateFolder,
  EditFile,
  DeleteFile,
  RunScript
}

export interface Step {
  id: number;
  title: string;
  description: string;
  type: StepType;
  status: 'pending' | 'in-progress' | 'completed';
  code?: string;
  path?: string;
}

export interface Project {
  prompt: string;
  steps: Step[];
}

export interface FileItem {
  name: string;
  type: 'file' | 'folder';
  children?: FileItem[];
  content?: string;
  path: string;
}

export interface FileViewerProps {
  file: FileItem | null;
  onClose: () => void;
}

/** Lifecycle of the WebContainer preview, surfaced in the progress sidebar. */
export type PreviewStatus = 'idle' | 'booting' | 'installing' | 'starting' | 'ready' | 'error';

/** Status shared by generation steps and environment tasks in the progress list. */
export type TaskStatus = 'pending' | 'in-progress' | 'completed' | 'error';

/**
 * A non-file task shown in the live progress sidebar (dependency install, dev
 * server boot...). Generation steps use `Step` and are mapped to the same UI.
 */
export interface LifecycleTask {
  id: string;
  label: string;
  activeLabel: string;
  status: TaskStatus;
}

/** Structured explanation returned by the AI Mentor endpoint. */
export interface MentorExplanation {
  projectOverview: string;
  folderStructure: Array<{ path: string; purpose: string }>;
  keyFiles: Array<{ path: string; purpose: string }>;
  componentRelationships: string;
  dataFlow: string;
  architectureRationale: string;
  beginnerExplanation: string;
  suggestedImprovements: string[];
  interviewQuestions: Array<{ question: string; answer: string }>;
  bestPractices: string[];
}

/** A project row in Firestore (`users/{uid}/projects/{id}`). */
export interface StoredProject {
  id: string;
  name: string;
  prompt: string;
  createdAt: number;
  updatedAt: number;
  fileCount: number;
  files: Array<{ path: string; content: string }>;
  steps: Step[];
  mentor: MentorExplanation | null;
}

/** Shape used when creating/updating a project document. */
export type StoredProjectInput = Omit<StoredProject, 'id' | 'createdAt' | 'updatedAt'>;