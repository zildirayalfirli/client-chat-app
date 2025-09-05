# Realtime Chat — Frontend (React + Vite)

A lightweight React client for a realtime chat backend (Express + MongoDB + Socket.IO + JWT).

## ✨ Features
- Login / Register (JWT)
- Rooms: list, create, join
- Realtime messages (Socket.IO) + HTTP send fallback
- Typing indicator (value-based: true when input has text; false when cleared)
- Online/offline presence via `presence` snapshot and `userOnline/userOffline`

---

## 🧰 Prerequisites
- Node.js 18+ (LTS recommended)
- A running backend API & Socket.IO server
  - default: `http://localhost:4000`

---

## ⚙️ Environment
Create a `.env` in the repo root:

```env
VITE_API_URL=http://localhost:4000
VITE_SOCKET_URL=http://localhost:4000
```

## 🚀 Run Locally
npm install
npm run dev
→ http://localhost:5173
