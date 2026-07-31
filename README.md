# ForgeAI — Build. Learn. Launch.

ForgeAI turns a sentence into a running web project, previews it live in a WebContainer, then **teaches you how it works** through an AI Mentor. Projects are saved to your account so you can come back to them later.

```
frontend/   React + TypeScript + Vite + Tailwind (UI, WebContainer, Firebase)
backend/    Express + Google Gemini (template routing, generation, AI Mentor)
```

---

## 1. Setup

### Backend

```bash
cd backend
cp .env.example .env        # add GEMINI_API_KEY
npm install
npm run dev                 # http://localhost:3000
```

### Frontend

```bash
cd frontend
cp .env.example .env        # add your Firebase web config
npm install
npm run dev                 # http://localhost:5173
```

### Firebase (required for sign-in and project history)

1. Create a project at <https://console.firebase.google.com>, add a **Web app**, and copy the config into `frontend/.env`.
2. **Authentication → Sign-in method** → enable **Google** and **Email/Password**.
3. **Firestore Database → Create database**.
4. Paste the contents of [`firestore.rules`](firestore.rules) into **Firestore → Rules**.

If `frontend/.env` is missing, ForgeAI still runs: authentication and history are disabled, a warning is logged, and generation is not blocked. Nothing crashes.

---

## 2. What changed, file by file

### Branding

| File | Purpose |
| --- | --- |
| `src/brand.ts` | Single source of truth for `APP_NAME`, `APP_TAGLINE`, description. Rename the product in one place. |
| `src/components/brand/Logo.tsx` | The ForgeAI mark as inline SVG: an **F** wrapped in `</>` brackets with a lightning spark, on a blue→purple gradient tile. No image asset, so it stays sharp at any size and can be dropped anywhere with a `size` prop. |
| `src/components/layout/AppHeader.tsx` | The shared header used by **every** page: back arrow (optional), logo, `ForgeAI` wordmark, tagline, a `context` slot (current project/prompt), an `actions` slot (page buttons), then the theme toggle and user menu. Responsive: the tagline hides below `sm`, the wordmark below `xs`. |
| `index.html` | New title, new SVG favicon matching the logo, and an inline script that applies the saved theme **before first paint** (no flash of the wrong palette). |

### Theme / dark mode

| File | Purpose |
| --- | --- |
| `src/context/ThemeContext.tsx` | `ThemeProvider` + `useTheme()`. Persists to `localStorage['forgeai:theme']`, falls back to the OS preference, defaults to dark. `applyTheme()` toggles `light`/`dark` classes on `<html>`. |
| `src/components/ui/ThemeToggle.tsx` | Sun/moon button in the header. |
| `tailwind.config.js` | `darkMode: 'class'`, an `xs` breakpoint, the animation keyframes (`fade-in`, `slide-up`, `slide-in-right`, `scale-in`, `shimmer`) and — the important part — the whole `gray` ramp is redefined as `rgb(var(--c-gray-N) / <alpha-value>)`. |
| `src/index.css` | Defines `--c-gray-*`. `:root` holds Tailwind's stock dark values (so dark mode looks **exactly** as before); `:root.light` inverts the ramp. |

**Why this approach:** the existing UI is built entirely on Tailwind's gray scale. Rewriting every `bg-gray-900` into a semantic token would have meant touching every component — a large, risky refactor. Instead the ramp itself became themeable, so light mode came for free and the dark design is byte-for-byte unchanged.

### Reusable UI primitives (`src/components/ui/`)

| File | Purpose |
| --- | --- |
| `Button.tsx` | One button for the whole app: `primary` / `secondary` / `ghost` / `danger`, sizes `sm`/`md`/`lg`, a `loading` state with a spinner, consistent focus rings and disabled styling. |
| `Modal.tsx` | Centered dialog rendered through a **portal** (the Builder layout is full of `overflow-hidden` ancestors), Escape to close, backdrop blur, scroll lock, `scale-in` animation. |
| `Drawer.tsx` | Right-side slide-over used by the AI Mentor. Same portal/Escape behaviour, `slide-in-right` animation, header with title, subtitle and an actions slot. |
| `States.tsx` | `EmptyState`, `ErrorState`, `ProgressBar` and `Skeleton` — the four things every panel needed and none had. |
| `src/context/ToastContext.tsx` | `ToastProvider` + `useToast()` → `toast.success/error/info/warning(message, detail?)`. Bottom-right stack, max 4, auto-dismiss after 4.5 s, portal-rendered. |

