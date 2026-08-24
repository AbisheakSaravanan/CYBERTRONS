import { useStore } from '../../store/useStore';
import { DoorClosed, Radio, RadioTower, AlertOctagon, Siren, Clock } from 'lucide-react';

function Metric({ label, value, icon: Icon, tone = 'default' }: { label: string; value: string; icon: React.ElementType; tone?: 'default' | 'warn' | 'danger' | 'cyan' }) {
  const toneColor = {
    default: 'var(--color-ink-100)',
    warn: '#fbbf24',
    danger: '#fb7185',
    cyan: 'var(--color-med-cyan)',
  }[tone];
  return (
    <div className="flex-1 min-w-[140px] rounded-lg px-4 py-3" style={{ background: 'var(--color-bg-panel)', border: '1px solid var(--color-hairline)' }}>
      <div className="flex items-center gap-1.5 mb-1.5 text-[10px] uppercase tracking-wide" style={{ color: 'var(--color-ink-500)' }}>
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="font-data text-xl font-semibold" style={{ color: toneColor }}>
        {value}
      </div>
    </div>
  );
}

export function MetricStrip() {
  const rooms = useStore((s) => s.rooms);
  const alerts = useStore((s) => s.alerts);

  const online = rooms.filter((r) => r.sensorOnline).length;
  const offline = rooms.length - online;
  const possibleOrConfirmed = alerts.filter((a) => a.stage === 'verifying' || a.stage === 'confirmed').length;
  const warningNodes = rooms.filter((r) => r.current.activity === 'possible_fall' || r.current.activity === 'confirmed_fall').length;
  const avgResponse = 92; // seconds, illustrative mock KPI

  return (
    <div className="flex flex-wrap gap-3">
      <Metric label="Monitored rooms" value={String(rooms.length)} icon={DoorClosed} />
      <Metric label="Online transceivers" value={String(online)} icon={Radio} tone="cyan" />
      <Metric label="Offline sensors" value={String(offline)} icon={RadioTower} tone={offline > 0 ? 'warn' : 'default'} />
      <Metric label="Active warning nodes" value={String(warningNodes)} icon={AlertOctagon} tone={warningNodes > 0 ? 'warn' : 'default'} />
      <Metric label="Pending critical falls" value={String(possibleOrConfirmed)} icon={Siren} tone={possibleOrConfirmed > 0 ? 'danger' : 'default'} />
      <Metric label="Mean staff response" value={`${avgResponse}s`} icon={Clock} />
    </div>
  );
}
