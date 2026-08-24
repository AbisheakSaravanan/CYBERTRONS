import { create } from 'zustand';
import type {
  AuditEntry,
  BreakGlassSession,
  FallAlert,
  Role,
  Room,
  RoomReading,
  SensorNode,
  Session,
  Ward,
} from '../types';
import {
  generateRooms,
  generateSensors,
  genesisAuditEntry,
  nextAuditEntry,
  pick,
  rand,
  randInt,
} from '../lib/mockEngine';

export type View = 'dashboard' | 'room' | 'sensors' | 'audit';

interface StoreState {
  session: Session | null;
  role: Role;
  rooms: Room[];
  sensors: SensorNode[];
  alerts: FallAlert[];
  auditLog: AuditEntry[];
  breakGlass: BreakGlassSession;
  view: View;
  selectedRoomId: string | null;
  wardFilter: Ward | 'All';
  assistantOpen: boolean;
  engineStarted: boolean;

  login: (employeeId: string, displayName: string, role: Role) => void;
  logout: () => void;
  setRole: (role: Role) => void;
  setView: (v: View) => void;
  selectRoom: (id: string | null) => void;
  setWardFilter: (w: Ward | 'All') => void;
  toggleAssistant: () => void;

  activateBreakGlass: (reason: string, rationale: string) => void;
  endBreakGlass: () => void;

  acknowledgeAlert: (id: string, by: string) => void;
  escalateAlert: (id: string) => void;
  resolveAlert: (id: string) => void;

  simulateFallInRoom: (roomId: string) => void;
  startEngine: () => void;
  stopEngine: () => void;
  logAction: (action: string, resource: string) => void;
}

let engineHandle: number | null = null;

