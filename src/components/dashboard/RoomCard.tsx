import type { Room } from '../../types';
import { ActivityBadge } from '../ui/ActivityBadge';
import { relativeTime, cn } from '../../lib/utils';
import { WifiOff, TrendingUp } from 'lucide-react';
import { useStore } from '../../store/useStore';

const VECTOR_LABEL: Record<string, string> = { low: 'Low', medium: 'Med', high: 'High' };

export function RoomCard({ room }: { room: Room }) {
  const selectRoom = useStore((s) => s.selectRoom);
  const urgent = room.current.activity === 'confirmed_fall';
  const warn = room.current.activity === 'possible_fall';

  return (
    <button
      onClick={() => selectRoom(room.id)}
      className={cn('text-left rounded-lg p-3.5 transition-all hover:-translate-y-0.5', urgent && 'animate-flash-urgent')}
      style={{
        background: 'var(--color-bg-panel)',
        border: `1px solid ${urgent ? 'rgba(225,29,72,0.55)' : warn ? 'rgba(245,158,11,0.45)' : 'var(--color-hairline)'}`,
      }}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="font-data text-sm font-semibold" style={{ color: 'var(--color-ink-100)' }}>
            {room.code}
          </div>
          <div className="text-[10px]" style={{ color: 'var(--color-ink-500)' }}>
            {room.ward}
          </div>
        </div>
        {!room.sensorOnline && <WifiOff className="h-3.5 w-3.5 text-amber-400" />}
      </div>

      <div className="mb-2.5">
        <ActivityBadge activity={room.current.activity} size="sm" />
      </div>

      <div className="flex items-center justify-between text-[11px] font-data" style={{ color: 'var(--color-ink-500)' }}>
        <span>{room.patientToken}</span>
        <span style={{ color: 'var(--color-ink-300)' }}>{room.current.confidence}%</span>
      </div>

      <div className="flex items-center justify-between mt-2 pt-2 text-[10px]" style={{ borderTop: '1px solid var(--color-hairline)', color: 'var(--color-ink-700)' }}>
        <span className="flex items-center gap-1">
          <TrendingUp className="h-3 w-3" />
          Post-event: {VECTOR_LABEL[room.current.postEventVector]}
        </span>
        <span>{relativeTime(room.lastUpdated)}</span>
      </div>
    </button>
  );
}
