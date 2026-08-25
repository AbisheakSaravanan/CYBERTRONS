import time
import random
import argparse
import requests
import json
import numpy as np

# We try to import serial, but make it optional so that simulation mode
# can run on machines without serial drivers (e.g. typical VM or container).
try:
    import serial
except ImportError:
    serial = None

# --- CONFIGURATION ---
DEFAULT_URL = "http://localhost:8000/api/ingest"
DEFAULT_PORT = "COM7"
BAUD_RATE = 115200
NUM_SUBCARRIERS = 64

# Generate list of seeded MAC addresses matching the database seeding:
# AA:BB:CC:00:00:01 to AA:BB:CC:00:00:08 (8 ICU rooms)
MACS = [f"AA:BB:CC:00:00:{i:02X}" for i in range(1, 9)]

def generate_synthetic_csi(activity="no_movement", t=0.0):
    """
    Generates a synthetic raw IQ CSI array (length 128 for 64 subcarriers)
    matching the requested activity signature.
    """
    iq = []
    
    # Define parameters based on activity
    if activity == "walking":
        noise_amp = 8.0
        wave_amp = 15.0
        freq = 3.0
    elif activity == "impact": # Fall impact spike
        noise_amp = 25.0
        wave_amp = 40.0
        freq = 8.0
    elif activity == "lying" or activity == "no_movement":
        noise_amp = 1.0
        wave_amp = 2.0
        freq = 0.5
    else: # sitting/standing
        noise_amp = 3.0
        wave_amp = 6.0
        freq = 1.5
        
    for i in range(NUM_SUBCARRIERS):
        # Base signal carrier shape + time-varying wave + noise
        base_real = 25.0 + wave_amp * np.sin(i / 5.0 + t * freq)
        base_imag = 15.0 + wave_amp * np.cos(i / 5.0 + t * freq)
        
        real_val = int(base_real + np.random.normal(0, noise_amp))
        imag_val = int(base_imag + np.random.normal(0, noise_amp))
        
        iq.extend([real_val, imag_val])
        
    return iq

def run_simulation(url):
    print(f"Starting ESP32 CSI Bridge Simulator...")
    print(f"Target backend endpoint: {url}")
    print(f"Simulating {len(MACS)} devices. Press CTRL+C to stop.")
    
    # State tracking to simulate specific scenarios (like occasional falls)
    # room_states: { mac: { 'activity': str, 'timer': int } }
    room_states = {}
    for mac in MACS:
        room_states[mac] = {
            "activity": "no_movement",
            "timer": 0,
            "t": random.random() * 100.0
        }
        
    # Pick one room to periodically trigger a fall scenario in
    fall_candidate = random.choice(MACS)
    room_states[fall_candidate]["timer"] = random.randint(120, 240) # time in ticks until fall (60 to 120 seconds)
    
    tick = 0
    while True:
        try:
            tick += 1
            # Every tick (0.5s), send updates for a subset of rooms to keep traffic realistic
            active_macs = random.sample(MACS, k=4)
            
            # Always update our fall candidate to show the sequence
            if fall_candidate not in active_macs:
                active_macs.append(fall_candidate)
                
            for mac in active_macs:
                state = room_states[mac]
                state["t"] += 0.5
                
                # Manage state transitions
                if mac == fall_candidate:
                    state["timer"] -= 1
                    if state["timer"] <= 0:
                        if state["activity"] == "no_movement":
                            # Start fall sequence: impact -> lying -> recovery
                            print(f"\n[Simulator] >>> Triggering Fall Event Sequence in device {mac} <<<")
                            state["activity"] = "impact"
                            state["timer"] = 3 # 1.5 seconds of high-energy impact
                        elif state["activity"] == "impact":
                            state["activity"] = "lying"
                            state["timer"] = 35 # 17.5 seconds of complete stillness (lying)
                        elif state["activity"] == "lying":
                            # Recovery: Stand up and walk
                            print(f"[Simulator] >>> Triggering Recovery Sequence in device {mac} <<<")
                            state["activity"] = "walking"
                            state["timer"] = 15 # 7.5 seconds of walking
                        else: # walking
                            # Return to normal
                            state["activity"] = "no_movement"
                            # Pick a new candidate room for the next fall
                            fall_candidate = random.choice(MACS)
                            room_states[fall_candidate]["timer"] = random.randint(240, 480)
                            print(f"[Simulator] Resetting candidate. Next fall candidate: {fall_candidate}\n")
                            state["timer"] = random.randint(30, 60)
                else:
                    # Shift activities smoothly without sudden walking-to-stillness jumps to prevent false fall triggers
                    if random.random() > 0.98:
                        if state["activity"] == "walking":
                            state["activity"] = "standing"
                        else:
                            state["activity"] = random.choice(["no_movement", "sitting", "standing"])
                        
                # Generate CSI array
                csi = generate_synthetic_csi(state["activity"], state["t"])
                
                # Construct payload
                payload = {
                    "mac_address": mac,
                    "timestamp": int(time.time() * 1000),
                    "rssi": float(random.randint(-75, -45)),
                    "channel": 6,
                    "csi": csi
                }
                
                # Send HTTP POST to FastAPI Ingest
                try:
                    res = requests.post(url, json=payload, timeout=2.0)
                    if res.status_code == 200:
                        pred = res.json().get("predicted_movement", "unknown")
                        energy = res.json().get("motion_energy", 0.0)
                        # Print status for fall candidate
                        if mac == fall_candidate or state["activity"] in ["impact", "lying"]:
                            print(f"MAC: {mac} | State: {state['activity']:12s} | Ingest Prediction: {pred:14s} | Energy: {energy:.2f}")
                    else:
                        print(f"Error POSTing: Status {res.status_code} - {res.text}")
                except requests.exceptions.RequestException as e:
                    print(f"Network error: {e}")
                    
            time.sleep(0.5)
            
        except KeyboardInterrupt:
            print("\nStopping Simulator...")
            break

