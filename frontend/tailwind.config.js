/** @type {import('tailwindcss').Config} */

/**
 * The whole app is styled on Tailwind's `gray` ramp. Instead of rewriting every
 * className for light mode, the ramp itself is backed by CSS variables that are
 * inverted in `index.css` when the `light` theme is active. `<alpha-value>`
 * keeps opacity modifiers (e.g. `bg-gray-800/60`) working.
 */
const grayScale = Object.fromEntries(
  [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((shade) => [
    shade,
    `rgb(var(--c-gray-${shade}) / <alpha-value>)`,
  ])
);

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      // Extra-small breakpoint so the header can drop the wordmark on narrow phones.
      screens: {
        xs: '380px',
      },
      colors: {
        gray: grayScale,
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        'slide-up': 'slide-up 0.25s ease-out',
        'slide-in-right': 'slide-in-right 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in': 'scale-in 0.18s ease-out',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
};