### Authentication

| File | Purpose |
| --- | --- |
| `src/lib/firebase.ts` | Initialises the app, `auth` and `db` from `VITE_FIREBASE_*` env vars. Exports `isFirebaseConfigured` so every feature can degrade gracefully. Sets `browserLocalPersistence`. |
| `src/lib/auth.ts` | Framework-free wrappers: `signInWithGoogle`, `signInWithEmail`, `signUpWithEmail`, `resetPassword`, `logout`, plus `mapAuthError()` which turns `auth/*` codes into human sentences. Kept separate from the provider so `AuthModal` and `AuthContext` don't import each other. |
| `src/context/AuthContext.tsx` | `AuthProvider` + `useAuth()`. Owns the session (`user`, `initializing`), renders the single global `AuthModal`, and exposes **`requireAuth()`**. |
| `src/components/auth/AuthModal.tsx` | Google button + email/password form with three modes (sign in / sign up / reset password), inline validation errors and a notice when Firebase isn't configured. |
| `src/components/auth/UserMenu.tsx` | Avatar (photo or gradient initials) → dropdown with the user's name/email, **My projects**, and **Log out**. Shows a *Sign in* button when logged out, a pulse placeholder while the session is restoring. |
| `src/hooks/useClickOutside.ts` | Small shared hook for dismissing the dropdown (pointer outside or Escape). |

### Generation progress

| File | Purpose |
| --- | --- |
| `src/hooks/useSequentialSteps.ts` | Drains pending steps **one at a time**: mark `in-progress` → write the file into the tree after ~160 ms → mark `completed` → next. Previously every step flipped to completed in one pass, so the user never saw the build happen. |
| `src/lib/progress.ts` | `lifecycleTasksFor(status, lastActive)` maps the WebContainer lifecycle onto two extra rows — *Installing dependencies* and *Starting development server* — so environment setup counts toward the same percentage. |
| `src/components/StepsList.tsx` *(rewritten)* | The live build log: percentage, gradient progress bar, `N of M tasks complete`, green checks for finished tasks, exactly one spinner for the active task, remaining work collapsed into `+N tasks queued`, auto-scroll to the active row. The percentage is capped at 99 % while work is outstanding so it can't hit 100 % mid-build. |
| `src/lib/fileTree.ts` | The tree operations that used to be inline in `Builder.tsx`: `upsertFile` (immutable insert), `flattenFiles`, `buildTreeFromFlat`, `toMountStructure`. Now shared by the progress runner, the WebContainer mount, the ZIP export, Firestore and the Mentor. |

### Preview

`src/components/PreviewFrame.tsx` gains a toolbar with the live URL, a **reload** button and **Open in New Tab** (`window.open(url, '_blank', 'noopener,noreferrer')`). It also reports its status upward (`onStatusChange`) and its URL (`onReady(url)`), keeps the tail of the npm output to explain a failed install, offers a **Retry**, and — importantly — only starts `npm install` when `canStart` is true, which fixes a real race where install could run before `package.json` was mounted.

### Download

`src/lib/exportProject.ts` — `downloadProjectZip({ webContainer, files, projectName })` walks the **live WebContainer filesystem** (`fs.readdir(..., { withFileTypes: true })`), skips `node_modules`, `.git`, `dist`, `.cache`, `.vite`, reads each file as bytes (so images survive), zips it with JSZip and triggers a browser download named `<project-slug>.zip`. If the container isn't up yet it falls back to the generated file tree.

### AI Mentor

