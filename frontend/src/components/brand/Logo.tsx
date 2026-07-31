interface LogoProps {
  /** Rendered pixel size of the square mark. */
  size?: number;
  className?: string;
}

/**
 * The ForgeAI mark: an "F" carved out of code brackets with a lightning spark.
 * Pure SVG (no image asset) so it stays crisp at any size and inherits theme
 * colors through its own gradient.
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
      aria-label="ForgeAI logo"
      className={className}
    >
      <defs>
        <linearGradient id="forgeai-bg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3B82F6" />
          <stop offset="1" stopColor="#9333EA" />
        </linearGradient>
        <linearGradient id="forgeai-spark" x1="24" y1="8" x2="34" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FDE68A" />
          <stop offset="1" stopColor="#FBBF24" />
        </linearGradient>
      </defs>

      {/* Rounded tile */}
      <rect width="48" height="48" rx="12" fill="url(#forgeai-bg)" />

      {/* Code brackets </> wrapping the mark */}
      <path
        d="M14.5 15.5 8.5 24l6 8.5"
        stroke="white"
        strokeOpacity="0.85"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M39.5 15.5 45.5 24l-6 8.5"
        stroke="white"
        strokeOpacity="0.85"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform="translate(-6 0)"
      />

      {/* The "F" */}
      <path
        d="M19.5 34V15.5a1 1 0 0 1 1-1H31"
        stroke="white"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M19.5 24h8" stroke="white" strokeWidth="3.2" strokeLinecap="round" />

      {/* Lightning spark */}
      <path
        d="M33 20.5 27.5 29h4l-1.5 6.5 6-9h-4l1-6Z"
        fill="url(#forgeai-spark)"
      />
    </svg>
  );
}