def run_serial(url, port):
    if not serial:
        print("Error: 'pyserial' package is not installed. Cannot run in serial mode.")
        return
        
    print(f"Connecting to ESP32 on port {port} at {BAUD_RATE} baud...")
    try:
        ser = serial.Serial(port, BAUD_RATE, timeout=1.0)
        print(f"Connected to ESP32! Relaying CSI data to {url}...")
    except Exception as e:
        print(f"Failed to connect to serial port {port}: {e}")
        return
        
    # We default the relay MAC address. In a real deployment, the ESP32 would report
    # its MAC address or we can infer it.
    device_mac = MACS[0] # Map to room 1
    
    try:
        while True:
            raw = ser.readline()
            if not raw:
                continue
            try:
                line_text = raw.decode("utf-8", errors="ignore").strip()
            except Exception:
                continue
                
            if not line_text.startswith("CSI,"):
                continue
                
            parts = line_text.split(",")
            if len(parts) < 6:
                continue
                
            try:
                timestamp = int(parts[1])
                rssi = int(parts[2])
                channel = int(parts[3])
                length = int(parts[4])
                
                csi_values = []
                for val in parts[5:]:
                    try:
                        csi_values.append(int(val))
                    except ValueError:
                        continue
                        
                if not csi_values:
                    continue
                    
                # Format payload
                payload = {
                    "mac_address": device_mac,
                    "timestamp": timestamp,
                    "rssi": float(rssi),
                    "channel": channel,
                    "csi": csi_values
                }
                
                # Relay to ingest endpoint
                try:
                    res = requests.post(url, json=payload, timeout=1.0)
                    if res.status_code == 200:
                        pred = res.json().get("predicted_movement")
                        print(f"Relayed packet | RSSI={rssi} | Subcarriers={len(csi_values)//2} | Pred={pred}")
                    else:
                        print(f"Relay Error: Ingest returned {res.status_code}")
                except Exception as ex:
                    print(f"HTTP Post Error: {ex}")
                    
            except Exception as e:
                print(f"Parsing error: {e}")
                
    except KeyboardInterrupt:
        print("\nStopping Serial Bridge...")
    finally:
        ser.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AegisCSI ESP32 Relaying Bridge & Simulator")
    parser.add_argument("--url", default=DEFAULT_URL, help=f"FastAPI Ingestion Endpoint URL (default: {DEFAULT_URL})")
    parser.add_argument("--port", default=DEFAULT_PORT, help=f"ESP32 Serial Port (default: {DEFAULT_PORT})")
    parser.add_argument("--simulate", action="store_true", help="Run in mock/simulation mode (no physical device required)")
    
    args = parser.parse_args()
    
    if args.simulate:
        run_simulation(args.url)
    else:
        run_serial(args.url, args.port)
