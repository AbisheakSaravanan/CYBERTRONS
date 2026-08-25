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
# ONNX Model Specifications: CSI Activity Classifier

## 1. Project Overview & Clinical Context
Our solution features a state-of-the-art **Channel State Information (CSI) Classifier** designed for non-intrusive, privacy-preserving Human Activity Recognition (HAR). By utilizing standard Wi-Fi subcarrier signals, the system detects micro-fluctuations in amplitude and phase caused by human movement. This device-free approach requires no wearable sensors or privacy-infringing cameras, making it ideal for continuous, real-time patient monitoring in hospitals and smart-home care environments.

---

## 2. Input Signal Representation (Dual-Channel CSI Matrix)
Rather than treating CSI data as a simple 1D stream, our model processes it as a **dual-channel 2D image** representing spatial-temporal signal patterns:
* **Channel 0 (Amplitude)**: Captures the raw energy variations and signal attenuation profile.
* **Channel 1 (Phase)**: Tracks the frequency shift and angular changes in signal paths.
* **Temporal Dynamic Windowing**: Dynamically captures a sequence of Wi-Fi packets over time, allowing the model to adapt to varying sampling rates and signal lengths.

---

## 3. Deep Learning Architecture
The neural network employs a custom **2D Convolutional Neural Network (CNN)** designed to extract deep spatial-temporal signatures from the raw CSI streams:
* **Feature Extraction**: Two consecutive Conv2D layers with Batch Normalization and ReLU activations extract high-level feature maps (such as periodic gait patterns or sudden energy spikes).
* **Adaptive Spatial Compression**: An *Adaptive Average Pooling* layer compresses variable packet and subcarrier sizes into a fixed-dimensional latent representation. This enables the model to support different Wi-Fi bandwidth settings (e.g., 20MHz/40MHz) without retraining.
* **Classification Head**: Fully connected layers map the extracted features to class probabilities across 5 target actions.

---

## 4. Key Engineering & Optimization Highlights
* **ONNX Edge Optimization**: The model is exported to the Open Neural Network Exchange (ONNX) format with **Constant Folding** enabled, significantly reducing inference latency and memory footprint.
* **Dynamic Tensor Configurations**: Support for dynamic batch sizes and sequence lengths ensures high flexibility for real-time edge deployment on CPU/GPU hardware.
* **Robust Event Detection**:
  * **Standing / Sitting**: Identified by flat, stable amplitude profiles.
  * **Walking / Running**: Identified by periodic oscillatory patterns (1.5 Hz to 3 Hz).
  * **Fall Detection**: Identified by a distinct high-energy signal spike followed by a sudden drop to near-zero amplitude, indicating a rapid level change and subsequent lack of motion.

---