| File | Purpose |
| --- | --- |
| `backend/src/mentor.ts` | The mentor prompt and its plumbing: `buildProjectDigest()` ranks files by explanatory value, truncates them into a token budget (40 files / 6 k chars each / 140 k total) and always includes the full path list; `MENTOR_SYSTEM_PROMPT` demands a **strict JSON object** with one field per required section; `parseMentorResponse()` recovers JSON even if the model wraps it in fences. |
| `backend/src/index.ts` | New `POST /mentor` route → `{ explanation, analysedFiles }`, `responseMimeType: application/json`, `temperature: 0.4`, with a dedicated 502 for unparseable output. |
| `src/lib/api.ts` | All backend calls in one typed place: `fetchTemplate`, `sendChat`, `fetchMentorExplanation`, plus `extractErrorMessage` (now also detects "backend not running") and `normalizeMentorExplanation`, which guarantees every section exists so the UI can never crash on a malformed response. |
| `src/hooks/useMentor.ts` | Owns the request: one in-flight call, result cached for the session, `explain({ force })` to regenerate, aborts on unmount, and hands the result to `onExplained` for persistence. |
| `src/components/mentor/MentorDrawer.tsx` | The right-side drawer. Ten collapsible sections — Project Overview, Folder Structure, Important Files, Component Relationships, Data Flow, Why This Architecture, Explain Like I'm New, Suggested Improvements, Interview Questions, Best Practices — each with its own layout (path chips, Q&A cards, bulleted lists). Skeleton loading state, error state with retry, empty state with a call to action. |
| `src/components/mentor/MentorText.tsx` | Tiny renderer for mentor prose: paragraph splitting plus `` `inline code` `` → styled `<code>`. No markdown dependency. |

### Project history

| File | Purpose |
| --- | --- |
| `src/lib/projects.ts` | Firestore CRUD at `users/{uid}/projects/{id}`: `createProject`, `updateProject`, `upsertProject`, `saveMentorExplanation`, `listProjects`, `getProject`, `deleteProject`. `prepareFilesForStorage()` budgets file contents (700 k chars total, 100 k per file) so a big project can't blow the 1 MiB document limit. `fromDocument()` maps defensively. |
| `src/hooks/useProjectPersistence.ts` | Used by the Builder: debounced (1.2 s) save once generation settles, a cheap signature check so nothing is written when nothing changed, create-then-update semantics (follow-up chat edits update the same document), and `persistMentor()` which queues the explanation if the document doesn't exist yet. |
| `src/hooks/useProjectHistory.ts` | Used by the Dashboard: load, refresh, optimistic delete with rollback. |
| `src/pages/Dashboard.tsx` | The `/dashboard` page: responsive card grid with project name, prompt, file count, timestamp and a *Mentor ready* badge; skeleton, empty, signed-out, unconfigured and error states; delete with confirmation; clicking a card reopens it in the Builder. |
| `src/lib/naming.ts` | `projectDisplayName(prompt)` for titles, `slugifyProjectName()` for the ZIP filename. |

### Builder

`src/pages/Builder.tsx` was rewired (same layout, same 4-column grid, same components) to orchestrate all of the above, plus:

`src/lib/builderSession.ts` — a per-tab `sessionStorage` marker (`forgeai:builder-session`) recording `{ prompt, status, projectId }`. React Router keeps `location.state` across a browser refresh, which would otherwise silently **restart** a generation the reload just killed.

---

## 3. The flows

### Authentication flow

1. `AuthProvider` mounts and subscribes to `onAuthStateChanged`. `initializing` stays true until Firebase answers, so nothing acts on a half-known session.
2. Persistence is `browserLocalPersistence` → **a refresh never logs you out**.
3. Any gated action calls `await requireAuth()`:
   - already signed in (or Firebase not configured) → resolves `true` immediately;
   - otherwise the global `AuthModal` opens and the promise stays pending;
   - successful sign-in → `handleAuthenticated(user)` resolves it `true` and the queued action continues;
   - dismissing the modal → resolves `false` and the caller aborts cleanly.
4. `UserMenu` → **Log out** calls `signOut`, toasts, and returns to the home page.

