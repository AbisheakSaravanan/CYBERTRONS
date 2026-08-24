import { useState, useEffect } from 'react';
import { Radio, AlertTriangle, LogOut, Bot, ChevronDown, ShieldAlert } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { WaveformStrip } from '../ui/WaveformStrip';
import { BreakGlassModal } from '../auth/BreakGlassModal';
import { countdown, cn } from '../../lib/utils';
import type { Role } from '../../types';

const ROLE_LABEL: Record<Role, string> = {
  doctor: 'Doctor',
  nurse: 'Nurse',
  technician: 'Technician',
  security: 'Security Officer',
  administrator: 'Administrator',
};

export function TopBar() {
  const session = useStore((s) => s.session);
  const role = useStore((s) => s.role);
  const setRole = useStore((s) => s.setRole);
  const logout = useStore((s) => s.logout);
  const breakGlass = useStore((s) => s.breakGlass);
  const endBreakGlass = useStore((s) => s.endBreakGlass);
  const alerts = useStore((s) => s.alerts);
  const toggleAssistant = useStore((s) => s.toggleAssistant);
  const assistantOpen = useStore((s) => s.assistantOpen);
  const [roleMenu, setRoleMenu] = useState(false);
  const [bgOpen, setBgOpen] = useState(false);
  const [, forceTick] = useState(0);

  const activeCritical = alerts.filter((a) => a.stage === 'verifying' || a.stage === 'confirmed').length;

  useEffect(() => {
    if (!breakGlass.active) return;
    const id = window.setInterval(() => forceTick((x) => x + 1), 1000);
    return () => window.clearInterval(id);
  }, [breakGlass.active]);

  useEffect(() => {
    if (breakGlass.active && breakGlass.expiresAt && new Date(breakGlass.expiresAt).getTime() <= Date.now()) {
      endBreakGlass();
    }
  }, [breakGlass, endBreakGlass]);

  return (
    <header className="sticky top-0 z-40" style={{ background: 'var(--color-bg-panel)', borderBottom: '1px solid var(--color-hairline)' }}>
      <div className="flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-md flex items-center justify-center" style={{ background: 'var(--color-bg-panel-raised)', border: '1px solid var(--color-hairline-strong)' }}>
            <Radio className="h-4 w-4" style={{ color: 'var(--color-med-cyan)' }} />
          </div>
          <div className="leading-tight hidden sm:block">
            <div className="text-sm font-semibold" style={{ color: 'var(--color-ink-100)' }}>
              Aegis-CSI
            </div>
            <div className="text-[10px]" style={{ color: 'var(--color-ink-500)' }}>
              Camera-free ambient sensing
            </div>
          </div>

          {activeCritical > 0 && (
            <div className="ml-2 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium animate-flash-urgent" style={{ color: '#fecdd3' }}>
              <AlertTriangle className="h-3.5 w-3.5" />
              {activeCritical} active fall alert{activeCritical > 1 ? 's' : ''}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {breakGlass.active && (
            <div className="hidden md:flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-data" style={{ background: 'rgba(225,29,72,0.15)', color: '#fda4af', border: '1px solid rgba(225,29,72,0.4)' }}>
              <ShieldAlert className="h-3 w-3" />
              BREAK-GLASS · {countdown(breakGlass.expiresAt)}
              <button onClick={endBreakGlass} className="ml-1 underline decoration-dotted">
                end
              </button>
            </div>
          )}

          <button
            onClick={() => setBgOpen(true)}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium"
            style={{ border: '1px solid rgba(225,29,72,0.35)', color: '#fca5a5' }}
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            Break-glass
          </button>

          <button
            onClick={toggleAssistant}
            className={cn('inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium')}
            style={{
              border: '1px solid var(--color-hairline-strong)',
              color: assistantOpen ? 'var(--color-med-cyan)' : 'var(--color-ink-300)',
              background: assistantOpen ? 'rgba(34,211,238,0.08)' : 'transparent',
            }}
          >
            <Bot className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Assistant</span>
          </button>

          <div className="relative">
            <button
              onClick={() => setRoleMenu((v) => !v)}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs"
              style={{ border: '1px solid var(--color-hairline-strong)', color: 'var(--color-ink-100)' }}
            >
              {ROLE_LABEL[role]}
              <ChevronDown className="h-3 w-3" />
            </button>
            {roleMenu && (
              <div
                className="absolute right-0 mt-1 w-48 rounded-md overflow-hidden z-50"
                style={{ background: 'var(--color-bg-panel-raised)', border: '1px solid var(--color-hairline-strong)' }}
              >
                {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => {
                      setRole(r);
                      setRoleMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-white/5"
                    style={{ color: r === role ? 'var(--color-med-cyan)' : 'var(--color-ink-300)' }}
                  >
                    {ROLE_LABEL[r]}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="hidden lg:block text-right leading-tight">
            <div className="text-xs" style={{ color: 'var(--color-ink-100)' }}>
              {session?.displayName}
            </div>
            <div className="text-[10px] font-data" style={{ color: 'var(--color-ink-700)' }}>
              {session?.employeeId}
            </div>
          </div>

          <button onClick={logout} className="rounded-md p-2" style={{ color: 'var(--color-ink-500)' }} title="Sign out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
      <WaveformStrip height={20} />
      {bgOpen && <BreakGlassModal onClose={() => setBgOpen(false)} />}
    </header>
  );
}
