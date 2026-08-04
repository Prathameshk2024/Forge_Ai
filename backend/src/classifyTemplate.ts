/**
 * Decides whether a prompt wants the React or Node starter.
 *
 * This used to be a full Gemini call that returned a single word, which meant
 * every generation cost two requests instead of one - and on a free-tier quota
 * that is half your budget spent on a decision most prompts make obvious.
 *
 * The heuristic only answers when the prompt is unambiguous. Anything mixed or
 * unrecognised falls through to the model, so accuracy is preserved and only
 * the easy calls are skipped.
 */

export type TemplateKind = "react" | "node";

/** Server-side, headless or CLI work with no UI to render. */
const NODE_SIGNALS = [
  "rest api",
  "graphql api",
  "api endpoint",
  "api server",
  "backend service",
  "backend server",
  "express server",
  "web server",
  "http server",
  "websocket server",
  "socket server",
  "cli tool",
  "command line",
  "command-line",
  "terminal app",
  "web scraper",
  "webscraper",
  "scraping script",
  "cron job",
  "background worker",
  "queue worker",
  "discord bot",
  "telegram bot",
  "slack bot",
  "microservice",
  "node script",
  "node.js script",
];

/** Anything with a rendered interface. */
const REACT_SIGNALS = [
  "website",
  "web site",
  "web page",
  "webpage",
  "landing page",
  "portfolio",
  "dashboard",
  "blog",
  "storefront",
  "e-commerce",
  "ecommerce",
  "online store",
  "single page app",
  "spa",
  "ui",
  "user interface",
  "frontend",
  "front-end",
  "component",
  "form",
  "gallery",
  "carousel",
  "dark mode",
  "responsive",
  "tailwind",
  "react",
];

/** Matches only on word boundaries, so "spa" never fires inside "space". */
function mentions(haystack: string, needle: string): boolean {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, "i").test(haystack);
}

/**
 * Returns a template when the prompt points clearly one way, or `null` when it
 * is ambiguous (both kinds of signal, or neither) and the model should decide.
 */
export function classifyTemplate(prompt: string): TemplateKind | null {
  const text = prompt.toLowerCase();

  const looksNode = NODE_SIGNALS.some((signal) => mentions(text, signal));
  const looksReact = REACT_SIGNALS.some((signal) => mentions(text, signal));

  // Mixed signals ("a dashboard backed by a REST API") are genuinely unclear.
  if (looksNode === looksReact) return null;

  return looksNode ? "node" : "react";
}
