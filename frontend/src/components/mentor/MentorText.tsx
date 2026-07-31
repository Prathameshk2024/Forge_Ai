import { Fragment } from 'react';

/**
 * Minimal inline renderer for mentor prose: splits paragraphs on blank lines and
 * renders `backticked` spans as code. Deliberately not a full markdown parser -
 * the mentor prompt asks for plain text with inline code only.
 */
export function MentorText({ children, className = '' }: { children: string; className?: string }) {
  const paragraphs = children.split(/\n{2,}/).filter((p) => p.trim());

  return (
    <div className={`space-y-3 ${className}`}>
      {paragraphs.map((paragraph, index) => (
        <p key={index} className="text-sm leading-relaxed text-gray-300">
          {renderInline(paragraph.trim())}
        </p>
      ))}
    </div>
  );
}

export function renderInline(text: string) {
  return text.split(/(`[^`]+`)/g).map((part, index) =>
    part.startsWith('`') && part.endsWith('`') && part.length > 2 ? (
      <code
        key={index}
        className="px-1.5 py-0.5 rounded bg-gray-800 text-blue-300 text-[0.8em] font-mono break-words"
      >
        {part.slice(1, -1)}
      </code>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    )
  );
}
