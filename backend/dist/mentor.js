/**
 * AI Mentor: turns a generated project into a structured, teachable explanation.
 *
 * The model is asked for strict JSON (not markdown) so the frontend can render
 * each section with its own layout and store the result in Firestore.
 */
/** Keeps the request inside a sane token budget for a flash model. */
const MAX_FILES = 40;
const MAX_CHARS_PER_FILE = 6000;
const MAX_TOTAL_CHARS = 140_000;
/** Files whose content adds nothing to an architectural explanation. */
const SKIPPED = /(^|\/)(node_modules|dist|\.git)\//;
const LOW_VALUE = /(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|\.svg|\.png|\.jpe?g|\.ico|\.woff2?)$/i;
/** Rough importance ranking so the most explanatory files survive truncation. */
function score(path) {
    if (/package\.json$/.test(path))
        return 0;
    if (/(^|\/)(src\/)?(main|index|app)\.(tsx?|jsx?)$/i.test(path))
        return 1;
    if (/(^|\/)src\/(pages|routes|views)\//i.test(path))
        return 2;
    if (/(^|\/)src\/components\//i.test(path))
        return 3;
    if (/(^|\/)src\//i.test(path))
        return 4;
    if (/\.(tsx?|jsx?)$/i.test(path))
        return 5;
    if (/\.(css|html|json)$/i.test(path))
        return 6;
    return 7;
}
/** Selects and truncates project files into the block embedded in the prompt. */
export function buildProjectDigest(files) {
    const candidates = files
        .filter((file) => file.path && !SKIPPED.test(file.path) && !LOW_VALUE.test(file.path))
        .sort((a, b) => score(a.path) - score(b.path) || a.path.localeCompare(b.path))
        .slice(0, MAX_FILES);
    const includedPaths = [];
    const chunks = [];
    let total = 0;
    for (const file of candidates) {
        const body = file.content.length > MAX_CHARS_PER_FILE
            ? `${file.content.slice(0, MAX_CHARS_PER_FILE)}\n... [truncated]`
            : file.content;
        if (total + body.length > MAX_TOTAL_CHARS)
            break;
        total += body.length;
        includedPaths.push(file.path);
        chunks.push(`--- FILE: ${file.path} ---\n${body}`);
    }
    const tree = files.map((file) => file.path).sort().join('\n');
    return {
        digest: `FULL FILE LIST:\n${tree}\n\nFILE CONTENTS:\n${chunks.join('\n\n')}`,
        includedPaths,
    };
}
export const MENTOR_SYSTEM_PROMPT = `You are the AI Mentor inside ForgeAI, a tool that generates full web projects from a prompt and then teaches the user how the generated code works.

You will receive the user's original prompt and the generated project's files. Explain the project so that a beginner-to-intermediate developer fully understands it and could confidently defend it in a job interview.

Rules:
- Base every statement on the ACTUAL files provided. Never invent files, libraries or folders that are not present.
- Be concrete: reference real file paths, real component names, real props and real state.
- Be encouraging and clear. Avoid jargon unless you immediately explain it.
- Respond with a SINGLE JSON object and nothing else. No markdown, no code fences, no commentary.

The JSON object must match this exact shape:
{
  "projectOverview": string,              // 3-5 sentences: what the app is and what it does
  "folderStructure": [                     // every top-level folder AND notable nested folder
    { "path": string, "purpose": string }
  ],
  "keyFiles": [                            // 6-14 of the most important files
    { "path": string, "purpose": string }  // purpose = 1-3 sentences on what the file does and why it exists
  ],
  "componentRelationships": string,        // which component renders/uses which, parent-child chain
  "dataFlow": string,                      // where state lives, how it moves, what triggers re-renders
  "architectureRationale": string,         // why this structure was chosen, trade-offs considered
  "beginnerExplanation": string,           // the same project explained in plain language, no jargon
  "suggestedImprovements": string[],       // 4-7 specific, actionable improvements for THIS code
  "interviewQuestions": [                  // 5-8 questions an interviewer could ask about this project
    { "question": string, "answer": string }
  ],
  "bestPractices": string[]                // 4-7 good practices actually visible in this codebase
}

Use plain text inside string values. You may use short inline code references like \`useState\`. Do not use headings or bullet characters.`;
export function buildMentorUserPrompt(prompt, projectName, digest) {
    return `PROJECT NAME: ${projectName}

ORIGINAL USER PROMPT:
${prompt}

GENERATED PROJECT:
${digest}

Now produce the JSON explanation described in your instructions.`;
}
/** Model output can still arrive wrapped in fences; recover the JSON object. */
export function parseMentorResponse(raw) {
    const cleaned = raw
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/```$/, '')
        .trim();
    try {
        return JSON.parse(cleaned);
    }
    catch {
        const start = cleaned.indexOf('{');
        const end = cleaned.lastIndexOf('}');
        if (start !== -1 && end > start) {
            return JSON.parse(cleaned.slice(start, end + 1));
        }
        throw new Error('The AI Mentor returned a response that could not be parsed.');
    }
}
//# sourceMappingURL=mentor.js.map