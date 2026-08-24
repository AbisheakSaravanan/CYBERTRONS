import type { Room } from '../../types';
import { ConfidenceGauge } from '../ui/ConfidenceGauge';
import { ActivityBadge } from '../ui/ActivityBadge';
import { ActivityTimeline } from './ActivityTimeline';
import { AlertPanel } from './AlertPanel';
import { formatClock } from '../../lib/utils';
import { ACTIVITY_COLOR_VAR } from '../../lib/utils';
import { TrendingUp, Clock } from 'lucide-react';

const VECTOR_TEXT: Record<string, { label: string; note: string }> = {
  low: { label: 'Low', note: 'Minimal movement following the event — consistent with a settled or resting state.' },
  medium: { label: 'Medium', note: 'Moderate post-event movement — patient may be repositioning or attempting to rise.' },
  high: { label: 'High', note: 'Significant post-event movement — recommend prompt in-person check.' },
};

export function ClinicalView({ room }: { room: Room }) {
  const vector = VECTOR_TEXT[room.current.postEventVector];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-4">
        <div className="rounded-lg p-4 flex items-center gap-5" style={{ background: 'var(--color-bg-panel)', border: '1px solid var(--color-hairline)' }}>
          <ConfidenceGauge value={room.current.confidence} colorVar={ACTIVITY_COLOR_VAR[room.current.activity]} />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              <ActivityBadge activity={room.current.activity} size="lg" />
            </div>
            <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-ink-500)' }}>
              <Clock className="h-3.5 w-3.5" />
              Classified at {formatClock(room.current.timestamp)}
            </div>
            <div className="text-[11px] mt-1" style={{ color: 'var(--color-ink-700)' }}>
              Patient token {room.patientToken} · {room.ward}
            </div>
          </div>
        </div>

        <ActivityTimeline room={room} />
        <AlertPanel roomId={room.id} />
      </div>

      <div className="space-y-4">
        <div className="rounded-lg p-4" style={{ background: 'var(--color-bg-panel)', border: '1px solid var(--color-hairline)' }}>
          <div className="flex items-center gap-1.5 text-sm font-medium mb-2" style={{ color: 'var(--color-ink-100)' }}>
            <TrendingUp className="h-4 w-4" style={{ color: 'var(--color-med-cyan)' }} />
            Post-event movement analysis
          </div>
          <div className="text-2xl font-data font-semibold mb-1" style={{ color: 'var(--color-ink-100)' }}>
            {vector.label}
          </div>
          <p className="text-xs" style={{ color: 'var(--color-ink-500)' }}>
            {vector.note}
          </p>
        </div>

        <div className="rounded-lg p-4 text-[11px] leading-relaxed" style={{ background: 'var(--color-bg-inset)', border: '1px solid var(--color-hairline)', color: 'var(--color-ink-700)' }}>
          Decision support only. This platform assists clinical judgement and does not independently execute
          autonomous medical orders. Always confirm patient status in person before acting on an alert.
        </div>
      </div>
    </div>
  );
}