export const useStore = create<StoreState>((set, get) => ({
  session: null,
  role: 'nurse',
  rooms: [],
  sensors: [],
  alerts: [],
  auditLog: [genesisAuditEntry()],
  breakGlass: { active: false, reason: '', rationale: '', activatedAt: null, expiresAt: null, activatedBy: null },
  view: 'dashboard',
  selectedRoomId: null,
  wardFilter: 'All',
  assistantOpen: false,
  engineStarted: false,

  login: (employeeId, displayName, role) => {
    const rooms = generateRooms();
    const sensors = generateSensors(rooms);
    set({
      session: { employeeId, displayName, role, loggedInAt: new Date().toISOString() },
      role,
      rooms,
      sensors,
    });
    get().logAction('Authenticated (MFA verified)', 'auth/session');
    get().startEngine();
  },

  logout: () => {
    get().stopEngine();
    get().logAction('Session terminated', 'auth/session');
    set({ session: null, rooms: [], sensors: [], alerts: [], view: 'dashboard', selectedRoomId: null });
  },

  setRole: (role) => {
    const prevRole = get().session?.role;
    set((s) => ({ role, session: s.session ? { ...s.session, role } : s.session }));
    if (prevRole !== role) get().logAction(`Switched role to ${role}`, 'auth/rbac');
  },

  setView: (v) => set({ view: v }),
  selectRoom: (id) => set({ selectedRoomId: id, view: id ? 'room' : 'dashboard' }),
  setWardFilter: (w) => set({ wardFilter: w }),
  toggleAssistant: () => set((s) => ({ assistantOpen: !s.assistantOpen })),

  activateBreakGlass: (reason, rationale) => {
    const now = new Date();
    const expires = new Date(now.getTime() + 15 * 60 * 1000);
    set({
      breakGlass: {
        active: true,
        reason,
        rationale,
        activatedAt: now.toISOString(),
        expiresAt: expires.toISOString(),
        activatedBy: get().session?.displayName ?? 'unknown',
      },
    });
    get().logAction(`BREAK-GLASS ACTIVATED — reason: ${reason}`, 'security/break-glass');
  },

  endBreakGlass: () => {
    set({ breakGlass: { active: false, reason: '', rationale: '', activatedAt: null, expiresAt: null, activatedBy: null } });
    get().logAction('Break-glass session ended', 'security/break-glass');
  },

  acknowledgeAlert: (id, by) => {
    set((s) => ({
      alerts: s.alerts.map((a) =>
        a.id === id ? { ...a, stage: 'acknowledged', acknowledgedBy: by, acknowledgedAt: new Date().toISOString() } : a,
      ),
    }));
    get().logAction(`Acknowledged fall alert ${id}`, `alerts/${id}`);
  },

  escalateAlert: (id) => {
    set((s) => ({
      alerts: s.alerts.map((a) => (a.id === id ? { ...a, stage: 'escalated', escalatedAt: new Date().toISOString() } : a)),
    }));
    get().logAction(`Escalated to Rapid Response Team: ${id}`, `alerts/${id}`);
  },

  resolveAlert: (id) => {
    set((s) => ({ alerts: s.alerts.map((a) => (a.id === id ? { ...a, stage: 'resolved' } : a)) }));
    get().logAction(`Resolved fall alert ${id}`, `alerts/${id}`);
  },

  simulateFallInRoom: (roomId) => {
    const room = get().rooms.find((r) => r.id === roomId);
    if (!room) return;
    const reading: RoomReading = {
      activity: 'possible_fall',
      confidence: randInt(70, 88),
      postEventVector: 'low',
      timestamp: new Date().toISOString(),
    };
    set((s) => ({
      rooms: s.rooms.map((r) => (r.id === roomId ? { ...r, current: reading, history: [...r.history.slice(-40), reading], lastUpdated: reading.timestamp } : r)),
    }));
    const alertId = `alert-${Date.now()}`;
    const verificationEnds = new Date(Date.now() + 15000).toISOString();
    const alert: FallAlert = {
      id: alertId,
      roomId,
      roomCode: room.code,
      ward: room.ward,
      stage: 'verifying',
      confidence: reading.confidence,
      postEventVector: reading.postEventVector,
      verificationEndsAt: verificationEnds,
      createdAt: reading.timestamp,
      acknowledgedBy: null,
      acknowledgedAt: null,
      escalatedAt: null,
    };
    set((s) => ({ alerts: [alert, ...s.alerts] }));
    get().logAction(`Possible fall detected — verification window opened`, `rooms/${room.code}`);

    window.setTimeout(() => {
      const still = get().alerts.find((a) => a.id === alertId);
      if (!still || still.stage !== 'verifying') return;
      const confirmedReading: RoomReading = {
        activity: 'confirmed_fall',
        confidence: randInt(89, 99),
        postEventVector: pick(['medium', 'high']),
        timestamp: new Date().toISOString(),
      };
      set((s) => ({
        rooms: s.rooms.map((r) => (r.id === roomId ? { ...r, current: confirmedReading, history: [...r.history.slice(-40), confirmedReading], lastUpdated: confirmedReading.timestamp } : r)),
        alerts: s.alerts.map((a) => (a.id === alertId ? { ...a, stage: 'confirmed', confidence: confirmedReading.confidence, postEventVector: confirmedReading.postEventVector, verificationEndsAt: null } : a)),
      }));
      get().logAction('CONFIRMED FALL — urgent alert broadcast', `rooms/${room.code}`);
    }, 15000);
  },

  logAction: (action, resource) => {
    set((s) => {
      const prev = s.auditLog[0];
      const entry = nextAuditEntry(prev, {
        actor: s.session?.displayName ?? 'SYSTEM',
        role: s.session?.role ?? 'administrator',
        action,
        resource,
        ip: `10.${randInt(10, 40)}.${randInt(0, 255)}.${randInt(2, 254)}`,
      });
      return { auditLog: [entry, ...s.auditLog].slice(0, 300) };
    });
  },

  startEngine: () => {
    if (get().engineStarted) return;
    set({ engineStarted: true });
    engineHandle = window.setInterval(() => {
      const { rooms, alerts } = get();
      if (rooms.length === 0) return;

      // Drift a handful of rooms' telemetry each tick to feel alive.
      const drift = Math.max(1, Math.floor(rooms.length * 0.12));
      const idxSet = new Set<number>();
      while (idxSet.size < drift) idxSet.add(randInt(0, rooms.length - 1));

      set((s) => ({
        rooms: s.rooms.map((r, i) => {
          if (!idxSet.has(i) || !r.sensorOnline) return r;
          const currentlyAlerting = alerts.some((a) => a.roomId === r.id && (a.stage === 'verifying' || a.stage === 'confirmed'));
          if (currentlyAlerting) return r;
          const activities: RoomReading['activity'][] = ['no_movement', 'sitting', 'standing', 'walking', 'lying'];
          const reading: RoomReading = {
            activity: pick(activities),
            confidence: randInt(76, 99),
            postEventVector: pick(['low', 'medium', 'high']),
            timestamp: new Date().toISOString(),
          };
          return { ...r, current: reading, history: [...r.history.slice(-40), reading], lastUpdated: reading.timestamp };
        }),
        sensors: s.sensors.map((sn) =>
          rand() > 0.7
            ? { ...sn, rssi: -1 * randInt(38, 78), packetRateHz: randInt(85, 120), lastHeartbeat: new Date().toISOString() }
            : sn,
        ),
      }));

      // Rare spontaneous fall simulation to demonstrate the escalation flow.
      if (rand() > 0.985 && get().alerts.every((a) => a.stage === 'resolved' || a.stage === 'acknowledged' || a.stage === 'escalated')) {
        const candidate = get().rooms[randInt(0, get().rooms.length - 1)];
        if (candidate?.sensorOnline) get().simulateFallInRoom(candidate.id);
      }
    }, 3500);
  },

  stopEngine: () => {
    if (engineHandle) window.clearInterval(engineHandle);
    engineHandle = null;
    set({ engineStarted: false });
  },
}));
