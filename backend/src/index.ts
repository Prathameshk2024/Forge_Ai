import "dotenv/config";
import express from "express";
import cors from "cors";
import { GoogleGenAI, ApiError } from "@google/genai";
import { BASE_PROMPT ,getSystemPrompt } from "./prompts.js";

import{ basePrompt as reactBasePrompt } from "./defaults/react.js";
import{ basePrompt as nodeBasePrompt } from "./defaults/node.js";
import {
  buildMentorUserPrompt,
  buildProjectDigest,
  MENTOR_SYSTEM_PROMPT,
  parseMentorResponse,
  type MentorFile,
} from "./mentor.js";
import { repairGeneratedImports } from "./repairImports.js";
import { classifyTemplate } from "./classifyTemplate.js";
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

const app = express();

/**
 * In production only the deployed frontend may call this API - an open CORS
 * policy lets any site spend your Gemini quota. Set ALLOWED_ORIGINS to a
 * comma-separated list (e.g. "https://forgeai.onrender.com"). Left unset, the
 * API stays open, which is the right default for local development.
 */
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

if (ALLOWED_ORIGINS.length === 0) {
  console.warn(
    "[cors] ALLOWED_ORIGINS is not set - accepting requests from any origin. " +
      "Set it in production so only your frontend can spend your Gemini quota."
  );
}

app.use(
  cors({
    origin: ALLOWED_ORIGINS.length === 0 ? true : ALLOWED_ORIGINS,
  })
);
app.use(express.json());

/**
 * Preferred model, plus a stand-in used only when the primary is unavailable.
 * Gemini returns 503 UNAVAILABLE when a model is temporarily oversubscribed,
 * which has nothing to do with the request itself - a different model of the
 * same class will usually answer straight away.
 */
const PRIMARY_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.5-flash";
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL ?? "gemini-3-flash-preview";

/**
 * Models to try, in order. Deduplicated on purpose: pointing GEMINI_MODEL at
 * the same name the fallback defaults to is an easy mistake, and it turns the
 * retry loop into two full passes against one throttled model. That is actively
 * harmful when the failure is a quota limit - it spends twice the requests to
 * arrive at the same 429.
 */
const MODEL_CHAIN = [...new Set([PRIMARY_MODEL, FALLBACK_MODEL])];

if (MODEL_CHAIN.length === 1) {
  console.warn(
    `[gemini] GEMINI_MODEL and GEMINI_FALLBACK_MODEL are both "${PRIMARY_MODEL}" - ` +
      `there is no fallback. Set GEMINI_FALLBACK_MODEL to a different model to survive an outage.`
  );
}

/** Upstream failures that are worth another attempt rather than a hard error. */
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const RETRY_DELAYS_MS = [500, 1000, 2000];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Transport-level failures that never reach an HTTP status: a dropped socket, a
 * DNS blip, or undici giving up waiting for response headers. These arrive as a
 * plain `TypeError: fetch failed`, so without this they bypassed the retry loop
 * entirely - throwing on the first blip and never even trying the fallback
 * model, despite being the most obviously transient failures there are.
 */
const RETRYABLE_NETWORK_CODES = new Set([
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_SOCKET",
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EAI_AGAIN",
]);

function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  // The useful code hides on `cause`; the outer error is just "fetch failed".
  const code = (error as { code?: string }).code
    ?? ((error.cause as { code?: string } | undefined)?.code);

  if (code && RETRYABLE_NETWORK_CODES.has(code)) return true;
  return error.message.includes("fetch failed");
}

function isRetryable(error: unknown): boolean {
  if (error instanceof ApiError) return RETRYABLE_STATUSES.has(error.status);
  return isNetworkError(error);
}

type GenerateParams = Parameters<typeof ai.models.generateContent>[0];

/**
 * Runs a generation with backoff on transient upstream errors, then one last
 * try against FALLBACK_MODEL. Callers pass everything except `model`, so the
 * model choice lives in exactly one place.
 */
async function generateWithRetry(params: Omit<GenerateParams, "model">) {
  let lastError: unknown;

  for (const [index, model] of MODEL_CHAIN.entries()) {
    // One initial attempt per model, plus a retry for each configured delay.
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      try {
        return await ai.models.generateContent({ ...params, model });
      } catch (error) {
        lastError = error;
        if (!isRetryable(error)) throw error;

        const delay = RETRY_DELAYS_MS[attempt];
        // Out of retries for this model - fall through to the next one.
        if (delay === undefined) break;

        const reason =
          error instanceof ApiError ? `returned ${error.status}` : "could not be reached";
        console.warn(`[gemini] ${model} ${reason}, retrying in ${delay}ms`);
        await sleep(delay);
      }
    }

    const next = MODEL_CHAIN[index + 1];
    if (next) {
      console.warn(`[gemini] ${model} unavailable, falling back to ${next}`);
    }
  }

  throw lastError;
}

