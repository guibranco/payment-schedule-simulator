# 💸📅 Payment Schedule Simulator

A simple and interactive UI built with **Vite + React** to simulate and manage payment schedules. You can create new schedules, apply amendments, upload existing ones for parsing, and export them in CSV or JSON format. The app communicates with a backend API that is runtime-configurable and persists its endpoint in `localStorage`.

---

## ✨ Features

- **Create (Inception):** Start a new payment schedule from scratch.
- **Amend:** Modify an existing schedule by applying changes.
- **Upload:** Import an existing schedule file and parse it.
- **Export:** Download generated schedules as **CSV** or **JSON**.
- **API Config:** Set the backend API endpoint dynamically at runtime.
- **Persistent Settings:** Stores API config in `localStorage`.

---

## 🧱 Tech Stack

- [Vite](https://vitejs.dev/) – Fast frontend build tool
- [React](https://reactjs.org/) – UI library
- [Tailwind CSS](https://tailwindcss.com/) – Utility-first CSS

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18

### Installation

```bash
git clone https://github.com/guibranco/payment-schedule-simulator.git
cd payment-schedule-simulator
npm install
````

### Run locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) to use the app in your browser.

---

## 📦 Build for Production

```bash
npm run build
```

The static site will be available in the `dist/` folder.

---

## 📂 Folder Structure

```
payment-schedule-simulator/
├── public/
├── src/
│   ├── components/
│   ├── hooks/
│   ├── utils/
│   ├── App.tsx
│   └── main.tsx
├── index.html
├── tailwind.config.js
└── vite.config.ts
```

---

## 📄 License

MIT License © Guilherme Branco Stracini

---

## 🙌 Contributions

Feel free to open issues or submit pull requests! Suggestions and improvements are always welcome.

