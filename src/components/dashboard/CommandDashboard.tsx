import { MetricStrip } from './MetricStrip';
import { WardFilter } from './WardFilter';
import { RoomGrid } from './RoomGrid';
import { useStore } from '../../store/useStore';
import { FlaskConical } from 'lucide-react';

export function CommandDashboard() {
  const rooms = useStore((s) => s.rooms);
  const simulateFallInRoom = useStore((s) => s.simulateFallInRoom);

  function triggerDemoFall() {
    const eligible = rooms.filter((r) => r.sensorOnline && r.current.activity !== 'possible_fall' && r.current.activity !== 'confirmed_fall');
    if (eligible.length === 0) return;
    const room = eligible[Math.floor(Math.random() * eligible.length)];
    simulateFallInRoom(room.id);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--color-ink-100)' }}>
            Command Dashboard
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-ink-500)' }}>
            Live activity classification across all monitored wards · privacy-safe spatial telemetry only
          </p>
        </div>
        <button
          onClick={triggerDemoFall}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium"
          style={{ border: '1px dashed var(--color-hairline-strong)', color: 'var(--color-ink-500)' }}
          title="Development/demo control — injects a simulated fall event"
        >
          <FlaskConical className="h-3.5 w-3.5" />
          Simulate fall event
        </button>
      </div>

      <MetricStrip />
      <WardFilter />
      <RoomGrid />
    </div>
  );
}
