import os
import json
import datetime
import uuid
import hashlib
import asyncio
from typing import List
from fastapi import FastAPI, Depends, WebSocket, WebSocketDisconnect, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, select, update
from sqlalchemy.orm import sessionmaker, Session
from pydantic import BaseModel

from .models import Base, User, Role, Room, Device, ModelVersion, Session as DBSession, CSIMetadata, MLPrediction, ActivityEvent, Alert, AuditLog
from .ingest import ingest_csi_packet
from .alert_sweeper import alert_sweeper_loop

# --- CONFIGURATION ---
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./aegis_csi.db")

app = FastAPI(title="AegisCSI Hospital Monitor Backend")

# CORS middleware to allow connection from React Vite app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- DATABASE SETUP ---
# For SQLite, we use connect_args to avoid sharing session threads errors
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- WEBSOCKET CONNECTION MANAGER ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"[WebSocket] Connected client. Total clients: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            print(f"[WebSocket] Disconnected client. Total clients: {len(self.active_connections)}")

    async def broadcast(self, message: str):
        # We make a copy of active connections to prevent modification issues
        for connection in list(self.active_connections):
            try:
                await connection.send_text(message)
            except Exception as e:
                print(f"[WebSocket] Broadcast failed to connection: {e}")
                self.disconnect(connection)

manager = ConnectionManager()

