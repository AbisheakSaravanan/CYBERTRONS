import json
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Numeric, DateTime, ForeignKey, Text, TypeDecorator, TEXT, Uuid
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy import Float

Base = declarative_base()

class DoubleArray(TypeDecorator):
    """
    Custom type that maps to PostgreSQL ARRAY(Float) and serializes to JSON string in SQLite.
    """
    impl = TEXT
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == 'postgresql':
            return dialect.type_descriptor(ARRAY(Float))
        else:
            return dialect.type_descriptor(TEXT)

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if dialect.name == 'postgresql':
            return value
        else:
            return json.dumps(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if dialect.name == 'postgresql':
            return value
        else:
            try:
                return json.loads(value)
            except Exception:
                return []

# 1. USERS
class User(Base):
    __tablename__ = 'users'
    
    user_id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, nullable=False)
    password_hash = Column(Text, nullable=False)
    status = Column(String(20), default='Active')
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    
    roles = relationship("Role", back_populates="user")
    sessions = relationship("Session", back_populates="user")
    acknowledged_alerts = relationship("Alert", back_populates="acknowledged_user")
    audit_logs = relationship("AuditLog", back_populates="user")

# 2. ROLES
class Role(Base):
    __tablename__ = 'roles'
    
    role_id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id = Column(Uuid, ForeignKey('users.user_id'))
    role_name = Column(String(50), nullable=False)
    description = Column(Text)
    
    user = relationship("User", back_populates="roles")

# 3. ROOMS
class Room(Base):
    __tablename__ = 'rooms'
    
    room_id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    room_name = Column(String(50), unique=True, nullable=False)
    room_type = Column(String(50), nullable=False)
    floor = Column(String(20))
    status = Column(String(20), default='Active')
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    
    devices = relationship("Device", back_populates="room")
    csi_metadatas = relationship("CSIMetadata", back_populates="room")
    activity_events = relationship("ActivityEvent", back_populates="room")
    alerts = relationship("Alert", back_populates="room")

# 4. DEVICES
class Device(Base):
    __tablename__ = 'devices'
    
    device_id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    room_id = Column(Uuid, ForeignKey('rooms.room_id'), nullable=False)
    device_name = Column(String(100), nullable=False)
    device_type = Column(String(50), nullable=False)
    mac_address = Column(String(30), unique=True)
    ip_address = Column(String(45))
    firmware_version = Column(String(30))
    status = Column(String(20), default='Online')
    installed_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    
    room = relationship("Room", back_populates="devices")
    sessions = relationship("Session", back_populates="device")
    csi_metadatas = relationship("CSIMetadata", back_populates="device")

# 5. MODEL VERSIONS
class ModelVersion(Base):
    __tablename__ = 'model_versions'
    
    model_version_id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    model_name = Column(String(100), nullable=False)
    version = Column(String(30), nullable=False)
    algorithm = Column(String(100))
    accuracy = Column(Numeric(5, 2))
    trained_at = Column(DateTime(timezone=True))
    status = Column(String(20), default='Active')
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    
    predictions = relationship("MLPrediction", back_populates="model_version")

# 6. SESSIONS
class Session(Base):
    __tablename__ = 'sessions'
    
    session_id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    device_id = Column(Uuid, ForeignKey('devices.device_id'), nullable=False)
    user_id = Column(Uuid, ForeignKey('users.user_id'))
    start_time = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    end_time = Column(DateTime(timezone=True))
    session_status = Column(String(30), default='Active')
    
    device = relationship("Device", back_populates="sessions")
    user = relationship("User", back_populates="sessions")
    csi_metadatas = relationship("CSIMetadata", back_populates="session")
    activity_events = relationship("ActivityEvent", back_populates="session")

