import { useEffect, useState } from 'react';
import { useStore } from '../../store/useStore';
import { AlertTriangle, Volume2, CheckCircle2, Siren } from 'lucide-react';
import { countdown } from '../../lib/utils';

export function FallAlertModal() {
  const alerts = useStore((s) => s.alerts);
  const acknowledgeAlert = useStore((s) => s.acknowledgeAlert);
  const escalateAlert = useStore((s) => s.escalateAlert);
  const selectRoom = useStore((s) => s.selectRoom);
  const session = useStore((s) => s.session);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [, forceTick] = useState(0);

  const priority = alerts.find((a) => (a.stage === 'confirmed' || a.stage === 'verifying') && !dismissedIds.has(a.id));

  useEffect(() => {
    if (!priority) return;
    const id = window.setInterval(() => forceTick((x) => x + 1), 1000);
    return () => window.clearInterval(id);
  }, [priority]);

  if (!priority) return null;
  const confirmed = priority.stage === 'confirmed';

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-16 px-4" style={{ background: 'rgba(2,6,23,0.82)' }}>
      <div
        className="w-full max-w-md rounded-xl overflow-hidden animate-flash-urgent"
        style={{ border: '1px solid rgba(225,29,72,0.6)', background: 'var(--color-bg-panel)' }}
      >
        <div className="px-5 py-4 flex items-center gap-2" style={{ background: 'rgba(225,29,72,0.25)' }}>
          {confirmed ? <Siren className="h-5 w-5 text-rose-300" /> : <AlertTriangle className="h-5 w-5 text-amber-300" />}
          <div className="flex-1">
            <div className="text-sm font-bold text-rose-100">{confirmed ? 'CONFIRMED FALL' : 'POSSIBLE FALL — VERIFYING'}</div>
            <div className="text-[11px] text-rose-200/80">Room {priority.roomCode} · {priority.ward}</div>
          </div>
          <Volume2 className="h-4 w-4 text-rose-200/70" />
        </div>

        <div className="p-5 space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-md py-2" style={{ background: 'var(--color-bg-inset)' }}>
              <div className="font-data text-lg font-semibold text-rose-200">{priority.confidence}%</div>
              <div className="text-[9px] uppercase" style={{ color: 'var(--color-ink-700)' }}>
                ML confidence
              </div>
            </div>
            <div className="rounded-md py-2" style={{ background: 'var(--color-bg-inset)' }}>
              <div className="font-data text-lg font-semibold" style={{ color: 'var(--color-ink-100)' }}>
                {confirmed ? '—' : countdown(priority.verificationEndsAt)}
              </div>
              <div className="text-[9px] uppercase" style={{ color: 'var(--color-ink-700)' }}>
                {confirmed ? 'verified' : 'verification'}
              </div>
            </div>
            <div className="rounded-md py-2" style={{ background: 'var(--color-bg-inset)' }}>
              <div className="font-data text-lg font-semibold capitalize" style={{ color: 'var(--color-ink-100)' }}>
                {priority.postEventVector}
              </div>
              <div className="text-[9px] uppercase" style={{ color: 'var(--color-ink-700)' }}>
                movement
              </div>
            </div>
          </div>

          <p className="text-[11px]" style={{ color: 'var(--color-ink-500)' }}>
            {confirmed
              ? 'Sustained low post-event movement corroborated the initial classification. Acknowledge to notify the nurse on duty, then escalate if a Rapid Response Team is needed.'
              : 'A 15-second temporal verification window is open to reduce false positives before broadcasting a confirmed alert.'}
          </p>

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => {
                selectRoom(priority.roomId);
                setDismissedIds((s) => new Set(s).add(priority.id));
              }}
              className="flex-1 rounded-md py-2 text-xs font-medium"
              style={{ border: '1px solid var(--color-hairline-strong)', color: 'var(--color-ink-300)' }}
            >
              View room
            </button>
            <button
              onClick={() => acknowledgeAlert(priority.id, session?.displayName ?? 'Staff')}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-medium"
              style={{ background: 'var(--color-med-cyan)', color: '#04222b' }}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Acknowledge
            </button>
          </div>
          {confirmed && (
            <button onClick={() => escalateAlert(priority.id)} className="w-full rounded-md py-2 text-xs font-medium" style={{ background: 'rgba(225,29,72,0.85)', color: 'white' }}>
              Escalate to Rapid Response Team
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