# Helper to fetch and serialize full system state
def get_serialized_state(db: Session) -> str:
    # 1. Fetch Rooms and map to Frontend format
    db_rooms = db.query(Room).all()
    rooms_data = []
    
    for r in db_rooms:
        # Get latest prediction
        latest_pred = db.query(MLPrediction).join(CSIMetadata).filter(
            CSIMetadata.room_id == r.room_id
        ).order_by(MLPrediction.prediction_time.desc()).first()
        
        # Determine current activity and details
        activity = "no_movement"
        confidence = 95.0
        post_event_vector = "low"
        timestamp = datetime.datetime.utcnow().isoformat() + "Z"
        
        if latest_pred:
            activity = latest_pred.predicted_movement
            confidence = float(latest_pred.confidence_score) if latest_pred.confidence_score else 95.0
            timestamp = latest_pred.prediction_time.isoformat() + "Z"
            
            # Map motion energy to vector
            # Find RSSI or metadata to calculate motion energy
            meta = latest_pred.csi_metadata
            if meta and meta.amplitude_waveform:
                # std of amplitude waveform
                import numpy as np
                std = float(np.std(meta.amplitude_waveform))
                if std < 0.2:
                    post_event_vector = "low"
                elif std < 1.0:
                    post_event_vector = "medium"
                else:
                    post_event_vector = "high"
        
        # Check active alerts for verifying/confirmed stages
        active_alert = db.query(Alert).filter(
            Alert.room_id == r.room_id,
            Alert.status.in_(["Verifying", "Confirmed"])
        ).first()
        
        if active_alert:
            activity = "possible_fall" if active_alert.status == "Verifying" else "confirmed_fall"
            post_event_vector = "high" if active_alert.status == "Confirmed" else "medium"
            
        current_reading = {
            "activity": activity,
            "confidence": confidence,
            "postEventVector": post_event_vector,
            "timestamp": timestamp
        }
        
        # Get recent history (last 15 predictions)
        history_preds = db.query(MLPrediction).join(CSIMetadata).filter(
            CSIMetadata.room_id == r.room_id
        ).order_by(MLPrediction.prediction_time.desc()).limit(15).all()
        
        history = []
        for hp in reversed(history_preds):
            hp_activity = hp.predicted_movement
            # Ensure it aligns with active alerts
            h_time = hp.prediction_time.isoformat() + "Z"
            history.append({
                "activity": hp_activity,
                "confidence": float(hp.confidence_score) if hp.confidence_score else 90.0,
                "postEventVector": "low" if hp.confidence_score and hp.confidence_score > 90 else "medium",
                "timestamp": h_time
            })
            
        if not history:
            history = [current_reading]
            
        # Check sensor online status
        device = db.query(Device).filter(Device.room_id == r.room_id).first()
        sensor_online = False
        if device and device.status == "Online":
            # Check last active time (installed_at is used as last seen)
            last_seen = device.installed_at
            if last_seen and (datetime.datetime.utcnow() - last_seen).total_seconds() < 30.0:
                sensor_online = True
                
        rooms_data.append({
            "id": str(r.room_id),
            "code": r.room_name,
            "ward": r.room_type,
            "patientToken": f"PT-{r.room_type[:2].upper()}-{str(r.room_id.hex)[:4].upper()}",
            "sensorOnline": sensor_online,
            "current": current_reading,
            "history": history,
            "lastUpdated": timestamp
        })
        
    # 2. Fetch Active Alerts and map to Frontend format
    db_alerts = db.query(Alert).filter(
        Alert.status.in_(["Verifying", "Confirmed", "Acknowledged", "Escalated"])
    ).order_by(Alert.created_at.desc()).all()
    
    alerts_data = []
    for a in db_alerts:
        room = db.query(Room).filter(Room.room_id == a.room_id).first()
        # Find who acknowledged
        ack_by = None
        if a.acknowledged_by:
            ack_user = db.query(User).filter(User.user_id == a.acknowledged_by).first()
            if ack_user:
                ack_by = ack_user.name
                
        verification_ends = None
        if a.status == "Verifying":
            verification_ends = (a.created_at + datetime.timedelta(seconds=15)).isoformat() + "Z"
            
        alerts_data.append({
            "id": str(a.alert_id),
            "roomId": str(a.room_id),
            "roomCode": room.room_name if room else "Unknown",
            "ward": room.room_type if room else "General Ward",
            "stage": a.status.lower(),  # verifying, confirmed, acknowledged, escalated
            "confidence": 92.0,
            "postEventVector": "high" if a.status == "Confirmed" else "medium",
            "verificationEndsAt": verification_ends,
            "createdAt": a.created_at.isoformat() + "Z",
            "acknowledgedBy": ack_by,
            "acknowledgedAt": a.acknowledged_at.isoformat() + "Z" if a.acknowledged_at else None,
            "escalatedAt": a.created_at.isoformat() + "Z" if a.status == "Escalated" else None
        })
        
    # 3. Fetch Sensors and map to Frontend format
    db_devices = db.query(Device).all()
    sensors_data = []
    for idx, d in enumerate(db_devices):
        room = db.query(Room).filter(Room.room_id == d.room_id).first()
        mac = d.mac_address or "AA:BB:CC:00:00:00"
        
        # Check uptime/last metadata
        latest_meta = db.query(CSIMetadata).filter(CSIMetadata.device_id == d.device_id).order_by(CSIMetadata.capture_time.desc()).first()
        rssi = float(latest_meta.rssi_dbm) if latest_meta and latest_meta.rssi_dbm else -55.0
        
        sensors_data.append({
            "id": str(d.device_id),
            "pairId": f"TX1{idx:02d}/RX2{idx:02d}",
            "roomCode": room.room_name if room else "Unknown",
            "ward": room.room_type if room else "General Ward",
            "rssi": rssi,
            "packetRateHz": 100,
            "packetDropPct": 0.2,
            "uptimeHours": 142,
            "firmwareChecksum": hashlib.md5(mac.encode()).hexdigest()[:10],
            "tamperFlag": False,
            "online": d.status == "Online" and (datetime.datetime.utcnow() - d.installed_at).total_seconds() < 30.0,
            "lastHeartbeat": d.installed_at.isoformat() + "Z"
        })
        
    # 4. Fetch Audit Logs
    db_audits = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(150).all()
    audits_data = []
    for au in db_audits:
        actor_name = "SYSTEM"
        actor_role = "administrator"
        if au.user_id:
            user = db.query(User).filter(User.user_id == au.user_id).first()
            if user:
                actor_name = user.name
                role = db.query(Role).filter(Role.user_id == user.user_id).first()
                actor_role = role.role_name.lower() if role else "nurse"
                
        audits_data.append({
            "id": str(au.audit_id),
            "timestamp": au.created_at.isoformat() + "Z",
            "actor": actor_name,
            "role": actor_role,
            "action": au.action,
            "resource": au.table_name or "system",
            "ip": au.ip_address or "127.0.0.1",
            "prevHash": au.prev_hash or "0"*32,
            "currHash": au.curr_hash or "0"*32
        })
        
    state_payload = {
        "rooms": rooms_data,
        "alerts": alerts_data,
        "sensors": sensors_data,
        "auditLog": audits_data
    }
    
    return json.dumps(state_payload)

