export type Role = 'doctor' | 'nurse' | 'technician' | 'security' | 'administrator';

export type ActivityClass =
  | 'no_movement'
  | 'sitting'
  | 'standing'
  | 'walking'
  | 'lying'
  | 'possible_fall'
  | 'confirmed_fall';

export type MovementVector = 'low' | 'medium' | 'high';

export type Ward = 'ICU-A' | 'ICU-B' | 'Post-Op Recovery' | 'Memory Care' | 'Geriatric Ward';

export interface RoomReading {
  activity: ActivityClass;
  confidence: number; // 0-100
  postEventVector: MovementVector;
  timestamp: string; // ISO
}

export interface Room {
  id: string;
  code: string; // e.g. ICU-A-014
  ward: Ward;
  patientToken: string; // anonymized/tokenized id
  sensorOnline: boolean;
  current: RoomReading;
  history: RoomReading[];
  lastUpdated: string;
}

export type AlertStage = 'possible' | 'verifying' | 'confirmed' | 'acknowledged' | 'escalated' | 'resolved';

export interface FallAlert {
  id: string;
  roomId: string;
  roomCode: string;
  ward: Ward;
  stage: AlertStage;
  confidence: number;
  postEventVector: MovementVector;
  verificationEndsAt: string | null; // ISO, for the 15s window
  createdAt: string;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  escalatedAt: string | null;
}

export interface SubcarrierSample {
  index: number; // subcarrier index 0-63
  amplitude: number; // dB
  phase: number; // radians
}

export interface SensorNode {
  id: string;
  pairId: string; // Tx/Rx pair label
  roomCode: string;
  ward: Ward;
  rssi: number; // dBm
  packetRateHz: number;
  packetDropPct: number;
  uptimeHours: number;
  firmwareChecksum: string;
  tamperFlag: boolean;
  online: boolean;
  lastHeartbeat: string;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  role: Role;
  action: string;
  resource: string;
  ip: string;
  prevHash: string;
  currHash: string;
}

export interface BreakGlassSession {
  active: boolean;
  reason: string;
  rationale: string;
  activatedAt: string | null;
  expiresAt: string | null;
  activatedBy: string | null;
}

export interface AssistantSource {
  label: string;
  type: 'event' | 'sop';
  refId: string;
}

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  sources?: AssistantSource[];
  timestamp: string;
}

export interface Session {
  employeeId: string;
  displayName: string;
  role: Role;
  loggedInAt: string;
}
