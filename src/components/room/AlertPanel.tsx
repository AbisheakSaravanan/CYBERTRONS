import React, { useMemo } from 'react';
import { useStore } from '../../store/useStore';
import { AlertTriangle, CheckCircle, ShieldAlert } from 'lucide-react';

interface AlertPanelProps {
  roomId: string;
}

export const AlertPanel: React.FC<AlertPanelProps> = ({ roomId }) => {
  // 1. Select stable references from Zustand
  const alerts = useStore((state) => state.alerts);
  const acknowledgeAlert = useStore((state) => state.acknowledgeAlert);

  // 2. Memoize filtered list to prevent infinite getSnapshot loop
  const roomAlerts = useMemo(() => {
    return (alerts || []).filter((alert) => alert.roomId === roomId);
  }, [alerts, roomId]);

  if (roomAlerts.length === 0) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4 text-center">
        <p className="text-sm text-slate-400">No active alerts for this room.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {roomAlerts.map((alert) => (
        <div
          key={alert.id}
          className={`flex items-center justify-between rounded-lg border p-3.5 ${
            alert.severity === 'critical'
              ? 'border-rose-500/50 bg-rose-950/20 text-rose-200'
              : 'border-amber-500/50 bg-amber-950/20 text-amber-200'
          }`}
        >
          <div className="flex items-center gap-3">
            {alert.severity === 'critical' ? (
              <ShieldAlert className="h-5 w-5 text-rose-400 shrink-0" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
            )}
            <div>
              <p className="text-sm font-semibold">{alert.type}</p>
              <p className="text-xs text-slate-400">
                Confidence: {alert.confidence}% • {alert.timestamp}
              </p>
            </div>
          </div>

          <button
            onClick={() => acknowledgeAlert(alert.id)}
            className="flex items-center gap-1.5 rounded bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition"
          >
            <CheckCircle className="h-3.5 w-3.5" />
            Acknowledge
          </button>
        </div>
      ))}
    </div>
  );
};