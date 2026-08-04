import { LUCIDE_ICON_NAMES } from "./lucideIcons.js";

/**
 * Repairs missing `lucide-react` imports in generated files.
 *
 * The system prompt already forbids this (rule 15), but dropped imports are a
 * probabilistic LLM failure: on a long multi-file generation the model writes
 * `<Truck />` and forgets `import { Truck } from 'lucide-react'`. The result is
 * a fatal `Truck is not defined` and a blank preview. Prompting lowers the rate;
 * only a deterministic pass removes it.
 *
 * Deliberately narrow: it repairs identifiers that are *known* lucide exports
 * and leaves everything else untouched. An unresolved `<Header />` is a real
 * generation bug, and inventing an import for it would swap a clear runtime
 * error for a confusing one.
 */

/**
 * `<Foo`, `<Foo.Bar` and `<Foo />` - captures the leading identifier.
 *
 * The lookbehind rejects generic type arguments: in `useState<CartItem[]>` the
 * `<` follows an identifier character, whereas a JSX tag always follows
 * whitespace or one of `( { > =`. Without it every `Array<T>` and
 * `Record<K, V>` was reported as an undefined component.
 */
const JSX_USAGE = /(?<![A-Za-z0-9_$])<([A-Z][A-Za-z0-9]*)/g;
const FILE_ACTION = /(<boltAction\s+type="file"\s+filePath="([^"]*)"\s*>)([\s\S]*?)(<\/boltAction>)/g;
const LUCIDE_IMPORT = /import\s*\{([^}]*)\}\s*from\s*['"]lucide-react['"]\s*;?/;
/** Any top-level import statement, used to place a new one sensibly. */
const ANY_IMPORT = /^[ \t]*import\s[\s\S]*?from\s*['"][^'"]+['"]\s*;?[ \t]*$/gm;

export interface ImportRepair {
  filePath: string;
  /** Lucide icons that were used but not imported, now added. */
  added: string[];
  /** Undefined components that are not lucide exports - reported, not touched. */
  unresolved: string[];
}

/**
 * lucide-react exports `Truck`, `TruckIcon` and `LucideTruck` for every icon.
 * Reduce alias spellings to the canonical name so all three validate.
 */
function isLucideExport(name: string): boolean {
  if (LUCIDE_ICON_NAMES.has(name)) return true;
  if (name.endsWith("Icon") && LUCIDE_ICON_NAMES.has(name.slice(0, -4))) return true;
  if (name.startsWith("Lucide") && LUCIDE_ICON_NAMES.has(name.slice(6))) return true;
  return false;
}

/**
 * Identifiers a file already has in scope: anything imported, plus anything it
 * declares itself. Erring toward over-collecting is safe here - it only means a
 * genuinely missing import goes unrepaired, which is the status quo.
 */
function collectDefinedNames(code: string): Set<string> {
  const defined = new Set<string>();

  // import Default, { A, B as C }, * as NS from '...'
  const importRe = /import\s+([\s\S]*?)\s+from\s*['"][^'"]+['"]/g;
  for (const match of code.matchAll(importRe)) {
    const clause = match[1] ?? "";

    const named = clause.match(/\{([^}]*)\}/)?.[1] ?? "";
    for (const part of named.split(",")) {
      // `A as B` binds B; a bare `A` binds A.
      const bound = part.includes(" as ") ? part.split(" as ")[1] : part;
      const name = bound?.trim();
      if (name) defined.add(name);
    }

    const namespace = clause.match(/\*\s*as\s*([A-Za-z_$][\w$]*)/)?.[1];
    if (namespace) defined.add(namespace);

    // Default import: the clause before any `{` or `*`.
    const defaultName = clause.split(/[,{*]/)[0]?.trim();
    if (defaultName && /^[A-Za-z_$][\w$]*$/.test(defaultName)) defined.add(defaultName);
  }

  // `interface` and `type` matter as much as `const` here: a file that declares
  // `interface CartItem` and then writes `useState<CartItem[]>` must not have
  // CartItem treated as an undefined component.
  const declRe = /(?:^|\s)(?:const|let|var|function|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g;
  for (const match of code.matchAll(declRe)) {
    const name = match[1];
    if (name) defined.add(name);
  }

  return defined;
}

/** Merges names into an existing lucide import, or adds a fresh one. */
function withLucideImport(code: string, names: string[]): string {
  const existing = code.match(LUCIDE_IMPORT);

  if (existing) {
    const current = (existing[1] ?? "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    const merged = [...new Set([...current, ...names])].join(", ");
    return code.replace(LUCIDE_IMPORT, `import { ${merged} } from 'lucide-react';`);
  }

  const statement = `import { ${names.join(", ")} } from 'lucide-react';`;

  // Slot in after the last existing import so the file keeps a normal shape.
  const imports = [...code.matchAll(ANY_IMPORT)];
  const last = imports[imports.length - 1];
  if (last?.index !== undefined) {
    const end = last.index + last[0].length;
    return `${code.slice(0, end)}\n${statement}${code.slice(end)}`;
  }

  const leadingNewline = code.startsWith("\n") ? "" : "\n";
  return `${statement}${leadingNewline}${code}`;
}

function repairFile(filePath: string, code: string): { code: string; repair?: ImportRepair } {
  const defined = collectDefinedNames(code);

  const used = new Set<string>();
  for (const match of code.matchAll(JSX_USAGE)) {
    const name = match[1];
    if (name) used.add(name);
  }

  const missing = [...used].filter((name) => !defined.has(name));
  if (missing.length === 0) return { code };

  const added = missing.filter(isLucideExport).sort();
  const unresolved = missing.filter((name) => !isLucideExport(name)).sort();

  const repaired = added.length > 0 ? withLucideImport(code, added) : code;
  return { code: repaired, repair: { filePath, added, unresolved } };
}

/**
 * Rewrites file contents in place inside a model response, leaving the
 * surrounding boltArtifact markup byte-identical.
 */
export function repairGeneratedImports(response: string): {
  text: string;
  repairs: ImportRepair[];
} {
  const repairs: ImportRepair[] = [];

  const text = response.replace(
    FILE_ACTION,
    (whole, openTag: string, filePath: string, content: string, closeTag: string) => {
      if (!/\.(tsx|jsx)$/i.test(filePath)) return whole;

      const { code, repair } = repairFile(filePath, content);
      if (repair) repairs.push(repair);

      return `${openTag}${code}${closeTag}`;
    }
  );

  return { text, repairs };
}
