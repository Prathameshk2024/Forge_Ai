# IntelliBuild

**Think. Build. Deploy.** — Describe an app in plain English. IntelliBuild
generates every file with Google Gemini, boots the project in a real Node.js
runtime *inside your browser tab*, and then explains the code back to you.

```
frontend/   React 18 + TypeScript + Vite + Tailwind + WebContainer + Firebase
backend/    Express 5 + @google/genai  (stateless API, no database)
```

---

## How it works

```
 1. Prompt ──▶ POST /template ──▶ Gemini answers "react" or "node"
                                  └▶ backend returns that starter's base prompt

 2. Base prompt + user prompt ──▶ POST /chat ──▶ Gemini streams back one
                                                <boltArtifact> XML document

 3. parseXml() (frontend/src/steps.ts) turns <boltAction> tags into Steps:
       type="file"  → create/overwrite a file
       type="shell" → run a command

 4. Steps apply sequentially → files mount into the WebContainer
       → npm install → npm run dev → iframe shows the live preview

 5. POST /mentor sends the finished file tree back to Gemini, which returns
    a structured JSON explanation rendered in the AI Mentor drawer.
```

**Why a WebContainer?** It's a WASM-based Node.js runtime that runs in the tab,
so `npm install` and the dev server never touch your machine. It requires the
page to be [cross-origin isolated](https://web.dev/coop-coep/) — which is why
[vite.config.ts](frontend/vite.config.ts) sets `Cross-Origin-Opener-Policy:
same-origin` and `Cross-Origin-Embedder-Policy: require-corp`. **Any host you
deploy the frontend to must send those two headers**, or the preview won't boot.

---

## Backend API

Three JSON endpoints, no auth, no persistence — see [backend/src/index.ts](backend/src/index.ts).

| Method | Route | Body | Returns |
| --- | --- | --- | --- |
| `POST` | `/template` | `{ prompt }` | `{ prompts[], uiPrompts[] }` — starter scaffold for `react` or `node` |
| `POST` | `/chat` | `{ messages[] }` | `{ response }` — the `<boltArtifact>` XML |
| `POST` | `/mentor` | `{ prompt, projectName, files[] }` | `{ explanation, analysedFiles[] }` |

**Resilience.** `generateWithRetry()` retries `429/500/502/503/504` with a
500ms → 1s → 2s backoff, then repeats the whole ladder against
`GEMINI_FALLBACK_MODEL`. Errors are mapped to human-readable messages before
reaching the client, so a 503 never surfaces as a raw stack trace.

---

## Quick start

Requires [Node.js 18+](https://nodejs.org) and a Chromium-based browser.

**1. Get a free Gemini API key** at <https://aistudio.google.com/apikey>.

**2. Backend** — terminal one:

```bash
cd backend
npm install
cp .env.example .env      # paste your key into GEMINI_API_KEY
npm run dev               # → 🚀 Server running on port 3000
```

> `npm run dev` compiles once (`tsc -b`) then runs `dist/`. It does **not**
> watch — re-run it after editing backend source.

**3. Frontend** — terminal two:

```bash
cd frontend
npm install
cp .env.example .env      # optional, only for Firebase (step 4)
npm run dev               # → http://localhost:5173
```

Open <http://localhost:5173> and describe something. 🎉

**4. Firebase — optional.** Only powers sign-in and saved projects; generation,
preview, mentor and ZIP export all work signed-out.

1. <https://console.firebase.google.com> → new project → add a **Web app** →
   copy the config into `frontend/.env`.
2. **Authentication → Sign-in method** → enable **Google** and **Email/Password**.
3. **Firestore Database → Create database**.
4. Paste [firestore.rules](firestore.rules) into **Firestore → Rules** → publish.

---

## Environment variables

**`backend/.env`**

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `GEMINI_API_KEY` | ✅ | — | Google AI Studio key |
| `PORT` | — | `3000` | API port |
| `GEMINI_MODEL` | — | `gemini-3.5-flash` | Primary model |
| `GEMINI_FALLBACK_MODEL` | — | `gemini-3-flash-preview` | Used only when the primary is unavailable |

**`frontend/.env`**

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `VITE_BACKEND_URL` | — | `http://localhost:3000` | Where the API lives |
| `VITE_FIREBASE_API_KEY` etc. | — | — | Six `VITE_FIREBASE_*` keys; omit to disable auth |

---

## Scripts

| Where | Command | Does |
| --- | --- | --- |
| `backend/` | `npm run dev` | `tsc -b` then run `dist/index.js` |
| `frontend/` | `npm run dev` | Vite dev server with the COOP/COEP headers |
| `frontend/` | `npm run build` | Production build (Firebase + JSZip split into their own chunks) |
| `frontend/` | `npm run preview` | Serve the built bundle |
| `frontend/` | `npm run lint` | ESLint across the project |

---

## Troubleshooting

| Symptom | Cause & fix |
| --- | --- |
| *"Cannot reach the IntelliBuild server"* | Backend isn't running, or `VITE_BACKEND_URL` points elsewhere. Terminal one should show `🚀 Server running on port 3000`. |
| *"The AI service is overloaded"* | Gemini returned 503 after all retries **and** the fallback model. Wait ~30s and retry. |
| *"...is rate-limited right now"* | 429 — free-tier quota. Wait, or switch `GEMINI_MODEL`. |
| Preview stays blank | `npm install` is still running inside the tab; watch the steps sidebar. If it never starts, the page isn't cross-origin isolated — check `crossOriginIsolated === true` in the console. |
| Sign-in button does nothing | `frontend/.env` has no Firebase config. Fill in step 4 or ignore it. |
| No files generated | The model replied without a `<boltArtifact>` block, so `parseXml` found nothing. Re-run with a more specific prompt. |
| Backend edits have no effect | `npm run dev` doesn't watch — restart it. |

---

## Deeper reference

[TECHNICAL.md](TECHNICAL.md) — every file, hook, and data flow in detail.

MIT licensed · built by [Prathamesh Kalshetti](https://github.com/Prathameshk2024)
