# ForgeAI

**Build. Learn. Launch.**

Type a sentence like *"a todo app with dark mode"* and ForgeAI writes the whole
project for you, runs it live in your browser, and then explains how the code
works — line by line, folder by folder.

---

## What it does

| | |
| --- | --- |
| ✍️ **Describe** | Tell it what you want in plain English. |
| ⚡ **Generate** | AI writes every file, one at a time, so you can watch it happen. |
| ▶️ **Preview** | The app installs and runs instantly in your browser. No setup. |
| 🎓 **AI Mentor** | Ask "how does this work?" and get a full walkthrough of the code. |
| 💾 **Save** | Sign in and every project is saved to your account. |
| 📦 **Download** | Grab the whole thing as a `.zip` and keep building. |

---

## What's inside

```
frontend/    The website you see    →  React + TypeScript + Vite + Tailwind
backend/     The AI server         →  Express + Google Gemini
```

---

## Run it yourself

You need [Node.js](https://nodejs.org) (v18 or newer) installed.

### Step 1 — Get a Gemini API key

It's free. Grab one at <https://aistudio.google.com/apikey>.

### Step 2 — Start the backend

```bash
cd backend
npm install
cp .env.example .env      # then open .env and paste your Gemini key
npm run dev
```

Runs on **http://localhost:3000**.

### Step 3 — Start the frontend

Open a **second terminal**:

```bash
cd frontend
npm install
cp .env.example .env      # optional — see Step 4
npm run dev
```

Open **http://localhost:5173** and start building. 🎉

### Step 4 — Firebase (optional)

Only needed for **sign-in** and **saved projects**. Skip it and everything else
still works.

1. Create a project at <https://console.firebase.google.com> → add a **Web app**
   → copy the config values into `frontend/.env`.
2. **Authentication → Sign-in method** → turn on **Google** and **Email/Password**.
3. **Firestore Database → Create database**.
4. Copy [`firestore.rules`](firestore.rules) into **Firestore → Rules** and publish.

---

## How it works (the short version)

```
You type a prompt
      ↓
Backend picks a starter template (React or Node)
      ↓
Gemini writes the files, one by one
      ↓
Files mount into a WebContainer  →  npm install  →  npm run dev
      ↓
Live preview appears + AI Mentor explains the code
```

A **WebContainer** is a real Node.js environment running inside your browser tab —
that's why the preview starts without installing anything on your machine.

---

## Environment variables

**`backend/.env`**

| Variable | Required | What it is |
| --- | --- | --- |
| `GEMINI_API_KEY` | ✅ | Your Google Gemini API key |
| `PORT` | — | Server port (default `3000`) |
| `GEMINI_MODEL` | — | Model to use (default `gemini-3.5-flash`) |

**`frontend/.env`**

| Variable | Required | What it is |
| --- | --- | --- |
| `VITE_BACKEND_URL` | — | Backend address (default `http://localhost:3000`) |
| `VITE_FIREBASE_*` | — | Firebase config — only for sign-in and saved projects |

---

## Commands

| Where | Command | What it does |
| --- | --- | --- |
| `backend/` | `npm run dev` | Build and start the API server |
| `frontend/` | `npm run dev` | Start the dev server |
| `frontend/` | `npm run build` | Build for production |
| `frontend/` | `npm run lint` | Check code style |

---

## Common problems

**"Failed to fetch" / nothing generates**
The backend isn't running. Check the first terminal — you should see
`🚀 Server running on port 3000`.

**"The AI service is overloaded"**
Gemini is busy. ForgeAI retries automatically and falls back to a second model.
Wait a few seconds and try again.

**Sign-in button does nothing**
`frontend/.env` has no Firebase config. Either fill it in (Step 4) or ignore it —
generation works without an account.

**Preview stays blank**
Give it a moment: it has to run `npm install` inside the browser. The sidebar
shows the progress.

---

## Want the deep dive?

[`TECHNICAL.md`](TECHNICAL.md) documents every file, every hook, and every data
flow in detail.
