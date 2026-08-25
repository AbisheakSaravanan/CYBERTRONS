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
# ONNX Model: `csi_model.onnx`

Technical specifications and quick-start guide for the CSI activity classifier.

## 1. Specifications & I/O
* **Format**: ONNX (Opset 18) exported from PyTorch 2.x
* **Input (`input`)**: `Float32[batch_size, 2, packets, subcarriers]` (Channel 0: Amplitude, Channel 1: Phase)
* **Output (`output`)**: `Float32[batch_size, 5]` (Classification logits)

## 2. Classification Classes
* `0`: Standing
* `1`: Sitting
* `2`: Walking
* `3`: Running
* `4`: Falling

## 3. Quick Start (Python)
```python
import numpy as np
import onnxruntime as ort

session = ort.InferenceSession("csi_model.onnx")
# Input shape: (batch_size, channels, packets, subcarriers)
x = np.random.rand(1, 2, 50, 114).astype(np.float32)
logits = session.run(None, {session.get_inputs()[0].name: x})[0]
predicted_class = np.argmax(logits, axis=1)[0]


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

---

## Machine Learning & ONNX Integration

The system uses a 2D CNN classification model trained on Channel State Information (CSI) amplitude and phase waveforms to classify patient activities and detect falls.

* **Model File**: `csi_model.onnx` (Opset 18)
* **Input Tensor (`input`)**: `[batch_size, 2, packets, subcarriers]` (Float32)
* **Output Tensor (`output`)**: `[batch_size, 5]` (Float32 class logits)

### Target Classification Classes
1. `Standing` (Index 0)
2. `Sitting` (Index 1)
3. `Walking` (Index 2)
4. `Running` (Index 3)
5. `Falling` (Index 4)

*For the full architecture breakdown, layer specifications, and inference code example, see [onnx_details.md](./onnx_details.md).*

