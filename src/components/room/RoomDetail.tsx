import { useState } from 'react';
import { useStore } from '../../store/useStore';
import { ClinicalView } from './ClinicalView';
import { TechnicalView } from './TechnicalView';
import { ArrowLeft, WifiOff } from 'lucide-react';
import { cn } from '../../lib/utils';

export function RoomDetail() {
  const selectedRoomId = useStore((s) => s.selectedRoomId);
  const rooms = useStore((s) => s.rooms);
  const sensors = useStore((s) => s.sensors);
  const role = useStore((s) => s.role);
  const selectRoom = useStore((s) => s.selectRoom);
  const [mode, setMode] = useState<'clinical' | 'technical'>('clinical');

  const room = rooms.find((r) => r.id === selectedRoomId);
  if (!room) return null;
  const sensor = sensors.find((s) => s.roomCode === room.code);
  const canSeeTechnical = role === 'technician' || role === 'administrator';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => selectRoom(null)} className="rounded-md p-1.5" style={{ color: 'var(--color-ink-500)' }}>
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold font-data" style={{ color: 'var(--color-ink-100)' }}>
                {room.code}
              </h1>
              {!room.sensorOnline && (
                <span className="flex items-center gap-1 text-[11px] text-amber-400">
                  <WifiOff className="h-3 w-3" /> sensor offline
                </span>
              )}
            </div>
            <p className="text-xs" style={{ color: 'var(--color-ink-500)' }}>
              {room.ward} · {room.patientToken}
            </p>
          </div>
        </div>

        {canSeeTechnical && (
          <div className="flex rounded-md overflow-hidden" style={{ border: '1px solid var(--color-hairline-strong)' }}>
            {(['clinical', 'technical'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn('px-3.5 py-1.5 text-xs font-medium capitalize')}
                style={{
                  background: mode === m ? 'var(--color-med-cyan)' : 'transparent',
                  color: mode === m ? '#04222b' : 'var(--color-ink-300)',
                }}
              >
                {m}
              </button>
            ))}
          </div>
        )}
      </div>

      {mode === 'clinical' || !canSeeTechnical ? <ClinicalView room={room} /> : <TechnicalView room={room} sensor={sensor} />}
    </div>
  );
}
