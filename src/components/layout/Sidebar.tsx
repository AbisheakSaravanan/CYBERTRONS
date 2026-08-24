import { LayoutGrid, Activity, HeartPulse, ScrollText, Cpu } from 'lucide-react';
import { useStore } from '../../store/useStore';
import type { View } from '../../store/useStore';
import { cn } from '../../lib/utils';

const NAV: { view: View; label: string; icon: React.ElementType }[] = [
  { view: 'dashboard', label: 'Command Dashboard', icon: LayoutGrid },
  { view: 'sensors', label: 'Sensor Health', icon: HeartPulse },
  { view: 'audit', label: 'Audit Log', icon: ScrollText },
];

export function Sidebar() {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const role = useStore((s) => s.role);
  const rooms = useStore((s) => s.rooms);
  const alerts = useStore((s) => s.alerts);
  const onlineSensors = rooms.filter((r) => r.sensorOnline).length;
  const criticalCount = alerts.filter((a) => a.stage === 'verifying' || a.stage === 'confirmed').length;

  return (
    <aside
      className="hidden md:flex w-56 shrink-0 flex-col justify-between px-3 py-4"
      style={{ background: 'var(--color-bg-panel)', borderRight: '1px solid var(--color-hairline)' }}
    >
      <div>
        <div className="px-2 mb-3 text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-ink-700)' }}>
          Navigation
        </div>
        <nav className="space-y-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = view === item.view;
            return (
              <button
                key={item.view}
                onClick={() => setView(item.view)}
                className={cn('w-full flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs font-medium transition-colors')}
                style={{
                  background: active ? 'rgba(34,211,238,0.1)' : 'transparent',
                  color: active ? 'var(--color-med-cyan)' : 'var(--color-ink-300)',
                }}
              >
                <Icon className="h-4 w-4" />
                {item.label}
                {item.view === 'dashboard' && criticalCount > 0 && (
                  <span className="ml-auto text-[10px] rounded-full px-1.5 py-0.5 bg-rose-500/20 text-rose-300">{criticalCount}</span>
                )}
              </button>
            );
          })}
        </nav>

        {(role === 'technician' || role === 'administrator') && (
          <div className="mt-6 px-2.5 py-2 rounded-md text-[11px]" style={{ background: 'var(--color-bg-inset)', color: 'var(--color-ink-500)' }}>
            <div className="flex items-center gap-1.5 mb-1" style={{ color: 'var(--color-ink-300)' }}>
              <Cpu className="h-3 w-3" />
              Technical mode enabled
            </div>
            Room views expose subcarrier amplitude/phase and hardware diagnostics.
          </div>
        )}
      </div>

      <div className="px-2.5 py-3 rounded-lg text-[11px] space-y-1.5" style={{ background: 'var(--color-bg-inset)', border: '1px solid var(--color-hairline)' }}>
        <div className="flex items-center gap-1.5" style={{ color: 'var(--color-ink-300)' }}>
          <Activity className="h-3 w-3" style={{ color: 'var(--color-med-cyan)' }} />
          Fleet status
        </div>
        <div className="flex justify-between font-data" style={{ color: 'var(--color-ink-500)' }}>
          <span>Sensors online</span>
          <span style={{ color: 'var(--color-ink-100)' }}>
            {onlineSensors}/{rooms.length}
          </span>
        </div>
      </div>
    </aside>
  );
}
