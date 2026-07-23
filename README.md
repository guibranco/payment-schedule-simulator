# 💸📅 Payment Schedule Simulator

An interactive **Vite + React + TypeScript** UI for simulating, inspecting, and comparing insurance payment schedules. It talks to a backend Payment Schedule API (Azure AD / OAuth2 with PKCE) and also works fully offline against pasted or uploaded JSON.

---

## ✨ Features

- **New Schedule (Inception):** Build a payment schedule from scratch by calling the backend API, or load a JSON request to prefill the form.
- **Amend Schedule:** Apply changes to an existing schedule, with admin fees and taxes/levies aggregated from the current schedule's items.
- **View Schedule:** Paste, upload, or pick a sample JSON document and auto-detect which of the 4 supported shapes it is:
  - Payment Schedule Service Response
  - Payment Schedule Service Request
  - Policy Admin CosmosDB Document
  - Rerates CosmosDB Document
- **Compare Schedules:** Load two schedules (of any supported format) side by side to diff their items.
- **Export:** Download a displayed schedule as **JSON**, **CSV**, **PDF**, **HTML**, **PNG**, or **SVG** (image exports are rendered via `html2canvas`, PDF via `jspdf`); the last-used format is remembered.
- **Authentication:** OAuth2 Authorization Code + PKCE flow against Azure AD (Microsoft Entra ID), with automatic silent token refresh before expiry and a live token status indicator in the header.
- **API Config:** Configure the backend base URL/port, tenant ID, client ID, and environment (prod/int/stg) at runtime; settings persist in `localStorage`.

---

## 🧱 Tech Stack

- [Vite](https://vitejs.dev/) – Frontend build tool
- [React 19](https://reactjs.org/) + TypeScript – UI library
- [Tailwind CSS v4](https://tailwindcss.com/) – Utility-first CSS
- [lucide-react](https://lucide.dev/) – Icons
- [html2canvas](https://html2canvas.hertzen.com/) / [jsPDF](https://github.com/parallax/jsPDF) – PNG/SVG/PDF export
- [Vitest](https://vitest.dev/) + Testing Library – Unit/component tests
- ESLint + typescript-eslint – Linting

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 24 (see `.nvmrc`; run `nvm use` if you use nvm)

### Installation

```bash
git clone https://github.com/guibranco/payment-schedule-simulator.git
cd payment-schedule-simulator
npm install
```

### Run locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) to use the app in your browser.

On first launch, the Configuration dialog prompts for the backend API base URL, Azure AD tenant ID, and client ID; use the displayed Redirect URI when registering the app in Azure AD. You can skip this and still use **View Schedule** and **Compare Schedules** entirely offline with pasted/sample JSON.

---

## 🧪 Testing & Linting

```bash
npm run test       # run the test suite once
npm run test:watch # watch mode
npm run coverage    # run tests with coverage
npm run lint        # lint the codebase
```

---

## 📦 Build for Production

```bash
npm run build
```

The static site will be available in the `dist/` folder. Preview it locally with `npm run preview`.

---

## 📂 Folder Structure

```
payment-schedule-simulator/
├── public/
├── src/
│   ├── components/    # NewSchedule, AmendSchedule, ViewSchedule, CompareSchedules,
│   │                  # ScheduleDisplay, ConfigDialog, TokenStatus, JsonLoader, etc.
│   ├── hooks/         # useTokenManager (OAuth token lifecycle)
│   ├── utils/         # scheduleDetector, scheduleImage, pkce, url, errorHandler
│   ├── constants/      # storage keys, sample schedules
│   ├── types/          # shared TypeScript types
│   ├── App.tsx
│   └── main.tsx
├── tests/
├── index.html
└── vite.config.ts
```

---

## 📄 License

MIT License © Guilherme Branco Stracini

---

## 🙌 Contributions

Feel free to open issues or submit pull requests! Suggestions and improvements are always welcome.
