import asyncio
import datetime
from sqlalchemy.orm import Session
from sqlalchemy import select
from .models import Alert, Room, ActivityEvent, MLPrediction, CSIMetadata, AuditLog, User
from .fall_logic import detect_fall_staging

async def alert_sweeper_loop(db_session_factory, broadcast_func):
    """
    Background worker loop that sweeps for expired 'Verifying' alerts.
    If 15 seconds have passed since creation:
      - If the latest prediction indicates the patient is still down (lying/no_movement),
        the alert is upgraded to 'Confirmed' and room state is updated to 'confirmed_fall'.
      - If the patient has recovered (walking/standing/sitting), the alert is auto-resolved.
    """
    print("[AlertSweeper] Starting background alert sweeper task...")
    while True:
        try:
            await asyncio.sleep(1.0)
            
            # Create a new DB session
            db: Session = db_session_factory()
            try:
                now = datetime.datetime.utcnow()
                # Find open alerts in 'Verifying' state that are expired
                stmt = select(Alert).where(
                    Alert.status == 'Verifying'
                )
                result = db.execute(stmt)
                alerts = result.scalars().all()
                
                for alert in alerts:
                    # Parse the verification_ends_at from alert details or calculate it.
                    # Since alerts are verifying for 15s, check if created_at is older than 15s.
                    # We can use created_at as verification start.
                    created_at = alert.created_at
                    # Ensure datetime is naive or aware matching 'now'
                    if created_at.tzinfo is not None:
                        created_at = created_at.replace(tzinfo=None)
                        
                    elapsed = (now - created_at).total_seconds()
                    if elapsed >= 15.0:
                        print(f"[AlertSweeper] Alert {alert.alert_id} verification window expired (elapsed: {elapsed:.2f}s). Checking room state...")
                        
                        # Get the latest prediction for this room
                        latest_pred_stmt = select(MLPrediction).join(CSIMetadata).where(
                            CSIMetadata.room_id == alert.room_id
                        ).order_by(MLPrediction.prediction_time.desc()).limit(1)
                        
                        latest_pred = db.execute(latest_pred_stmt).scalar_one_or_none()
                        
                        still_down = True
                        current_activity = "lying"
                        confidence = 90.0
                        
                        if latest_pred:
                            current_activity = latest_pred.predicted_movement
                            confidence = float(latest_pred.confidence_score) if latest_pred.confidence_score else 90.0
                            if current_activity not in ["lying", "no_movement", "possible_fall"]:
                                still_down = False
                        
                        # Fetch room code and ward
                        room = db.query(Room).filter(Room.room_id == alert.room_id).first()
                        room_code = room.room_name if room else "Unknown"
                        ward = room.room_type if room else "General Ward"
                        
                        if still_down:
                            # 1. Upgrade alert to Confirmed
                            alert.status = 'Confirmed'
                            alert.message = f"Urgent: Confirmed fall detected in room {room_code}."
                            alert.severity = 'Critical'
                            
                            # 2. Update room status in activity event
                            # Create a confirmed fall activity event
                            confirmed_event = ActivityEvent(
                                prediction_id=latest_pred.prediction_id if latest_pred else alert.event.prediction_id,
                                session_id=alert.event.session_id,
                                room_id=alert.room_id,
                                event_type='Fall Confirmed',
                                movement='confirmed_fall',
                                event_time=datetime.datetime.utcnow(),
                                duration_seconds=15,
                                severity='Critical'
                            )
                            db.add(confirmed_event)
                            db.flush() # Populate generated UUID
                            alert.event_id = confirmed_event.event_id
                            
                            # 3. Create Audit Log
                            # Hash chain logic
                            prev_log = db.query(AuditLog).order_by(AuditLog.created_at.desc()).first()
                            prev_hash = prev_log.curr_hash if prev_log else "0" * 32
                            import hashlib
                            details = f"Alert {alert.alert_id} confirmed as fall in room {room_code}"
                            curr_hash_input = f"{prev_hash}|SYSTEM|CONFIRMED_FALL|{now.isoformat()}"
                            curr_hash = hashlib.sha256(curr_hash_input.encode()).hexdigest()
                            
                            audit = AuditLog(
                                audit_id=datetime.uuid.uuid4() if hasattr(datetime, 'uuid') else None, # Handled by default UUID
                                action="CONFIRMED_FALL",
                                table_name="alerts",
                                record_id=alert.alert_id,
                                details=details,
                                ip_address="127.0.0.1",
                                prev_hash=prev_hash,
                                curr_hash=curr_hash
                            )
                            db.add(audit)
                            db.commit()
                            
                            print(f"[AlertSweeper] Alert {alert.alert_id} UPGRADED to Confirmed fall.")
                            
                        else:
                            # 1. Resolve alert (False positive)
                            alert.status = 'Resolved'
                            alert.message = f"Alert resolved: patient recovered in room {room_code}."
                            
                            # 2. Create Audit Log
                            prev_log = db.query(AuditLog).order_by(AuditLog.created_at.desc()).first()
                            prev_hash = prev_log.curr_hash if prev_log else "0" * 32
                            import hashlib
                            details = f"Alert {alert.alert_id} auto-resolved (patient recovered) in room {room_code}"
                            curr_hash_input = f"{prev_hash}|SYSTEM|RESOLVE_ALERT|{now.isoformat()}"
                            curr_hash = hashlib.sha256(curr_hash_input.encode()).hexdigest()
                            
                            audit = AuditLog(
                                action="RESOLVE_ALERT",
                                table_name="alerts",
                                record_id=alert.alert_id,
                                details=details,
                                ip_address="127.0.0.1",
                                prev_hash=prev_hash,
                                curr_hash=curr_hash
                            )
                            db.add(audit)
                            db.commit()
                            
                            print(f"[AlertSweeper] Alert {alert.alert_id} AUTO-RESOLVED (patient recovered).")
                        
                        # Trigger WebSocket broadcast with full updated system state
                        await broadcast_func()
                        
            finally:
                db.close()
                
        except Exception as e:
            print(f"[AlertSweeper] Error in sweeper loop: {e}")
            import traceback
            traceback.print_exc()