async def broadcast_system_state():
    db = SessionLocal()
    try:
        state_json = get_serialized_state(db)
        await manager.broadcast(state_json)
    finally:
        db.close()

# --- DATABASE SEEDING ---
def seed_database(db: Session):
    # Check if we already have users
    if db.query(User).first():
        return
        
    print("[Database] Seeding initial database data...")
    
    # 1. Create Users & Roles
    users_data = [
        ("20000000-0000-0000-0000-000000000001", "System Admin", "admin@csi-monitor.com", "Admin", "Full system administrator"),
        ("20000000-0000-0000-0000-000000000002", "Dr. Arun Kumar", "arun@csi-monitor.com", "Doctor", "Medical staff doctor"),
        ("20000000-0000-0000-0000-000000000003", "Monitoring Operator", "operator@csi-monitor.com", "Operator", "Monitoring operator"),
        ("20000000-0000-0000-0000-000000000004", "Dr. Priya Sharma", "priya@csi-monitor.com", "Doctor", "Medical staff doctor"),
        ("20000000-0000-0000-0000-000000000005", "Nurse Sarah Jenkins", "sarah@csi-monitor.com", "Nurse", "Ward nursing staff"),
    ]
    
    for uid_str, name, email, rname, desc in users_data:
        uid = uuid.UUID(uid_str)
        user = User(
            user_id=uid,
            name=name,
            email=email,
            password_hash="DEMO_PASSWORD_HASH",
            status="Active"
        )
        db.add(user)
        role = Role(
            role_id=uuid.uuid4(),
            user_id=uid,
            role_name=rname,
            description=desc
        )
        db.add(role)
        
    db.commit()
    
    # 2. Add Model Version
    m_version = ModelVersion(
        model_version_id=uuid.UUID("A0000000-0000-0000-0000-000000000002"),
        model_name="CSI Movement Classifier",
        version="v1.1",
        algorithm="Random Forest",
        accuracy=94.80,
        trained_at=datetime.datetime.utcnow(),
        status="Active"
    )
    db.add(m_version)
    db.commit()
    
    # 3. Create Rooms and paired Devices matching React Frontend config
    wards_config = {
        "ICU-A": 2,
        "ICU-B": 2,
        "Post-Op Recovery": 2,
        "Memory Care": 2
    }
    
    global_idx = 0
    for ward, count in wards_config.items():
        for i in range(1, count + 1):
            global_idx += 1
            room_name = f"{ward.split(' ')[0][:3].upper() if ' ' in ward else ward[:3].upper()}-{i:03d}"
            # Let's clean names: 'ICU-A' -> 'ICU-001', 'Post-Op Recovery' -> 'POS-001', 'Memory Care' -> 'MEM-001', 'Geriatric Ward' -> 'GER-001'
            if ward == "ICU-A":
                room_name = f"ICU-A-{i:03d}"
            elif ward == "ICU-B":
                room_name = f"ICU-B-{i:03d}"
            elif ward == "Post-Op Recovery":
                room_name = f"POS-{i:03d}"
            elif ward == "Memory Care":
                room_name = f"MEM-{i:03d}"
            elif ward == "Geriatric Ward":
                room_name = f"GER-{i:03d}"
                
            room_uid = uuid.uuid4()
            room = Room(
                room_id=room_uid,
                room_name=room_name,
                room_type=ward, # Map ward type
                floor="1" if "ICU" in ward else "2",
                status="Active"
            )
            db.add(room)
            
            # Generate deterministic MAC
            mac = f"AA:BB:CC:00:00:{global_idx:02X}"
            device = Device(
                device_id=uuid.uuid4(),
                room_id=room_uid,
                device_name=f"CSI Sensor {room_name}",
                device_type="ESP32 CSI Receiver",
                mac_address=mac,
                status="Online",
                installed_at=datetime.datetime.utcnow()
            )
            db.add(device)
            
    db.commit()
    
    # 4. Create Genesis Audit Log
    genesis = AuditLog(
        action="Audit chain initialized",
        table_name="system",
        record_id=uuid.UUID("00000000-0000-0000-0000-000000000000"),
        details="AegisCSI hash chain database genesis entry created.",
        ip_address="127.0.0.1",
        prev_hash="0"*64,
        curr_hash=hashlib.sha256(b"genesis").hexdigest()
    )
    db.add(genesis)
    db.commit()
    print("[Database] Seeding completed.")

