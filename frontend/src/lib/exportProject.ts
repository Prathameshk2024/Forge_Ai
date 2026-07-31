import JSZip from 'jszip';
import type { WebContainer } from '@webcontainer/api';
import { FileItem } from '../types';
import { flattenFiles } from './fileTree';

/** Never ship the generated lockfile-installed deps or VCS metadata in the ZIP. */
const IGNORED_DIRECTORIES = new Set(['node_modules', '.git', 'dist', '.cache', '.vite']);

const MAX_ENTRIES = 5000;

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Give the browser a tick to start the download before revoking.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Walks the live WebContainer filesystem and adds every project file to `zip`.
 * Reads as bytes so binary assets (images, fonts) survive the round-trip.
 */
async function addContainerFiles(
  container: WebContainer,
  zip: JSZip,
  directory = '.',
  added = { count: 0 }
): Promise<number> {
  const entries = await container.fs.readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    if (added.count >= MAX_ENTRIES) break;
    const childPath = directory === '.' ? entry.name : `${directory}/${entry.name}`;

    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) continue;
      await addContainerFiles(container, zip, childPath, added);
      continue;
    }

    try {
      const contents = await container.fs.readFile(childPath);
      zip.file(childPath.replace(/^\.\//, ''), contents);
      added.count += 1;
    } catch (e) {
      console.warn(`[ForgeAI] Skipped ${childPath} while exporting`, e);
    }
  }

  return added.count;
}

interface DownloadOptions {
  webContainer?: WebContainer;
  /** Fallback source when the container is not available yet. */
  files: FileItem[];
  projectName: string;
}

/**
 * Exports the project as a ZIP and starts the browser download.
 * Returns the number of files written so the caller can report it.
 */
export async function downloadProjectZip({
  webContainer,
  files,
  projectName,
}: DownloadOptions): Promise<number> {
  const zip = new JSZip();
  let fileCount = 0;

  if (webContainer) {
    fileCount = await addContainerFiles(webContainer, zip);
  }

  // Either there is no container yet, or it turned out to be empty - fall back
  // to the generated file tree held in React state.
  if (fileCount === 0) {
    for (const file of flattenFiles(files)) {
      zip.file(file.path, file.content);
      fileCount += 1;
    }
  }

  if (fileCount === 0) {
    throw new Error('There are no files to download yet.');
  }

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  triggerBlobDownload(blob, `${projectName}.zip`);
  return fileCount;
}
