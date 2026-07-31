import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { MentorExplanation, StoredProject, StoredProjectInput, Step } from '../types';

/**
 * Project history, stored per user at `users/{uid}/projects/{projectId}`.
 *
 * Firestore caps a document at ~1 MiB, so file contents are budgeted before
 * writing: the largest files are truncated rather than failing the save.
 */

const COLLECTION = 'projects';
const MAX_TOTAL_CONTENT = 700_000; // characters, leaves headroom for metadata
const MAX_FILE_CONTENT = 100_000;
const HISTORY_LIMIT = 50;

function projectsRef(uid: string) {
  if (!db) throw new Error('Firestore is not configured.');
  return collection(db, 'users', uid, COLLECTION);
}

function projectRef(uid: string, projectId: string) {
  if (!db) throw new Error('Firestore is not configured.');
  return doc(db, 'users', uid, COLLECTION, projectId);
}

/** Trims file contents so the document stays under the Firestore size limit. */
export function prepareFilesForStorage(
  files: Array<{ path: string; content: string }>
): Array<{ path: string; content: string }> {
  let budget = MAX_TOTAL_CONTENT;

  return files.map((file) => {
    const capped = file.content.length > MAX_FILE_CONTENT ? file.content.slice(0, MAX_FILE_CONTENT) : file.content;
    if (budget <= 0) return { path: file.path, content: '' };
    const content = capped.length > budget ? capped.slice(0, budget) : capped;
    budget -= content.length;
    return { path: file.path, content };
  });
}

export async function createProject(uid: string, input: StoredProjectInput): Promise<string> {
  const now = Date.now();
  const document = await addDoc(projectsRef(uid), {
    ...input,
    files: prepareFilesForStorage(input.files),
    createdAt: now,
    updatedAt: now,
  });
  return document.id;
}

export async function updateProject(
  uid: string,
  projectId: string,
  patch: Partial<Omit<StoredProject, 'id' | 'createdAt'>>
): Promise<void> {
  const payload = {
    ...patch,
    ...(patch.files ? { files: prepareFilesForStorage(patch.files) } : {}),
    updatedAt: Date.now(),
  };
  await updateDoc(projectRef(uid, projectId), payload);
}

/** Creates or replaces a project at a known id (used when re-saving a restored project). */
export async function upsertProject(uid: string, projectId: string, input: StoredProjectInput): Promise<void> {
  await setDoc(
    projectRef(uid, projectId),
    { ...input, files: prepareFilesForStorage(input.files), updatedAt: Date.now() },
    { merge: true }
  );
}

export async function saveMentorExplanation(
  uid: string,
  projectId: string,
  mentor: MentorExplanation
): Promise<void> {
  await updateDoc(projectRef(uid, projectId), { mentor, updatedAt: Date.now() });
}

export async function listProjects(uid: string): Promise<StoredProject[]> {
  const snapshot = await getDocs(query(projectsRef(uid), orderBy('updatedAt', 'desc'), limit(HISTORY_LIMIT)));
  return snapshot.docs.map((document) => fromDocument(document.id, document.data()));
}

export async function getProject(uid: string, projectId: string): Promise<StoredProject | null> {
  const snapshot = await getDoc(projectRef(uid, projectId));
  return snapshot.exists() ? fromDocument(snapshot.id, snapshot.data()) : null;
}

export async function deleteProject(uid: string, projectId: string): Promise<void> {
  await deleteDoc(projectRef(uid, projectId));
}

/** Defensive mapper - documents written by older versions may miss fields. */
function fromDocument(id: string, data: Record<string, unknown>): StoredProject {
  const files = Array.isArray(data.files) ? (data.files as Array<{ path: string; content: string }>) : [];
  return {
    id,
    name: typeof data.name === 'string' ? data.name : 'Untitled project',
    prompt: typeof data.prompt === 'string' ? data.prompt : '',
    createdAt: typeof data.createdAt === 'number' ? data.createdAt : 0,
    updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : 0,
    fileCount: typeof data.fileCount === 'number' ? data.fileCount : files.length,
    files,
    steps: Array.isArray(data.steps) ? (data.steps as Step[]) : [],
    mentor: (data.mentor as MentorExplanation | undefined) ?? null,
  };
}