# --- API MODELS ---
class PacketPayload(BaseModel):
    mac_address: str
    timestamp: int
    rssi: float
    channel: int
    csi: List[int]

class AlertActionPayload(BaseModel):
    acknowledged_by: str  # User name / display name

class BreakGlassPayload(BaseModel):
    reason: str
    rationale: str
    actor: str

# --- REST ENDPOINTS ---

@app.on_event("startup")
async def startup_event():
    # Create tables
    Base.metadata.create_all(bind=engine)
    # Seed data
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()
        
    # Start alert sweeper background task
    asyncio.create_task(alert_sweeper_loop(SessionLocal, broadcast_system_state))

@app.get("/api/state")
def get_state(db: Session = Depends(get_db)):
    """Returns full serialized system state for initial frontend loading."""
    return json.loads(get_serialized_state(db))

@app.post("/api/ingest")
async def ingest_packet(payload: PacketPayload, db: Session = Depends(get_db)):
    """Receives raw CSI packets from ESP32 bridge."""
    result = await ingest_csi_packet(db, payload.dict(), broadcast_system_state)
    if result["status"] == "error":
        raise HTTPException(status_code=400, detail=result["message"])
    return result

@app.post("/api/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: str, payload: AlertActionPayload, db: Session = Depends(get_db)):
    try:
        alert_uuid = uuid.UUID(alert_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid Alert UUID format")
        
    alert = db.query(Alert).filter(Alert.alert_id == alert_uuid).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
        
    # Find user by name
    user = db.query(User).filter(User.name == payload.acknowledged_by).first()
    
    alert.status = "Acknowledged"
    alert.acknowledged_by = user.user_id if user else None
    alert.acknowledged_at = datetime.datetime.utcnow()
    
    # Audit log
    prev_log = db.query(AuditLog).order_by(AuditLog.created_at.desc()).first()
    prev_hash = prev_log.curr_hash if prev_log else "0"*32
    now_iso = datetime.datetime.utcnow().isoformat()
    curr_hash_input = f"{prev_hash}|{payload.acknowledged_by}|ACKNOWLEDGE_ALERT|{now_iso}"
    curr_hash = hashlib.sha256(curr_hash_input.encode()).hexdigest()
    
    audit = AuditLog(
        user_id=user.user_id if user else None,
        action="ACKNOWLEDGE_ALERT",
        table_name="alerts",
        record_id=alert.alert_id,
        details=f"Alert acknowledged by {payload.acknowledged_by}",
        ip_address="127.0.0.1",
        prev_hash=prev_hash,
        curr_hash=curr_hash
    )
    db.add(audit)
    db.commit()
    
    # Broadcast update
    await broadcast_system_state()
    return {"status": "success"}

@app.post("/api/alerts/{alert_id}/escalate")
async def escalate_alert(alert_id: str, payload: AlertActionPayload, db: Session = Depends(get_db)):
    try:
        alert_uuid = uuid.UUID(alert_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid Alert UUID format")
        
    alert = db.query(Alert).filter(Alert.alert_id == alert_uuid).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
        
    user = db.query(User).filter(User.name == payload.acknowledged_by).first()
    
    alert.status = "Escalated"
    alert.severity = "Critical"
    
    # Audit log
    prev_log = db.query(AuditLog).order_by(AuditLog.created_at.desc()).first()
    prev_hash = prev_log.curr_hash if prev_log else "0"*32
    now_iso = datetime.datetime.utcnow().isoformat()
    curr_hash_input = f"{prev_hash}|{payload.acknowledged_by}|ESCALATE_ALERT|{now_iso}"
    curr_hash = hashlib.sha256(curr_hash_input.encode()).hexdigest()
    
    audit = AuditLog(
        user_id=user.user_id if user else None,
        action="ESCALATE_ALERT",
        table_name="alerts",
        record_id=alert.alert_id,
        details=f"Alert escalated to Rapid Response Team by {payload.acknowledged_by}",
        ip_address="127.0.0.1",
        prev_hash=prev_hash,
        curr_hash=curr_hash
    )
    db.add(audit)
    db.commit()
    
    # Broadcast update
    await broadcast_system_state()
    return {"status": "success"}

@app.post("/api/alerts/{alert_id}/resolve")
async def resolve_alert(alert_id: str, payload: AlertActionPayload, db: Session = Depends(get_db)):
    try:
        alert_uuid = uuid.UUID(alert_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid Alert UUID format")
        
    alert = db.query(Alert).filter(Alert.alert_id == alert_uuid).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
        
    user = db.query(User).filter(User.name == payload.acknowledged_by).first()
    
    alert.status = "Resolved"
    
    # Audit log
    prev_log = db.query(AuditLog).order_by(AuditLog.created_at.desc()).first()
    prev_hash = prev_log.curr_hash if prev_log else "0"*32
    now_iso = datetime.datetime.utcnow().isoformat()
    curr_hash_input = f"{prev_hash}|{payload.acknowledged_by}|RESOLVE_ALERT|{now_iso}"
    curr_hash = hashlib.sha256(curr_hash_input.encode()).hexdigest()
    
    audit = AuditLog(
        user_id=user.user_id if user else None,
        action="RESOLVE_ALERT",
        table_name="alerts",
        record_id=alert.alert_id,
        details=f"Alert marked as resolved by {payload.acknowledged_by}",
        ip_address="127.0.0.1",
        prev_hash=prev_hash,
        curr_hash=curr_hash
    )
    db.add(audit)
    db.commit()
    
    # Broadcast update
    await broadcast_system_state()
    return {"status": "success"}

@app.post("/api/break-glass")
async def break_glass(payload: BreakGlassPayload, db: Session = Depends(get_db)):
    """Logs a Break-Glass security event in the Audit chain."""
    user = db.query(User).filter(User.name == payload.actor).first()
    
    prev_log = db.query(AuditLog).order_by(AuditLog.created_at.desc()).first()
    prev_hash = prev_log.curr_hash if prev_log else "0"*32
    now_iso = datetime.datetime.utcnow().isoformat()
    curr_hash_input = f"{prev_hash}|{payload.actor}|BREAK_GLASS_ACTIVATE|{now_iso}"
    curr_hash = hashlib.sha256(curr_hash_input.encode()).hexdigest()
    
    audit = AuditLog(
        user_id=user.user_id if user else None,
        action="BREAK_GLASS_ACTIVATE",
        table_name="security/break-glass",
        details=f"BREAK-GLASS PRIVILEGE REQUESTED - Reason: {payload.reason}. Rationale: {payload.rationale}",
        ip_address="127.0.0.1",
        prev_hash=prev_hash,
        curr_hash=curr_hash
    )
    db.add(audit)
    db.commit()
    
    await broadcast_system_state()
    return {"status": "success"}

@app.post("/api/demo/fall")
async def demo_fall(room_id: str, db: Session = Depends(get_db)):
    """Simulates a fall trigger in a room (for UI testing)."""
    try:
        room_uuid = uuid.UUID(room_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid Room UUID")
        
    room = db.query(Room).filter(Room.room_id == room_uuid).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
        
    # Get active session
    device = db.query(Device).filter(Device.room_id == room.room_id).first()
    if not device:
        raise HTTPException(status_code=400, detail="No device paired to room")
        
    session = db.query(DBSession).filter(
        DBSession.device_id == device.device_id,
        DBSession.session_status == "Active"
    ).first()
    
    if not session:
        admin = db.query(User).first()
        session = DBSession(
            device_id=device.device_id,
            user_id=admin.user_id if admin else None,
            start_time=datetime.datetime.utcnow(),
            session_status="Active"
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        
    # 1. Trigger CSI capture metadata (empty arrays for stub, high RSSI)
    csi_meta = CSIMetadata(
        session_id=session.session_id,
        device_id=device.device_id,
        room_id=room.room_id,
        capture_time=datetime.datetime.utcnow(),
        center_frequency_ghz=2.400,
        channel_number=6,
        bandwidth_mhz=20,
        subcarriers=64,
        sample_rate_hz=20,
        packet_count=100,
        rssi_dbm=-42.0,
        # Synthetic high variance array to represent fall impact
        amplitude_waveform=[20.0 + (i % 3)*5.0 + (10.0 if i%2==0 else -10.0) for i in range(64)],
        phase_waveform=[(i % 5)*0.2 - 0.5 for i in range(64)]
    )
    db.add(csi_meta)
    db.commit()
    db.refresh(csi_meta)
    
    # 2. Trigger ML Prediction of "possible_fall"
    prediction = MLPrediction(
        csi_metadata_id=csi_meta.csi_metadata_id,
        model_version_id=uuid.UUID('A0000000-0000-0000-0000-000000000002'),
        predicted_movement="possible_fall",
        confidence_score=88.50,
        prediction_time=datetime.datetime.utcnow()
    )
    db.add(prediction)
    db.commit()
    db.refresh(prediction)
    
    # 3. Create ActivityEvent
    event = ActivityEvent(
        prediction_id=prediction.prediction_id,
        session_id=session.session_id,
        room_id=room.room_id,
        event_type="Fall Detected",
        movement="possible_fall",
        event_time=datetime.datetime.utcnow(),
        duration_seconds=0,
        severity="High"
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    
    # 4. Create alert in Verifying stage
    alert = Alert(
        event_id=event.event_id,
        room_id=room.room_id,
        alert_type="Fall Detection",
        message=f"Possible fall detected in room {room.room_name} (DEMO SIMULATION). Verifying stillness...",
        severity="High",
        status="Verifying"
    )
    db.add(alert)
    
    # 5. Create Audit log
    prev_log = db.query(AuditLog).order_by(AuditLog.created_at.desc()).first()
    prev_hash = prev_log.curr_hash if prev_log else "0"*32
    now_iso = datetime.datetime.utcnow().isoformat()
    curr_hash_input = f"{prev_hash}|SYSTEM|DEMO_FALL_SIMULATE|{now_iso}"
    curr_hash = hashlib.sha256(curr_hash_input.encode()).hexdigest()
    
    audit = AuditLog(
        action="DEMO_FALL_SIMULATE",
        table_name="alerts",
        record_id=alert.alert_id,
        details=f"Demo simulation: Staged fall for room {room.room_name}",
        ip_address="127.0.0.1",
        prev_hash=prev_hash,
        curr_hash=curr_hash
    )
    db.add(audit)
    db.commit()
    
    # Set device and room active
    device.status = "Online"
    device.installed_at = datetime.datetime.utcnow()
    db.commit()
    
    await broadcast_system_state()
    return {"status": "success", "alert_id": str(alert.alert_id)}

# --- WEBSOCKET ENDPOINT ---
@app.websocket("/ws/live")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    db = SessionLocal()
    try:
        # Send initial full system state on connection
        initial_state = get_serialized_state(db)
        await websocket.send_text(initial_state)
        
        while True:
            # Keep connection alive, listen for ping/pong or actions (though React store mostly uses REST for actions)
            data = await websocket.receive_text()
            # If client sends a trigger, we can handle it
            pass
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"[WebSocket] Error in websocket handler: {e}")
        manager.disconnect(websocket)
    finally:
        db.close()