Gated today: **Generate** on the home page, the Builder's initial generation, and follow-up chat messages.

### Generation + progress flow

```
Home: Generate ──requireAuth()──> /builder {prompt}
  └─ POST /template ──> base prompts + UI prompts ──> parseXml ──> steps (pending)
  └─ POST /chat     ──> generated artifact        ──> parseXml ──> more steps (pending)
       │
       ▼  useSequentialSteps
  pending → in-progress (spinner) → file written into the tree → completed (green check)
       │
       ▼  files change
  webcontainer.mount(toMountStructure(files))   → mountReady once package.json exists
       │
       ▼  PreviewFrame (canStart)
  npm install → "Installing dependencies"  → npm run dev → "Starting development server"
       │
       ▼  server-ready
  preview URL → Ready
```

The sidebar percentage covers **file steps + lifecycle tasks**, so it only reaches 100 % when the dev server is actually running.

### Refresh behaviour

A refresh aborts the in-flight request (the page is gone) but keeps the session. On remount the Builder reads the session marker:

| Marker | Behaviour |
| --- | --- |
| none | fresh navigation → generate |
| `{ prompt, status: 'running' }` | the refresh killed that generation → blue banner: *"The page was refreshed, which stopped the generation that was running. You are still signed in."* with **Restart generation** / **Start something new**. Nothing restarts by itself. |
| `{ prompt, status: 'done', projectId }` | the project finished and was saved → it is **reloaded from history** instead of regenerating (no wasted API call) |

The marker is cleared when you deliberately navigate away, and lives in `sessionStorage` so two builder tabs never interfere.

### AI Mentor flow

1. **AI Mentor** in the header (enabled once files exist and the build has settled) opens the drawer and calls `explain()`.
2. `useMentor` flattens the tree and `POST`s `{ prompt, projectName, files }` to `/mentor`.
3. The backend ranks and truncates the files into a digest, asks Gemini for a strict JSON explanation, and validates the parse.
4. `normalizeMentorExplanation` fills any missing section, the drawer renders it, and `onExplained` → `persistMentor` writes it to the project document.
5. Reopening the drawer shows the cached explanation instantly; the ↻ button forces a fresh one. A project restored from history shows its stored explanation with **no API call at all**.

### Project history flow

1. Generation settles (`!loading && no pending steps && files.length > 0`).
2. `useProjectPersistence` waits 1.2 s, then `createProject()` → `{ name, prompt, files, steps, fileCount, mentor, createdAt, updatedAt }`.
3. Later changes (chat edits, mentor explanation) `updateProject()` the same document — the signature check means an unchanged project is never rewritten.
4. **My projects** (`/dashboard`) lists them newest-first.
5. Clicking a card → `/builder` with `{ projectId }` → `getProject()` → tree rebuilt with `buildTreeFromFlat`, steps marked completed, mentor restored, files mounted into a fresh WebContainer, preview boots.

### Download flow

**Download** → `downloadProjectZip()` → walk the live container FS (or fall back to the file tree) → JSZip (DEFLATE, level 6) → `Blob` → temporary `<a download>` → `my-project-name.zip`. A toast reports how many files were packaged, or why it failed.

### Preview flow

`useWebContainer` boots one container per Builder mount. Files mount on every change. `PreviewFrame` installs dependencies once `canStart` is true, starts the dev server, listens for `server-ready`, then shows the iframe plus the URL bar with **reload** and **Open in New Tab**. The URL also surfaces as a header button so it's reachable from the Code tab.

---

## 4. Notes and limits

- **`gemini-3.5-flash`** is used for all three routes, matching the existing configuration.
- Mentor requests are truncated to stay inside a sane token budget; very large projects are explained from their most important files (the complete path list is always sent).
- Firestore documents cap at ~1 MiB; file contents are budgeted before writing, so an unusually large project is stored truncated rather than failing.
- Without Firebase configuration the app runs fully except sign-in and history.
- `npm run build` currently runs `vite build` only. `npx tsc -b` typechecks cleanly and can be added to the build script if you want it enforced in CI.
