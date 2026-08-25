import datetime
import uuid
import numpy as np
import hashlib
from collections import defaultdict, deque
from sqlalchemy.orm import Session
from sqlalchemy import select

from .models import CSIMetadata, MLPrediction, ActivityEvent, Alert, Device, Room, Session as DBSession, AuditLog, User
from .signal_processing import process_single_packet, process_csi_window
from .ml_inference import MLInference
from .fall_logic import detect_fall_staging

# Global in-memory buffers
# Buffers raw IQ lists for filtering and windowing (max 60 packets per device MAC)
RAW_PACKET_BUFFERS = defaultdict(lambda: deque(maxlen=60))
# Buffers recent predicted movements and motion energies per room for fall staging logic
ROOM_PREDICTION_HISTORY = defaultdict(lambda: deque(maxlen=30))
ROOM_ENERGY_HISTORY = defaultdict(lambda: deque(maxlen=30))

# Initialize ML Model
ML_MODEL = MLInference()

async def ingest_csi_packet(db: Session, packet_data: dict, broadcast_func) -> dict:
    """
    Ingests a raw CSI packet from the ESP32 bridge.
    packet_data: {
        "mac_address": "AA:BB:CC:00:01:01",
        "timestamp": 123456789,
        "rssi": -50,
        "channel": 6,
        "csi": [real1, imag1, real2, imag2, ...]  # raw IQ array
    }
    """
    mac = packet_data.get("mac_address", "00:00:00:00:00:00")
    raw_iq = packet_data.get("csi", [])
    rssi = float(packet_data.get("rssi", -50.0))
    channel = int(packet_data.get("channel", 6))
    
    if not raw_iq or len(raw_iq) < 2:
        return {"status": "error", "message": "Empty or invalid CSI array"}

    # 1. Resolve Device, Room, and Active Session
    device = db.query(Device).filter(Device.mac_address == mac).first()
    if not device:
        # Auto-register a default device and room if not found to avoid drops in demo
        # Query first room
        room = db.query(Room).first()
        if not room:
            room = Room(
                room_name="Demo Room",
                room_type="ICU",
                floor="1",
                status="Active"
            )
            db.add(room)
            db.commit()
            db.refresh(room)
            
        device = Device(
            room_id=room.room_id,
            device_name=f"ESP32-Bridge-{mac[-8:]}",
            device_type="ESP32 CSI Receiver",
            mac_address=mac,
            status="Online"
        )
        db.add(device)
        db.commit()
        db.refresh(device)
    
    room_id = device.room_id
    room = db.query(Room).filter(Room.room_id == room_id).first()
    room_code = room.room_name if room else "Unknown"
    
    # Check for active session
    active_session = db.query(DBSession).filter(
        DBSession.device_id == device.device_id,
        DBSession.session_status == "Active"
    ).first()
    
    if not active_session:
        # Start a new session
        admin = db.query(User).first() # assign to system or first user
        active_session = DBSession(
            device_id=device.device_id,
            user_id=admin.user_id if admin else None,
            start_time=datetime.datetime.utcnow(),
            session_status="Active"
        )
        db.add(active_session)
        db.commit()
        db.refresh(active_session)

    # Update device heartbeat
    device.status = "Online"
    device.installed_at = datetime.datetime.utcnow() # Treat as last seen/heartbeat in DB models

    # 2. Parse Single Packet (CSI parsing, amplitude, phase)
    try:
        single_result = process_single_packet(raw_iq)
    except Exception as e:
        return {"status": "error", "message": f"Failed to parse CSI: {e}"}
        
    amplitude_list = single_result["amplitude"].tolist()
    phase_list = single_result["phase"].tolist()
    
    # Save the raw IQ data to the sliding buffer for windowed filtering
    RAW_PACKET_BUFFERS[mac].append(raw_iq)
    
    # 3. Store processed packet in csi_metadata database table
    csi_meta = CSIMetadata(
        session_id=active_session.session_id,
        device_id=device.device_id,
        room_id=room_id,
        capture_time=datetime.datetime.utcnow(),
        center_frequency_ghz=2.400,
        channel_number=channel,
        bandwidth_mhz=20,
        subcarriers=len(amplitude_list),
        sample_rate_hz=20, # Default sample rate
        packet_count=len(RAW_PACKET_BUFFERS[mac]),
        rssi_dbm=rssi,
        amplitude_waveform=amplitude_list,
        phase_waveform=phase_list
    )
    db.add(csi_meta)
    db.commit()
    db.refresh(csi_meta)
    
    # Calculate instant motion energy (standard deviation of amplitude)
    motion_energy = float(np.std(single_result["amplitude"]))
    ROOM_ENERGY_HISTORY[room_id].append(motion_energy)
    
    # 4. If buffer is large enough, perform windowed filtering and ML classification
    buffer_len = len(RAW_PACKET_BUFFERS[mac])
    predicted_movement = "no_movement"
    confidence = 95.0
    
    # We need a minimum sequence length for filtering (e.g. 20 packets)
    if buffer_len >= 20:
        try:
            # Run windowed pipeline: parsing, phase correction, filtering, windowing
            # We take the last 20 packets from the sliding buffer
            window_packets = list(RAW_PACKET_BUFFERS[mac])[-20:]
            window_result = process_csi_window(
                window_packets,
                sampling_rate=20,
                cutoff=5,
                window_size=10,
                step=5
            )
            
            # Extract latest filtered amplitude window for ML inference
            # shape of filtered_amplitude is (num_packets, num_subcarriers)
            # We pass the last 10 samples (our window size) to ML inference
            latest_window = window_result["filtered_amplitude"][-10:]
            
            # Predict activity
            history_list = list(ROOM_PREDICTION_HISTORY[room_id])
            predicted_movement, confidence = ML_MODEL.predict(latest_window, history_list)
            
        except Exception as e:
            print(f"[Ingest] Error running windowed pipeline: {e}")
            # Fallback to single packet statistical prediction
            history_list = list(ROOM_PREDICTION_HISTORY[room_id])
            predicted_movement, confidence = ML_MODEL.predict(np.expand_dims(single_result["amplitude"], axis=0), history_list)
    else:
        # Fallback for short buffers
        history_list = list(ROOM_PREDICTION_HISTORY[room_id])
        predicted_movement, confidence = ML_MODEL.predict(np.expand_dims(single_result["amplitude"], axis=0), history_list)
        
    ROOM_PREDICTION_HISTORY[room_id].append(predicted_movement)
    
    # 5. Write prediction to database
    prediction = MLPrediction(
        csi_metadata_id=csi_meta.csi_metadata_id,
        model_version_id=uuid.UUID('A0000000-0000-0000-0000-000000000002'), # Seeded Random Forest version
        predicted_movement=predicted_movement,
        confidence_score=confidence,
        prediction_time=datetime.datetime.utcnow()
    )
    db.add(prediction)
    db.commit()
    db.refresh(prediction)
    
    # 6. Evaluate Fall Staging Logic
    # Check if there is an active open or verifying alert for this room already
    existing_alert = db.query(Alert).filter(
        Alert.room_id == room_id,
        Alert.status.in_(["Verifying", "Confirmed"])
    ).first()
    
    if not existing_alert:
        # Check if the sequence stages a fall
        staged = detect_fall_staging(
            current_prediction=predicted_movement,
            current_motion_energy=motion_energy,
            recent_predictions=list(ROOM_PREDICTION_HISTORY[room_id])[:-1],
            recent_motion_energies=list(ROOM_ENERGY_HISTORY[room_id])[:-1]
        )
        
        if staged:
            print(f"[Ingest] FALL DETECTED STAGING in room {room_code}. Opening 15s verification window...")
            
            # a. Create ActivityEvent
            event = ActivityEvent(
                prediction_id=prediction.prediction_id,
                session_id=active_session.session_id,
                room_id=room_id,
                event_type="Fall Detected",
                movement="possible_fall",
                event_time=datetime.datetime.utcnow(),
                duration_seconds=0,
                severity="High"
            )
            db.add(event)
            db.commit()
            db.refresh(event)
            
            # b. Create Alert in 'Verifying' state
            alert = Alert(
                event_id=event.event_id,
                room_id=room_id,
                alert_type="Fall Detection",
                message=f"Possible fall detected in room {room_code}. Verifying stillness...",
                severity="High",
                status="Verifying" # 15s verification stage
            )
            db.add(alert)
            
            # c. Create Audit Log entry
            prev_log = db.query(AuditLog).order_by(AuditLog.created_at.desc()).first()
            prev_hash = prev_log.curr_hash if prev_log else "0" * 32
            now_iso = datetime.datetime.utcnow().isoformat()
            curr_hash_input = f"{prev_hash}|SYSTEM|STAGE_FALL_ALERT|{now_iso}"
            curr_hash = hashlib.sha256(curr_hash_input.encode()).hexdigest()
            
            audit = AuditLog(
                action="STAGE_FALL_ALERT",
                table_name="alerts",
                record_id=alert.alert_id,
                details=f"Possible fall staged for room {room_code}. Verification timer started.",
                ip_address="127.0.0.1",
                prev_hash=prev_hash,
                curr_hash=curr_hash
            )
            db.add(audit)
            db.commit()
            
            # Override prediction/activity status to 'possible_fall'
            predicted_movement = "possible_fall"
            
    else:
        # If alert is already active, check if patient recovered
        # If alert is Verifying and they recovered (walking, sitting, standing)
        if existing_alert.status == "Verifying" and predicted_movement in ["walking", "standing", "sitting"]:
            print(f"[Ingest] Patient in room {room_code} recovered. Auto-resolving alert...")
            existing_alert.status = "Resolved"
            existing_alert.message = f"Alert resolved: patient recovered to {predicted_movement}."
            
            # Create Audit Log
            prev_log = db.query(AuditLog).order_by(AuditLog.created_at.desc()).first()
            prev_hash = prev_log.curr_hash if prev_log else "0" * 32
            now_iso = datetime.datetime.utcnow().isoformat()
            curr_hash_input = f"{prev_hash}|SYSTEM|RESOLVE_ALERT|{now_iso}"
            curr_hash = hashlib.sha256(curr_hash_input.encode()).hexdigest()
            
            audit = AuditLog(
                action="RESOLVE_ALERT",
                table_name="alerts",
                record_id=existing_alert.alert_id,
                details=f"Alert auto-resolved in room {room_code} due to recovery (activity: {predicted_movement})",
                ip_address="127.0.0.1",
                prev_hash=prev_hash,
                curr_hash=curr_hash
            )
            db.add(audit)
            db.commit()
            
        elif existing_alert.status == "Verifying":
            # Force the active state to reflect the staging
            predicted_movement = "possible_fall"
        elif existing_alert.status == "Confirmed":
            # Force the active state to reflect confirmed fall
            predicted_movement = "confirmed_fall"

    # 7. Check if we should log normal activity transition events
    # If prediction changed from previous, log a Movement Detected event
    recent_history = list(ROOM_PREDICTION_HISTORY[room_id])
    if len(recent_history) >= 2:
        prev_movement = recent_history[-2]
        if prev_movement != predicted_movement and predicted_movement not in ["possible_fall", "confirmed_fall"]:
            event = ActivityEvent(
                prediction_id=prediction.prediction_id,
                session_id=active_session.session_id,
                room_id=room_id,
                event_type="Movement Detected",
                movement=predicted_movement,
                event_time=datetime.datetime.utcnow(),
                duration_seconds=5,
                severity="Normal"
            )
            db.add(event)
            db.commit()

    # Trigger WebSocket broadcast with updated system state
    await broadcast_func()
    
    return {
        "status": "success",
        "predicted_movement": predicted_movement,
        "confidence": confidence,
        "motion_energy": motion_energy
    }
