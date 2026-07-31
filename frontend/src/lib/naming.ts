/** Human-readable project title derived from the prompt, e.g. for cards and headers. */
export function projectDisplayName(prompt: string, fallback = 'Untitled project'): string {
  const firstSentence = prompt.trim().split(/[.!?\n]/)[0]?.trim() ?? '';
  if (!firstSentence) return fallback;
  const words = firstSentence.split(/\s+/).slice(0, 8).join(' ');
  const title = words.charAt(0).toUpperCase() + words.slice(1);
  return title.length > 60 ? `${title.slice(0, 57)}...` : title;
}

/** Filesystem-safe name used for the downloaded ZIP. */
export function slugifyProjectName(value: string, fallback = 'forgeai-project'): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .split('-')
    .slice(0, 6)
    .join('-');
  return slug || fallback;
}
