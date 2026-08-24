# Aegis-CSI — Camera-Free Hospital Monitoring Frontend

A production-grade React + TypeScript command-center UI for Wi-Fi CSI (Channel
State Information) based human-activity monitoring in a hospital setting.
Zero cameras, zero video — every "sensor reading" in this build is simulated
telemetry standing in for a CNN/LSTM CSI classification pipeline.

## Stack
React 19 · TypeScript · Vite · Tailwind CSS v4 · Zustand · Recharts · lucide-react

## Run it
```
npm install
npm run dev      # http://localhost:5173
npm run build    # production build to dist/
```

## Using the demo
1. On the login screen, enter any Employee ID (3+ chars) and password (4+
   chars), pick a role, then continue.
2. On the MFA screen, enter any 6-digit code other than `000000`.
3. Explore the Command Dashboard, click into a room, switch roles (top right)
   to see RBAC-gated views — Technician/Administrator unlocks the Technical
   CSI Engineering tab in Room Detail.
4. Use "Simulate fall event" on the dashboard to trigger the full
   possible-fall → 15s verification → confirmed-fall → acknowledge → escalate
   flow, including the full-screen critical alert modal.
5. Try "Break-glass" in the top bar for the emergency-access flow, and check
   the Audit Log view afterward — every action is hash-chained.
6. Open "Assistant" (top bar) and ask things like "summarize fall events" or
   "triage protocol for an unverified fall" — it's a read-only, source-cited
   mock RAG copilot over the session's own event/SOP data.

## Notes
- All hashes are non-cryptographic stubs for UI demonstration only — do not
  use `cryptoLikeHash` in `src/lib/mockEngine.ts` for any real security
  purpose.
- The realtime engine (`useStore.ts` → `startEngine`) drifts room telemetry
  on an interval and occasionally injects a spontaneous fall to keep the
  dashboard feeling alive; swap it for a real WebSocket client against your
  inference service when integrating with actual hardware.
