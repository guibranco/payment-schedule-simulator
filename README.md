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

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [PNPM](https://pnpm.io/) (or use `npm` or `yarn` if preferred)

### Installation

```bash
git clone https://github.com/your-org/payment-schedule-simulator.git
cd payment-schedule-simulator
pnpm install
````

### Development

```bash
pnpm dev
```

The app will be served at `http://localhost:5173` (or another available port).

---

## 🛠 API Configuration

At runtime, configure the backend API URL using the UI or through `localStorage` directly:

```js
localStorage.setItem('payment-simulator-api-url', 'https://api.example.com');
```

This URL will be used for all API requests and persists across sessions.

---

## 📦 Build

To generate a production build:

```bash
pnpm build
```

To preview the build locally:

```bash
pnpm preview
```

---

## 🗃️ File Uploads

The simulator accepts structured JSON schedule files for parsing and amendment. Make sure your uploaded file follows the expected schema defined by the backend API.

---

## 📤 Exporting

You can export the current simulation results as:

* **CSV**: Tabular format for spreadsheet use.
* **JSON**: Raw structured data for programmatic consumption.

---

## 🧩 Tech Stack

* **React + Vite**
* **Tailwind CSS**
* **Lucide Icons**
* **LocalStorage** for persistence
* **Fetch API** for backend communication

---

## 📝 License

MIT © \[Your Name or Company]

---

## 🙌 Contributions

Feel free to open issues or submit pull requests! Suggestions and improvements are always welcome.

```
