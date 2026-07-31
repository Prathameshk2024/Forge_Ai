# 🚀 ForgeAI

**ForgeAI** is an AI-powered web application that transforms a simple text prompt into a complete, runnable web project. It provides live preview, AI-powered code explanations, and project history, making it an excellent platform for learning and rapid development.

---

## ✨ Features

- 🤖 Generate complete web applications from text prompts
- ⚡ Live project preview using WebContainers
- 🧠 AI Mentor that explains generated code
- 🔐 Firebase Authentication (Google & Email)
- 💾 Save and restore projects
- 🌙 Light & Dark theme
- 📦 Download projects as ZIP
- 📱 Responsive and modern UI

---

## 🛠 Tech Stack

### Frontend
- React
- TypeScript
- Vite
- Tailwind CSS
- Firebase Authentication
- WebContainer API

### Backend
- Node.js
- Express.js
- Google Gemini API

---

## 📂 Project Structure

```
ForgeAI/
├── frontend/      # React Frontend
├── backend/       # Express Backend
├── firestore.rules
└── README.md
```

---

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/Prathameshk2024/Forge_Ai.git
cd Forge_Ai
```

### 2. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

### 3. Frontend Setup

```bash
cd ../frontend
npm install
cp .env.example .env
npm run dev
```

---

## 🔥 Firebase Setup

1. Create a Firebase project.
2. Enable **Google** and **Email/Password Authentication**.
3. Create a Firestore Database.
4. Add your Firebase configuration to `frontend/.env`.
5. Deploy the provided `firestore.rules`.

---

## 📸 Screenshots

> Add screenshots or GIFs of your application here.

---

## 🌟 Future Improvements

- Multi-language support
- AI code editing
- Team collaboration
- Deployment with one click
- More AI model integrations

---

## 👨‍💻 Author

**Prathamesh Kalshetti**

GitHub: https://github.com/Prathameshk2024

---

## 📄 License

This project is licensed under the **MIT License**.