# 7. CSI METADATA
class CSIMetadata(Base):
    __tablename__ = 'csi_metadata'
    
    csi_metadata_id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    session_id = Column(Uuid, ForeignKey('sessions.session_id'), nullable=False)
    device_id = Column(Uuid, ForeignKey('devices.device_id'), nullable=False)
    room_id = Column(Uuid, ForeignKey('rooms.room_id'), nullable=False)
    capture_time = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    center_frequency_ghz = Column(Numeric(6, 3))
    channel_number = Column(Integer)
    bandwidth_mhz = Column(Integer)
    subcarriers = Column(Integer)
    sample_rate_hz = Column(Integer)
    packet_count = Column(Integer)
    rssi_dbm = Column(Numeric(6, 2))
    amplitude_waveform = Column(DoubleArray)
    phase_waveform = Column(DoubleArray)
    
    session = relationship("Session", back_populates="csi_metadatas")
    device = relationship("Device", back_populates="csi_metadatas")
    room = relationship("Room", back_populates="csi_metadatas")
    predictions = relationship("MLPrediction", back_populates="csi_metadata")

# 8. ML PREDICTIONS
class MLPrediction(Base):
    __tablename__ = 'ml_predictions'
    
    prediction_id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    csi_metadata_id = Column(Uuid, ForeignKey('csi_metadata.csi_metadata_id'), nullable=False)
    model_version_id = Column(Uuid, ForeignKey('model_versions.model_version_id'), nullable=False)
    predicted_movement = Column(String(50), nullable=False)
    confidence_score = Column(Numeric(5, 2))
    prediction_time = Column(DateTime(timezone=True), default=datetime.utcnow)
    
    csi_metadata = relationship("CSIMetadata", back_populates="predictions")
    model_version = relationship("ModelVersion", back_populates="predictions")
    activity_events = relationship("ActivityEvent", back_populates="prediction")

# 9. ACTIVITY EVENTS
class ActivityEvent(Base):
    __tablename__ = 'activity_events'
    
    event_id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    prediction_id = Column(Uuid, ForeignKey('ml_predictions.prediction_id'), nullable=False)
    session_id = Column(Uuid, ForeignKey('sessions.session_id'), nullable=False)
    room_id = Column(Uuid, ForeignKey('rooms.room_id'), nullable=False)
    event_type = Column(String(50), nullable=False)
    movement = Column(String(50), nullable=False)
    event_time = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    duration_seconds = Column(Integer)
    severity = Column(String(20), default='Normal')
    
    prediction = relationship("MLPrediction", back_populates="activity_events")
    session = relationship("Session", back_populates="activity_events")
    room = relationship("Room", back_populates="activity_events")
    alerts = relationship("Alert", back_populates="event")

# 10. ALERTS
class Alert(Base):
    __tablename__ = 'alerts'
    
    alert_id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    event_id = Column(Uuid, ForeignKey('activity_events.event_id'), nullable=False)
    room_id = Column(Uuid, ForeignKey('rooms.room_id'), nullable=False)
    alert_type = Column(String(50), nullable=False)
    message = Column(Text, nullable=False)
    severity = Column(String(20), nullable=False)
    status = Column(String(20), default='Open')
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    acknowledged_by = Column(Uuid, ForeignKey('users.user_id'))
    acknowledged_at = Column(DateTime(timezone=True))
    
    event = relationship("ActivityEvent", back_populates="alerts")
    room = relationship("Room", back_populates="alerts")
    acknowledged_user = relationship("User", back_populates="acknowledged_alerts")

# 11. AUDIT LOGS
class AuditLog(Base):
    __tablename__ = 'audit_logs'
    
    audit_id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id = Column(Uuid, ForeignKey('users.user_id'))
    action = Column(String(100), nullable=False)
    table_name = Column(String(100))
    record_id = Column(Uuid)
    details = Column(Text)
    ip_address = Column(String(45))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    
    # Hash chaining for audit integrity
    prev_hash = Column(String(64))
    curr_hash = Column(String(64))
    
    user = relationship("User", back_populates="audit_logs")
