import { useStore } from '../../store/useStore';
import { relativeTime, cn } from '../../lib/utils';
import { ShieldAlert, Wifi, WifiOff } from 'lucide-react';
import { useState } from 'react';
import { ALL_WARDS } from '../../lib/mockEngine';

export function SensorHealthCenter() {
  const sensors = useStore((s) => s.sensors);
  const [ward, setWard] = useState<'All' | (typeof ALL_WARDS)[number]>('All');
  const filtered = ward === 'All' ? sensors : sensors.filter((s) => s.ward === ward);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold" style={{ color: 'var(--color-ink-100)' }}>
          Sensor &amp; infrastructure health
        </h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-ink-500)' }}>
          CSI receiver/transmitter hardware pairs, link quality, and tamper state across wards
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(['All', ...ALL_WARDS] as const).map((w) => (
          <button
            key={w}
            onClick={() => setWard(w)}
            className="rounded-full px-3 py-1.5 text-xs font-medium"
            style={{
              background: ward === w ? 'var(--color-med-cyan)' : 'var(--color-bg-panel)',
              color: ward === w ? '#04222b' : 'var(--color-ink-300)',
              border: `1px solid ${ward === w ? 'var(--color-med-cyan)' : 'var(--color-hairline-strong)'}`,
            }}
          >
            {w}
          </button>
        ))}
      </div>

      <div className="rounded-lg overflow-hidden" style={{ background: 'var(--color-bg-panel)', border: '1px solid var(--color-hairline)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left" style={{ background: 'var(--color-bg-panel-raised)', color: 'var(--color-ink-500)' }}>
                {['Tx/Rx pair', 'Room', 'RSSI', 'Packet rate', 'Drop %', 'Uptime', 'Firmware', 'Heartbeat', 'Status'].map((h) => (
                  <th key={h} className="px-3 py-2.5 font-medium whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-t" style={{ borderColor: 'var(--color-hairline)' }}>
                  <td className="px-3 py-2.5 font-data" style={{ color: 'var(--color-ink-100)' }}>
                    {s.pairId}
                  </td>
                  <td className="px-3 py-2.5 font-data" style={{ color: 'var(--color-ink-300)' }}>
                    {s.roomCode}
                  </td>
                  <td className="px-3 py-2.5 font-data" style={{ color: s.rssi < -70 ? '#fbbf24' : 'var(--color-ink-300)' }}>
                    {s.rssi} dBm
                  </td>
                  <td className="px-3 py-2.5 font-data" style={{ color: 'var(--color-ink-300)' }}>
                    {s.packetRateHz} Hz
                  </td>
                  <td className="px-3 py-2.5 font-data" style={{ color: s.packetDropPct > 2 ? '#fbbf24' : 'var(--color-ink-300)' }}>
                    {s.packetDropPct}%
                  </td>
                  <td className="px-3 py-2.5 font-data" style={{ color: 'var(--color-ink-300)' }}>
                    {s.uptimeHours}h
                  </td>
                  <td className="px-3 py-2.5 font-data" style={{ color: 'var(--color-ink-700)' }}>
                    {s.firmwareChecksum}
                  </td>
                  <td className="px-3 py-2.5 font-data" style={{ color: 'var(--color-ink-700)' }}>
                    {relativeTime(s.lastHeartbeat)}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className={cn('flex items-center gap-1 text-[11px]')} style={{ color: s.online ? '#34d399' : '#fb7185' }}>
                        {s.online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                        {s.online ? 'Online' : 'Offline'}
                      </span>
                      {s.tamperFlag && (
                        <span className="flex items-center gap-1 text-[11px]" style={{ color: '#fbbf24' }}>
                          <ShieldAlert className="h-3 w-3" />
                          Tamper
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
