# CSI Signal Processing Module

## 1. Overview

The CSI Signal Processing module is responsible for converting raw Channel State Information (CSI) collected from an ESP32 Wi-Fi device into clean, structured signal data suitable for Machine Learning (ML).

CSI describes how a wireless signal changes while travelling between a transmitter and receiver. When an object interacts with the Wi-Fi signal, characteristics such as amplitude and phase can change because of reflection, scattering, absorption, and multipath propagation.

The purpose of this module is to extract and clean these signal characteristics before they are provided to the ML module.

---

# 2. Role of the Module

The CSI Signal Processing module acts as the intermediate layer between the ESP32 CSI collection system and the Machine Learning system.

```text
ESP32
  |
  | Raw CSI
  ↓
CSI Signal Processing
  |
  | Processed Amplitude + Phase
  ↓
ML Module
  |
  | Prediction
  ↓
Decision Engine
  |
  | Decision
  ↓
Frontend

CSI Parsing
Description

The raw CSI data received from the ESP32 is initially in a serial/text format.

The parser reads each CSI record and separates the timestamp, RSSI, validity information, and CSI values.

The interleaved imaginary and real values are then converted into numerical arrays.

Input
Raw CSI serial record
Processing
Raw CSI
   ↓
Read record
   ↓
Separate fields
   ↓
Extract Real and Imaginary values
   ↓
Create structured CSI data
Output
Structured CSI values

Complex CSI Construction

CSI is represented using complex numbers.

Each CSI subcarrier contains a real and imaginary component.

The complex representation is:

CSI = Real + j × Imaginary

For example:

Real = 10
Imaginary = 5

The complex CSI becomes:

10 + 5j
Example
Real       Imaginary       Complex CSI
10         5               10 + 5j
12         6               12 + 6j
14         7               14 + 7j


Amplitude Extraction
Description

Amplitude represents the magnitude or strength of the CSI signal.

It is calculated from the real and imaginary components of each complex CSI value.

The formula is:

Amplitude = √(Real² + Imaginary²)

In Python, NumPy can calculate this directly using:

amplitude = np.abs(csi)
Example

For:

CSI = 10 + 5j

The amplitude is:

√(10² + 5²)
= √125
= 11.18

Phase Extraction
Description

Phase represents the angular position of the CSI signal.

The phase is calculated from the real and imaginary components.

The formula is:

Phase = atan2(Imaginary, Real)

In Python:

phase = np.angle(csi)
Example

For:

Real = 10
Imaginary = 5

The phase is approximately:

0.464 radians

Phase Correction
Description

Raw CSI phase contains unwanted variations caused by hardware and communication-system effects.

Examples include:

Carrier Frequency Offset (CFO)
Sampling Frequency Offset (SFO)
Hardware phase offsets
Timing-related phase errors

These variations can make it difficult for the ML model to identify meaningful changes caused by objects.

Phase correction reduces these unwanted components.

Processing
Raw Phase
    ↓
Identify phase trend / offset
    ↓
Estimate unwanted phase variation
    ↓
Remove estimated variation
    ↓
Corrected Phase

A common phase correction approach is to estimate a linear phase trend across subcarriers and subtract it from the measured phase.

Conceptually:

Corrected Phase
=
Measured Phase
-
Estimated Phase Error

Filtering
Description

CSI measurements can contain noise and unwanted high-frequency variations.

Filtering smooths the signal while preserving the useful variations required for sensing.

The current implementation uses a Butterworth low-pass filter.

Filter
Butterworth Low-Pass Filter

Example implementation:

from scipy.signal import butter, sosfiltfilt

The filter parameters include:

Parameter	Example
Filter type	Low-pass
Cutoff frequency	5 Hz
Order	4
Sampling rate	Depends on CSI capture rate
Processing
Raw Signal
    ↓
Butterworth Filter
    ↓
Noise Reduction
    ↓
Smoothed Signal

Windowing
Description

CSI data is continuously received as packets.

The ML model cannot always process an unlimited continuous stream directly, so the signal is divided into fixed-size sections called windows.

For example:

10 packets = 1 window

If every packet contains 4 subcarriers:

1 window = 10 × 4

Multiple windows form a 3D array.

Shape
(Windows, Packets, Subcarriers)

For example:

(3, 10, 4)

means:

3 windows
10 packets per window
4 subcarriers per packet
