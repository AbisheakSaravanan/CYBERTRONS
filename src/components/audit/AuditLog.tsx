import { useMemo } from 'react';
import { useStore } from '../../store/useStore';
import { formatClock } from '../../lib/utils';
import { ShieldCheck, ShieldX } from 'lucide-react';

export function AuditLog() {
  const auditLog = useStore((s) => s.auditLog);

  const chainIntact = useMemo(() => {
    for (let i = 0; i < auditLog.length - 1; i++) {
      if (auditLog[i].prevHash !== auditLog[i + 1].currHash) return false;
    }
    return true;
  }, [auditLog]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--color-ink-100)' }}>
            Tamper-evident audit log
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-ink-500)' }}>
            Every access, role switch, and override forms a hash-chained, append-only record
          </p>
        </div>
        <div
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium"
          style={{
            background: chainIntact ? 'rgba(16,185,129,0.12)' : 'rgba(225,29,72,0.15)',
            color: chainIntact ? '#34d399' : '#fb7185',
            border: `1px solid ${chainIntact ? 'rgba(16,185,129,0.35)' : 'rgba(225,29,72,0.4)'}`,
          }}
        >
          {chainIntact ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldX className="h-3.5 w-3.5" />}
          {chainIntact ? 'Chain integrity verified' : 'Chain integrity broken'}
        </div>
      </div>

      <div className="rounded-lg overflow-hidden" style={{ background: 'var(--color-bg-panel)', border: '1px solid var(--color-hairline)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left" style={{ background: 'var(--color-bg-panel-raised)', color: 'var(--color-ink-500)' }}>
                {['Timestamp', 'Actor', 'Role', 'Action', 'Resource', 'IP', 'Prev hash', 'Curr hash'].map((h) => (
                  <th key={h} className="px-3 py-2.5 font-medium whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {auditLog.map((e) => (
                <tr key={e.id} className="border-t" style={{ borderColor: 'var(--color-hairline)' }}>
                  <td className="px-3 py-2.5 font-data whitespace-nowrap" style={{ color: 'var(--color-ink-300)' }}>
                    {formatClock(e.timestamp)}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: 'var(--color-ink-100)' }}>
                    {e.actor}
                  </td>
                  <td className="px-3 py-2.5 capitalize whitespace-nowrap" style={{ color: 'var(--color-ink-500)' }}>
                    {e.role}
                  </td>
                  <td className="px-3 py-2.5" style={{ color: 'var(--color-ink-300)' }}>
                    {e.action}
                  </td>
                  <td className="px-3 py-2.5 font-data whitespace-nowrap" style={{ color: 'var(--color-ink-500)' }}>
                    {e.resource}
                  </td>
                  <td className="px-3 py-2.5 font-data whitespace-nowrap" style={{ color: 'var(--color-ink-700)' }}>
                    {e.ip}
                  </td>
                  <td className="px-3 py-2.5 font-data whitespace-nowrap" style={{ color: 'var(--color-ink-700)' }} title={e.prevHash}>
                    {e.prevHash.slice(0, 10)}…
                  </td>
                  <td className="px-3 py-2.5 font-data whitespace-nowrap" style={{ color: 'var(--color-ink-700)' }} title={e.currHash}>
                    {e.currHash.slice(0, 10)}…
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
