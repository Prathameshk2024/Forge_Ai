import type { FileSystemTree } from '@webcontainer/api';
import { FileItem } from '../types';

/**
 * Helpers for the in-memory project tree.
 *
 * The tree shape (`FileItem[]` with nested `children`) is unchanged from the
 * original implementation - this module just centralises the operations that
 * were previously inlined in Builder.tsx so the progress runner, the WebContainer
 * mount, the ZIP export and Firestore persistence all share one implementation.
 */

/** `src/components/App.tsx` -> `['src', 'components', 'App.tsx']` */
function segments(path: string): string[] {
  return path.split('/').filter(Boolean);
}

/**
 * Immutably inserts (or updates) a file at `path`, creating any missing
 * folders on the way. Returns a new array; untouched branches keep identity.
 */
export function upsertFile(files: FileItem[], path: string, content: string): FileItem[] {
  const parts = segments(path);
  if (!parts.length) return files;

  const insert = (nodes: FileItem[], depth: number, prefix: string): FileItem[] => {
    const name = parts[depth];
    const currentPath = `${prefix}/${name}`;
    const isLeaf = depth === parts.length - 1;
    const index = nodes.findIndex((node) => node.path === currentPath);
    const next = [...nodes];

    if (isLeaf) {
      const file: FileItem = { name, type: 'file', path: currentPath, content };
      if (index === -1) next.push(file);
      else next[index] = { ...next[index], ...file };
      return next;
    }

    const existing = index === -1 ? undefined : next[index];
    const children = insert(existing?.children ?? [], depth + 1, currentPath);
    const folder: FileItem = { name, type: 'folder', path: currentPath, children };
    if (index === -1) next.push(folder);
    else next[index] = folder;
    return next;
  };

  return insert(files, 0, '');
}

/** Depth-first list of every file with its path relative to the project root. */
export function flattenFiles(files: FileItem[]): Array<{ path: string; content: string }> {
  const out: Array<{ path: string; content: string }> = [];

  const walk = (nodes: FileItem[]) => {
    for (const node of nodes) {
      if (node.type === 'folder') walk(node.children ?? []);
      else out.push({ path: node.path.replace(/^\//, ''), content: node.content ?? '' });
    }
  };

  walk(files);
  return out;
}

/** Rebuilds a nested tree from the flat `{ path, content }` list stored in Firestore. */
export function buildTreeFromFlat(entries: Array<{ path: string; content: string }>): FileItem[] {
  return entries.reduce<FileItem[]>((tree, entry) => upsertFile(tree, entry.path, entry.content), []);
}

/** Converts the tree into the nested structure `webcontainer.mount()` expects. */
export function toMountStructure(files: FileItem[]): FileSystemTree {
  const toEntry = (node: FileItem): FileSystemTree[string] =>
    node.type === 'folder'
      ? {
          directory: Object.fromEntries((node.children ?? []).map((child) => [child.name, toEntry(child)])),
        }
      : { file: { contents: node.content ?? '' } };

  return Object.fromEntries(files.map((node) => [node.name, toEntry(node)]));
}
