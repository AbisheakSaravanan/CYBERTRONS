// Frontend API client to interact with FastAPI backend

export const API_BASE_URL = 'http://localhost:8000';
export const WS_BASE_URL = 'ws://localhost:8000/ws/live';

export interface AlertActionPayload {
  acknowledged_by: string;
}

export interface BreakGlassPayload {
  reason: string;
  rationale: string;
  actor: string;
}

export async function fetchSystemState() {
  const res = await fetch(`${API_BASE_URL}/api/state`);
  if (!res.ok) {
    throw new Error(`Failed to fetch state: ${res.statusText}`);
  }
  return res.json();
}

export async function acknowledgeAlert(alertId: string, byName: string) {
  const res = await fetch(`${API_BASE_URL}/api/alerts/${alertId}/acknowledge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ acknowledged_by: byName }),
  });
  if (!res.ok) {
    throw new Error(`Failed to acknowledge alert: ${res.statusText}`);
  }
  return res.json();
}

export async function escalateAlert(alertId: string, byName: string) {
  const res = await fetch(`${API_BASE_URL}/api/alerts/${alertId}/escalate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ acknowledged_by: byName }),
  });
  if (!res.ok) {
    throw new Error(`Failed to escalate alert: ${res.statusText}`);
  }
  return res.json();
}

export async function resolveAlert(alertId: string, byName: string) {
  const res = await fetch(`${API_BASE_URL}/api/alerts/${alertId}/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ acknowledged_by: byName }),
  });
  if (!res.ok) {
    throw new Error(`Failed to resolve alert: ${res.statusText}`);
  }
  return res.json();
}

export async function activateBreakGlass(reason: string, rationale: string, actor: string) {
  const res = await fetch(`${API_BASE_URL}/api/break-glass`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason, rationale, actor }),
  });
  if (!res.ok) {
    throw new Error(`Failed to activate break glass: ${res.statusText}`);
  }
  return res.json();
}

export async function triggerDemoFall(roomId: string) {
  const res = await fetch(`${API_BASE_URL}/api/demo/fall?room_id=${roomId}`, {
    method: 'POST',
  });
  if (!res.ok) {
    throw new Error(`Failed to trigger demo fall: ${res.statusText}`);
  }
  return res.json();
}

export function connectWebSocket(
  onMessage: (data: any) => void,
  onError?: (err: Event) => void,
  onClose?: () => void
): WebSocket {
  const ws = new WebSocket(WS_BASE_URL);
  
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage(data);
    } catch (e) {
      console.error('Error parsing WebSocket message:', e);
    }
  };
  
  if (onError) {
    ws.onerror = onError;
  }
  
  if (onClose) {
    ws.onclose = onClose;
  }
  
  return ws;
}
