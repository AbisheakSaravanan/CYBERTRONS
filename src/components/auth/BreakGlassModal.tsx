import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useStore } from '../../store/useStore';

const REASONS = [
  'Life-threatening emergency — immediate record access required',
  'Rapid Response Team activation support',
  'System failure requiring manual patient status verification',
  'Law enforcement / risk-management directive',
  'Other (explain below)',
];

export function BreakGlassModal({ onClose }: { onClose: () => void }) {
  const activateBreakGlass = useStore((s) => s.activateBreakGlass);
  const [reason, setReason] = useState(REASONS[0]);
  const [rationale, setRationale] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  function submit() {
    if (!rationale.trim()) return;
    activateBreakGlass(reason, rationale.trim());
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-md rounded-xl overflow-hidden" style={{ background: 'var(--color-bg-panel)', border: '1px solid rgba(225,29,72,0.4)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ background: 'rgba(225,29,72,0.12)', borderBottom: '1px solid rgba(225,29,72,0.3)' }}>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4.5 w-4.5 text-rose-400" />
            <span className="text-sm font-semibold text-rose-200">Emergency break-glass access</span>
          </div>
          <button onClick={onClose} className="text-rose-300/70 hover:text-rose-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs" style={{ color: 'var(--color-ink-300)' }}>
            This grants a temporary, auto-expiring 15-minute elevated session. Activation is instantly written to the
            tamper-evident hash-chained audit log and reviewed by Security.
          </p>

          <div>
            <label className="block text-xs mb-1.5" style={{ color: 'var(--color-ink-300)' }}>
              Reason for override
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-md px-3 py-2 text-sm outline-none"
              style={{ background: 'var(--color-bg-inset)', border: '1px solid var(--color-hairline-strong)', color: 'var(--color-ink-100)' }}
            >
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs mb-1.5" style={{ color: 'var(--color-ink-300)' }}>
              Mandatory rationale (free text)
            </label>
            <textarea
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              rows={3}
              placeholder="Describe the clinical or operational necessity…"
              className="w-full rounded-md px-3 py-2 text-sm outline-none resize-none"
              style={{ background: 'var(--color-bg-inset)', border: '1px solid var(--color-hairline-strong)', color: 'var(--color-ink-100)' }}
            />
          </div>

          <label className="flex items-start gap-2 text-xs" style={{ color: 'var(--color-ink-500)' }}>
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5" />
            I understand this action is logged, reviewed, and subject to institutional policy on emergency access.
          </label>

          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 rounded-md py-2 text-sm" style={{ border: '1px solid var(--color-hairline-strong)', color: 'var(--color-ink-300)' }}>
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={!rationale.trim() || !confirmed}
              className="flex-1 rounded-md py-2 text-sm font-medium disabled:opacity-40"
              style={{ background: '#e11d48', color: 'white' }}
            >
              Activate 15-min override
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
