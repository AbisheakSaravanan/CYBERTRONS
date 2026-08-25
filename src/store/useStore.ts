import { create } from 'zustand';
import type {
  AuditEntry,
  BreakGlassSession,
  FallAlert,
  Role,
  Room,
  SensorNode,
  Session,
  Ward,
} from '../types';
import {
  fetchSystemState,
  acknowledgeAlert as apiAcknowledgeAlert,
  escalateAlert as apiEscalateAlert,
  resolveAlert as apiResolveAlert,
  activateBreakGlass as apiActivateBreakGlass,
  triggerDemoFall,
  connectWebSocket,
} from '../lib/api';

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

  login: (employeeId: string, displayName: string, role: Role) => Promise<void>;
  logout: () => void;
  setRole: (role: Role) => void;
  setView: (v: View) => void;
  selectRoom: (id: string | null) => void;
  setWardFilter: (w: Ward | 'All') => void;
  toggleAssistant: () => void;

  activateBreakGlass: (reason: string, rationale: string) => Promise<void>;
  endBreakGlass: () => void;

  acknowledgeAlert: (id: string, by: string) => Promise<void>;
  escalateAlert: (id: string) => Promise<void>;
  resolveAlert: (id: string) => Promise<void>;

  simulateFallInRoom: (roomId: string) => Promise<void>;
  startEngine: () => void;
  stopEngine: () => void;
  logAction: (action: string, resource: string) => void;
}

let socket: WebSocket | null = null;

export const useStore = create<StoreState>((set, get) => ({
  session: null,
  role: 'nurse',
  rooms: [],
  sensors: [],
  alerts: [],
  auditLog: [],
  breakGlass: { active: false, reason: '', rationale: '', activatedAt: null, expiresAt: null, activatedBy: null },
  view: 'dashboard',
  selectedRoomId: null,
  wardFilter: 'All',
  assistantOpen: false,
  engineStarted: false,

  login: async (employeeId, displayName, role) => {
    // 1. Fetch initial state from the FastAPI REST server
    try {
      const initialState = await fetchSystemState();
      set({
        session: { employeeId, displayName, role, loggedInAt: new Date().toISOString() },
        role,
        rooms: initialState.rooms || [],
        sensors: initialState.sensors || [],
        alerts: initialState.alerts || [],
        auditLog: initialState.auditLog || [],
      });
      
      // 2. Connect to the WebSocket feed
      get().startEngine();
      get().logAction('Authenticated (Live Connection Initialized)', 'auth/session');
    } catch (e) {
      console.error('Error logging in and fetching state:', e);
      // Fail-safe fallback if backend is offline so user can still see dashboard (mocking)
      set({
        session: { employeeId, displayName, role, loggedInAt: new Date().toISOString() },
        role,
      });
    }
  },

  logout: () => {
    get().stopEngine();
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

  activateBreakGlass: async (reason, rationale) => {
    const now = new Date();
    const expires = new Date(now.getTime() + 15 * 60 * 1000);
    const actor = get().session?.displayName ?? 'unknown';
    
    // Call backend endpoint to log this event in the hash chain database
    try {
      await apiActivateBreakGlass(reason, rationale, actor);
    } catch (e) {
      console.error('Break glass logging failed:', e);
    }
    
    set({
      breakGlass: {
        active: true,
        reason,
        rationale,
        activatedAt: now.toISOString(),
        expiresAt: expires.toISOString(),
        activatedBy: actor,
      },
    });
  },

  endBreakGlass: () => {
    set({ breakGlass: { active: false, reason: '', rationale: '', activatedAt: null, expiresAt: null, activatedBy: null } });
    get().logAction('Break-glass session ended', 'security/break-glass');
  },

  acknowledgeAlert: async (id, by) => {
    // Optimistic update for instant UI feedback
    set((s) => ({
      alerts: s.alerts.map((a) =>
        a.id === id ? { ...a, stage: 'acknowledged', acknowledgedBy: by, acknowledgedAt: new Date().toISOString() } : a,
      ),
    }));
    try {
      await apiAcknowledgeAlert(id, by);
    } catch (e) {
      console.error('Failed to acknowledge alert:', e);
    }
  },

  escalateAlert: async (id) => {
    const actor = get().session?.displayName ?? 'unknown';
    // Optimistic update
    set((s) => ({
      alerts: s.alerts.map((a) => (a.id === id ? { ...a, stage: 'escalated', escalatedAt: new Date().toISOString() } : a)),
    }));
    try {
      await apiEscalateAlert(id, actor);
    } catch (e) {
      console.error('Failed to escalate alert:', e);
    }
  },

  resolveAlert: async (id) => {
    const actor = get().session?.displayName ?? 'unknown';
    // Optimistic update
    set((s) => ({
      alerts: s.alerts.map((a) => (a.id === id ? { ...a, stage: 'resolved' } : a)),
    }));
    try {
      await apiResolveAlert(id, actor);
    } catch (e) {
      console.error('Failed to resolve alert:', e);
    }
  },

  simulateFallInRoom: async (roomId) => {
    try {
      await triggerDemoFall(roomId);
    } catch (e) {
      console.error('Failed to trigger simulation fall:', e);
    }
  },

  logAction: (action, resource) => {
    // Audit logs are stored and calculated in the backend, but we keep this hook
    // to print in the browser console.
    console.log(`[AuditLog] ${action} on ${resource}`);
  },

  startEngine: () => {
    if (get().engineStarted) return;
    set({ engineStarted: true });
    
    // Connect WebSockets to receive live updates from FastAPI orchestrator
    socket = connectWebSocket(
      (data) => {
        // Callback when data is received: update rooms, alerts, sensors, and auditLog
        // Preserve local advanced alert stages (acknowledged, resolved, escalated) to prevent
        // in-flight telemetry updates from reverting the state before the REST transaction finishes committing.
        const currentAlerts = get().alerts;
        const localUpdated = new Map(
          (currentAlerts || [])
            .filter((a) => a.stage === 'acknowledged' || a.stage === 'resolved' || a.stage === 'escalated')
            .map((a) => [a.id, a])
        );

        const mergedAlerts = (data.alerts || []).map((incoming: any) => {
          const local = localUpdated.get(incoming.id);
          if (local) {
            // Keep local stage if incoming stage is older (verifying or confirmed)
            if (incoming.stage === 'verifying' || incoming.stage === 'confirmed') {
              return {
                ...incoming,
                stage: local.stage,
                acknowledgedBy: local.acknowledgedBy,
                acknowledgedAt: local.acknowledgedAt,
                escalatedAt: local.escalatedAt
              };
            }
          }
          return incoming;
        });

        set({
          rooms: data.rooms || [],
          alerts: mergedAlerts,
          sensors: data.sensors || [],
          auditLog: data.auditLog || [],
        });
      },
      (err) => {
        console.error('WebSocket Error:', err);
      },
      () => {
        console.log('WebSocket Connection Closed. Attempting reconnect in 5s...');
        set({ engineStarted: false });
        // Auto-reconnect after 5 seconds if connection drops
        setTimeout(() => {
          if (get().session) {
            get().startEngine();
          }
        }, 5000);
      }
    );
  },

  stopEngine: () => {
    if (socket) {
      socket.close();
      socket = null;
    }
    set({ engineStarted: false });
  },
}));
