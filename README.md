# Aegis CSI Hospital Monitor

**Aegis CSI Hospital Monitor** is a real-time, non-invasive patient monitoring and telemetry dashboard powered by Channel State Information (CSI) sensing analytics. It provides healthcare staff with continuous telemetry, motion analytics, posture tracking, and alert dispatching across hospital wards.

---

## Key Features

* **Live Telemetry & Vital Streams:** Real-time CSI signal processing, vital sign tracking, and dynamic waveform rendering via Recharts.
* **Intelligent Alerts & Fall Detection:** Automated severity classification (`critical`, `warning`), modal emergency triggers, and quick alert acknowledgement.
* **Dual Clinical & Technical Views:** Seamlessly switch between clinical summaries (patient status, timeline, gauge confidence) and RF technical views (subcarrier amplitude, phase shifts, link health).
* **Ward & Room Filtering:** Multi-ward command dashboard with dynamic status filtering (Occupied, Alert, Normal).
* **Enterprise Security & Compliance:** Multi-Factor Authentication (MFA) workflows, Emergency Break-Glass protocols, and tamper-evident audit logging.
* **Local State Management:** Fast, predictable client state powered by Zustand with reactive mock telemetry streams.

---

## Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Framework** | [React 18+](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) |
| **Build Tooling** | [Vite](https://vitejs.dev/) |
| **State Management** | [Zustand](https://github.com/pmndrs/zustand) |
| **UI & Styling** | [Tailwind CSS](https://tailwindcss.com/) + [Lucide React](https://lucide.dev/) |
| **Data Visualization** | [Recharts](https://recharts.org/) |
| **Linting & Quality** | [Oxlint](https://oxc-project.github.io/) |

---

## Project Structure

```text
src/
├── components/
│   ├── alerts/       # Fall alert modals and priority notifications
│   ├── assistant/    # AI / Clinical assistant drawer
│   ├── audit/        # Security and compliance audit logs
│   ├── auth/         # MFA, Break-Glass protocols, Login
│   ├── dashboard/    # Command dashboard, ward filters, room grids
│   ├── health/       # Sensor mesh health & telemetry status
│   ├── layout/       # Sidebar and top navigation bars
│   ├── room/         # Room details, ClinicalView, TechnicalView, AlertPanel
│   └── ui/           # Confidence gauges, badges, waveform strips
├── lib/
│   ├── mockEngine.ts # Real-time synthetic CSI signal generator
│   └── utils.ts      # Class merging and formatting helpers
├── store/
│   └── useStore.ts   # Global Zustand store (alerts, rooms, audit, user state)
├── types/
│   └── index.ts      # TypeScript definitions for rooms, CSI signals, alerts
├── App.tsx           # Main application root
└── main.tsx          # React DOM entry point