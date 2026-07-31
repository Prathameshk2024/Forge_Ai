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
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

const app = express();

app.use(cors());
app.use(express.json());

/**
 * Preferred model, plus a stand-in used only when the primary is unavailable.
 * Gemini returns 503 UNAVAILABLE when a model is temporarily oversubscribed,
 * which has nothing to do with the request itself - a different model of the
 * same class will usually answer straight away.
 */
const PRIMARY_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.5-flash";
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL ?? "gemini-3-flash-preview";

/** Upstream failures that are worth another attempt rather than a hard error. */
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const RETRY_DELAYS_MS = [500, 1000, 2000];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isRetryable(error: unknown): boolean {
  return error instanceof ApiError && RETRYABLE_STATUSES.has(error.status);
}

type GenerateParams = Parameters<typeof ai.models.generateContent>[0];

/**
 * Runs a generation with backoff on transient upstream errors, then one last
 * try against FALLBACK_MODEL. Callers pass everything except `model`, so the
 * model choice lives in exactly one place.
 */
async function generateWithRetry(params: Omit<GenerateParams, "model">) {
  let lastError: unknown;

  for (const model of [PRIMARY_MODEL, FALLBACK_MODEL]) {
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

        console.warn(
          `[gemini] ${model} returned ${(error as ApiError).status}, retrying in ${delay}ms`
        );
        await sleep(delay);
      }
    }

    if (model === PRIMARY_MODEL) {
      console.warn(`[gemini] ${PRIMARY_MODEL} unavailable, falling back to ${FALLBACK_MODEL}`);
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

    const response = await generateWithRetry({
  config: {
    systemInstruction: `
Return either "node" or "react".
Return ONLY one word.
`,
    thinkingConfig: {
      thinkingBudget: 0
    }
  },
  contents: prompt,
});

console.log(response.text);

const answer = response.text?.trim().toLowerCase();


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

    console.log(response.text);

    res.json({
        response: response.text
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