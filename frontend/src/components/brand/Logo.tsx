interface LogoProps {
  /** Rendered pixel size of the square mark. */
  size?: number;
  className?: string;
}

/**
 * The IntelliBuild mark: an "IB" monogram framed by code brackets, over the
 * product gradient, with an amber cursor bar beneath standing in for "Deploy".
 *
 * Pure SVG (no image asset) so it stays crisp at any size and inherits theme
 * colors through its own gradient. Keep this in step with the inline favicon in
 * index.html, which is the same artwork flattened into a data URI.
 */
export function Logo({ size = 36, className = '' }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="IntelliBuild logo"
      className={className}
    >
      <defs>
        <linearGradient id="ib-bg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3B82F6" />
          <stop offset="1" stopColor="#9333EA" />
        </linearGradient>
        <linearGradient id="ib-accent" x1="15" y1="33" x2="33" y2="35" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FDE68A" />
          <stop offset="1" stopColor="#FBBF24" />
        </linearGradient>
      </defs>

      {/* Rounded tile */}
      <rect width="48" height="48" rx="12" fill="url(#ib-bg)" />

      {/* Code brackets </> framing the monogram */}
      <path
        d="M11.5 15 7 22l4.5 7"
        stroke="white"
        strokeOpacity="0.85"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M36.5 15 41 22l-4.5 7"
        stroke="white"
        strokeOpacity="0.85"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* "I" - serif form so it reads as a letter, not a rule */}
      <path
        d="M15.5 13.5h6M15.5 28.5h6M18.5 13.5v15"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* "B" - spine plus two bowls */}
      <path
        d="M25 13.5v15M25 13.5h3.5a3.75 3.75 0 0 1 0 7.5H25M25 21h4a3.75 3.75 0 0 1 0 7.5h-4"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Cursor bar - the "Deploy" beat */}
      <path
        d="M15.5 33.5h17"
        stroke="url(#ib-accent)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