function sendGenerationError(res: express.Response, error: unknown) {
  console.error(error);

  if (error instanceof ApiError) {
    const status = error.status >= 400 && error.status < 600 ? error.status : 502;
    const message =
      status === 429
        ? "The AI service is rate-limited right now. Please wait a moment and try again."
        : status === 503
          ? "The AI service is overloaded right now. We retried a few times without luck - please try again in a moment."
          : "The AI service failed to respond. Please try again.";
    return res.status(status).json({ error: message });
  }

  return res.status(500).json({ error: "Something went wrong on the server. Please try again." });
}

app.post("/template", async (req, res) => {
  try {
    const prompt = req.body.prompt;

    // Most prompts say plainly which starter they need, and spending a Gemini
    // request to be told "react" is half of every generation's quota cost. Only
    // genuinely ambiguous prompts reach the model.
    let answer = classifyTemplate(typeof prompt === "string" ? prompt : "") as string | null;

    if (answer) {
      console.log(`[template] ${answer} (local, no model call)`);
    } else {
      const response = await generateWithRetry({
        config: {
          systemInstruction: `
Return either "node" or "react".
Return ONLY one word.
`,
          thinkingConfig: {
            thinkingBudget: 0,
          },
        },
        contents: prompt,
      });

      answer = response.text?.trim().toLowerCase() ?? null;
      console.log(`[template] ${answer} (model)`);
    }


    if (answer === "react") {
      return res.json({
        prompts: [
          BASE_PROMPT,
          `Here is an artifact that contains all files of the project visible to you.
Consider the contents of ALL files in the project.

${reactBasePrompt}

Here is a list of files that exist on the file system but are not being shown to you:

- .gitignore
- package-lock.json
`,
        ],
        uiPrompts: [reactBasePrompt],
      });
    }

    if (answer === "node") {
      return res.json({
        prompts: [
          `Here is an artifact that contains all files of the project visible to you.
Consider the contents of ALL files in the project.

${nodeBasePrompt}

Here is a list of files that exist on the file system but are not being shown to you:

- .gitignore
- package-lock.json
`,
        ],
        uiPrompts: [nodeBasePrompt],
      });
    }

    return res.status(403).json({
      message: "You can't access this",
    });
  } catch (error) {
    return sendGenerationError(res, error);
  }
});

app.post("/chat", async (req, res) => {
  try {
    const messages = req.body.messages;

    // Convert Claude format -> Gemini format
    const geminiMessages = messages.map((message: any) => ({
        role: message.role,
        parts: [
            {
                text: message.content
            }
        ]
    }));

    const response = await generateWithRetry({
        config: {
            systemInstruction: getSystemPrompt(),
            thinkingConfig: {
                thinkingBudget: 0
            }
        },
        contents: geminiMessages,
    });

    // Models drop imports on long multi-file generations no matter how firmly
    // the system prompt forbids it, and a single missing icon import is a fatal
    // "X is not defined" that blanks the preview. Patch it before the files
    // ever reach the browser, so saved projects and downloads are fixed too.
    const { text, repairs } = repairGeneratedImports(response.text ?? "");

    for (const repair of repairs) {
      if (repair.added.length > 0) {
        console.log(`[repair] ${repair.filePath}: added ${repair.added.join(", ")}`);
      }
      if (repair.unresolved.length > 0) {
        console.warn(
          `[repair] ${repair.filePath}: undefined and not a lucide icon - ${repair.unresolved.join(", ")}`
        );
      }
    }

    res.json({
        response: text
    });
  } catch (error) {
    sendGenerationError(res, error);
  }
});

/**
 * AI Mentor - explains a generated project.
 * Body: { prompt, projectName?, files: [{ path, content }] }
 * Returns: { explanation: MentorExplanation, analysedFiles: string[] }
 */
app.post("/mentor", async (req, res) => {
  try {
    const { prompt, projectName, files } = req.body as {
      prompt?: string;
      projectName?: string;
      files?: MentorFile[];
    };

    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: "No project files were provided to explain." });
    }

    const { digest, includedPaths } = buildProjectDigest(files);

    const response = await generateWithRetry({
      config: {
        systemInstruction: MENTOR_SYSTEM_PROMPT,
        responseMimeType: "application/json",
        temperature: 0.4,
      },
      contents: buildMentorUserPrompt(
        prompt ?? "",
        projectName ?? "Generated project",
        digest
      ),
    });

    let explanation: unknown;
    try {
      explanation = parseMentorResponse(response.text ?? "");
    } catch (parseError) {
      console.error("[mentor] unparseable response", parseError, response.text?.slice(0, 500));
      return res.status(502).json({
        error: "The AI Mentor returned an unreadable response. Please try again.",
      });
    }

    return res.json({ explanation, analysedFiles: includedPaths });
  } catch (error) {
    return sendGenerationError(res, error);
  }
});

const PORT = Number(process.env.PORT ?? 3000);

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});