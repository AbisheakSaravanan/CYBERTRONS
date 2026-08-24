import { useEffect, useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { Room, SensorNode } from '../../types';
import { generateSubcarriers } from '../../lib/mockEngine';
import { Cpu, Wifi, Activity, ShieldAlert } from 'lucide-react';

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'warn' | 'default' }) {
  return (
    <div className="rounded-md px-3 py-2.5" style={{ background: 'var(--color-bg-inset)', border: '1px solid var(--color-hairline)' }}>
      <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: 'var(--color-ink-700)' }}>
        {label}
      </div>
      <div className="font-data text-sm font-semibold" style={{ color: tone === 'warn' ? '#fbbf24' : 'var(--color-ink-100)' }}>
        {value}
      </div>
    </div>
  );
}

export function TechnicalView({ room, sensor }: { room: Room; sensor: SensorNode | undefined }) {
  const disturbed = room.current.activity === 'possible_fall' || room.current.activity === 'confirmed_fall' || room.current.activity === 'walking';
  const [subcarriers, setSubcarriers] = useState(() => generateSubcarriers(0, disturbed));
  const [phaseHistory, setPhaseHistory] = useState<{ t: number; variance: number }[]>([]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const sc = generateSubcarriers(Math.random() * 10, disturbed);
      setSubcarriers(sc);
      const variance = sc.reduce((acc, s) => acc + Math.abs(s.phase), 0) / sc.length;
      setPhaseHistory((prev) => [...prev.slice(-29), { t: prev.length, variance: Math.round(variance * 100) / 100 }]);
    }, 1200);
    return () => window.clearInterval(id);
  }, [disturbed]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-lg p-4" style={{ background: 'var(--color-bg-panel)', border: '1px solid var(--color-hairline)' }}>
        <div className="flex items-center gap-1.5 text-sm font-medium mb-3" style={{ color: 'var(--color-ink-100)' }}>
          <Activity className="h-4 w-4" style={{ color: 'var(--color-med-cyan)' }} />
          Subcarrier amplitude (64ch)
        </div>
        <div style={{ height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={subcarriers}>
              <CartesianGrid stroke="var(--color-hairline)" vertical={false} />
              <XAxis dataKey="index" tick={{ fontSize: 9, fill: 'var(--color-ink-700)' }} interval={7} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: 'var(--color-ink-700)' }} width={24} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'var(--color-bg-panel-raised)', border: '1px solid var(--color-hairline-strong)', borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="amplitude" fill="var(--color-med-cyan)" radius={[2, 2, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-lg p-4" style={{ background: 'var(--color-bg-panel)', border: '1px solid var(--color-hairline)' }}>
        <div className="flex items-center gap-1.5 text-sm font-medium mb-3" style={{ color: 'var(--color-ink-100)' }}>
          <Cpu className="h-4 w-4" style={{ color: 'var(--color-med-cyan)' }} />
          Temporal phase variance
        </div>
        <div style={{ height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={phaseHistory}>
              <CartesianGrid stroke="var(--color-hairline)" vertical={false} />
              <XAxis dataKey="t" hide />
              <YAxis tick={{ fontSize: 9, fill: 'var(--color-ink-700)' }} width={24} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'var(--color-bg-panel-raised)', border: '1px solid var(--color-hairline-strong)', borderRadius: 8, fontSize: 11 }} />
              <Line type="monotone" dataKey="variance" stroke="#a78bfa" strokeWidth={1.75} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="lg:col-span-2 rounded-lg p-4" style={{ background: 'var(--color-bg-panel)', border: '1px solid var(--color-hairline)' }}>
        <div className="flex items-center gap-1.5 text-sm font-medium mb-3" style={{ color: 'var(--color-ink-100)' }}>
          <Wifi className="h-4 w-4" style={{ color: 'var(--color-med-cyan)' }} />
          Transceiver diagnostics — {sensor?.pairId ?? 'n/a'}
        </div>
        {sensor ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <Stat label="RSSI" value={`${sensor.rssi} dBm`} />
            <Stat label="Packet rate" value={`${sensor.packetRateHz} Hz`} />
            <Stat label="Packet drop" value={`${sensor.packetDropPct}%`} tone={sensor.packetDropPct > 2 ? 'warn' : 'default'} />
            <Stat label="Uptime" value={`${sensor.uptimeHours}h`} />
            <Stat label="Firmware checksum" value={sensor.firmwareChecksum} />
            <Stat label="Status" value={sensor.online ? 'Online' : 'Offline'} tone={sensor.online ? 'default' : 'warn'} />
          </div>
        ) : (
          <p className="text-xs" style={{ color: 'var(--color-ink-500)' }}>No paired sensor record found.</p>
        )}
        {sensor?.tamperFlag && (
          <div className="mt-3 flex items-center gap-1.5 text-xs rounded-md px-3 py-2" style={{ background: 'rgba(245,158,11,0.1)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)' }}>
            <ShieldAlert className="h-3.5 w-3.5" />
            Physical tampering signature detected on this node — flagged for Security review.
          </div>
        )}
      </div>
    </div>
  );
}
