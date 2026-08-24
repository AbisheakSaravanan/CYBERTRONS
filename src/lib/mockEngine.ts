import type {
  ActivityClass,
  AuditEntry,
  MovementVector,
  Room,
  RoomReading,
  SensorNode,
  Ward,
} from '../types';

const WARDS: Ward[] = ['ICU-A', 'ICU-B', 'Post-Op Recovery', 'Memory Care', 'Geriatric Ward'];

const ROOM_COUNTS: Record<Ward, number> = {
  'ICU-A': 6,
  'ICU-B': 6,
  'Post-Op Recovery': 8,
  'Memory Care': 5,
  'Geriatric Ward': 7,
};

const STABLE_ACTIVITIES: ActivityClass[] = ['no_movement', 'sitting', 'standing', 'walking', 'lying'];
const VECTORS: MovementVector[] = ['low', 'medium', 'high'];

let seed = 42;
function rand(): number {
  // simple deterministic LCG so first paint is stable across renders in dev
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}
function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function tokenize(ward: Ward, index: number): string {
  const wardCode = ward.replace(/[^A-Z]/g, '').slice(0, 2) || 'XX';
  return `PT-${wardCode}-${(1000 + index * 7 + randInt(0, 6)).toString(36).toUpperCase()}`;
}

function makeReading(activity: ActivityClass = pick(STABLE_ACTIVITIES)): RoomReading {
  return {
    activity,
    confidence: randInt(78, 99),
    postEventVector: pick(VECTORS),
    timestamp: new Date().toISOString(),
  };
}

export function generateRooms(): Room[] {
  const rooms: Room[] = [];
  let globalIndex = 0;
  for (const ward of WARDS) {
    const count = ROOM_COUNTS[ward];
    for (let i = 1; i <= count; i++) {
      globalIndex++;
      const code = `${ward.split(' ')[0].slice(0, 3).toUpperCase()}-${String(i).padStart(3, '0')}`;
      const current = makeReading();
      const history: RoomReading[] = [];
      for (let h = 12; h >= 0; h--) {
        const t = new Date(Date.now() - h * 6 * 60 * 1000);
        history.push({ ...makeReading(), timestamp: t.toISOString() });
      }
      rooms.push({
        id: `room-${globalIndex}`,
        code,
        ward,
        patientToken: tokenize(ward, globalIndex),
        sensorOnline: rand() > 0.06,
        current,
        history,
        lastUpdated: current.timestamp,
      });
    }
  }
  return rooms;
}

export function generateSensors(rooms: Room[]): SensorNode[] {
  return rooms.map((room, i) => ({
    id: `sensor-${i}`,
    pairId: `TX${(100 + i).toString()}/RX${(200 + i).toString()}`,
    roomCode: room.code,
    ward: room.ward,
    rssi: -1 * randInt(38, 78),
    packetRateHz: randInt(85, 120),
    packetDropPct: Math.round(rand() * 3.2 * 10) / 10,
    uptimeHours: randInt(40, 2200),
    firmwareChecksum: cryptoLikeHash(`fw-${i}-${room.code}`).slice(0, 10),
    tamperFlag: rand() > 0.985,
    online: room.sensorOnline,
    lastHeartbeat: new Date(Date.now() - randInt(0, 20) * 1000).toISOString(),
  }));
}

// Lightweight non-cryptographic string hash for a believable SHA-256-style stub.
// Explicitly not used for any real security property.
export function cryptoLikeHash(input: string): string {
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const combined = (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
  return combined.padStart(24, '0') + input.length.toString(16).padStart(4, '0');
}

export function genesisAuditEntry(): AuditEntry {
  return {
    id: 'audit-0',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    actor: 'SYSTEM',
    role: 'administrator',
    action: 'Audit chain initialized',
    resource: 'system',
    ip: '10.20.0.1',
    prevHash: '0'.repeat(28),
    currHash: cryptoLikeHash('genesis'),
  };
}

export function nextAuditEntry(
  prev: AuditEntry,
  fields: Omit<AuditEntry, 'id' | 'timestamp' | 'prevHash' | 'currHash'>,
): AuditEntry {
  const timestamp = new Date().toISOString();
  const currHash = cryptoLikeHash(`${prev.currHash}|${fields.actor}|${fields.action}|${timestamp}`);
  return {
    id: `audit-${Date.now()}-${randInt(0, 9999)}`,
    timestamp,
    prevHash: prev.currHash,
    currHash,
    ...fields,
  };
}

export function generateSubcarriers(seedOffset: number, disturbed: boolean): { index: number; amplitude: number; phase: number }[] {
  const n = 64;
  const out = [];
  const t = Date.now() / 1000;
  for (let i = 0; i < n; i++) {
    const base = 22 + 6 * Math.sin(i / 5 + seedOffset + t / 3);
    const noise = (rand() - 0.5) * (disturbed ? 9 : 2.2);
    out.push({
      index: i,
      amplitude: Math.round((base + noise) * 100) / 100,
      phase: Math.round(((Math.sin(i / 3 + t / 2) * Math.PI) + (disturbed ? (rand() - 0.5) * 1.4 : 0)) * 100) / 100,
    });
  }
  return out;
}

export function randomWard(): Ward {
  return pick(WARDS);
}

export const ALL_WARDS = WARDS;
export { pick, randInt, rand };
