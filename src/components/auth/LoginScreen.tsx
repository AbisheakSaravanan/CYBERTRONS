import { useState } from 'react';
import { ShieldCheck, Radio, Lock } from 'lucide-react';
import { WaveformStrip } from '../ui/WaveformStrip';
import { MFAModal } from './MFAModal';
import { useStore } from '../../store/useStore';
import type { Role } from '../../types';

const ROLES: { value: Role; label: string }[] = [
  { value: 'nurse', label: 'Nurse' },
  { value: 'doctor', label: 'Doctor' },
  { value: 'technician', label: 'Technician' },
  { value: 'security', label: 'Security Officer' },
  { value: 'administrator', label: 'Administrator' },
];

export function LoginScreen() {
  const login = useStore((s) => s.login);
  const [step, setStep] = useState<'credentials' | 'mfa'>('credentials');
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('nurse');
  const [failCount, setFailCount] = useState(0);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState('');

  function submitCredentials(e: React.FormEvent) {
    e.preventDefault();
    if (locked) return;
    if (employeeId.trim().length < 3 || password.length < 4) {
      const next = failCount + 1;
      setFailCount(next);
      setError('Employee ID or password not recognized.');
      if (next >= 5) {
        setLocked(true);
        setError('Account locked for 60s after 5 failed attempts.');
        window.setTimeout(() => {
          setLocked(false);
          setFailCount(0);
          setError('');
        }, 60000);
      }
      return;
    }
    setError('');
    setStep('mfa');
  }

  function completeMfa(displayName: string) {
    login(employeeId.trim(), displayName, role);
  }

  return (
    <div className="min-h-screen w-full flex flex-col bg-bg-canvas" style={{ background: 'var(--color-bg-canvas)' }}>
      <div className="border-b" style={{ borderColor: 'var(--color-hairline)' }}>
        <WaveformStrip height={22} />
      </div>
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2.5 mb-8 justify-center">
            <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ background: 'var(--color-bg-panel-raised)', border: '1px solid var(--color-hairline-strong)' }}>
              <Radio className="h-5 w-5" style={{ color: 'var(--color-med-cyan)' }} />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight" style={{ color: 'var(--color-ink-100)' }}>
                Aegis-CSI
              </div>
              <div className="text-[11px]" style={{ color: 'var(--color-ink-500)' }}>
                Ambient Sensing Command Platform
              </div>
            </div>
          </div>

          <div className="rounded-xl p-6" style={{ background: 'var(--color-bg-panel)', border: '1px solid var(--color-hairline)' }}>
            {step === 'credentials' ? (
              <form onSubmit={submitCredentials} className="space-y-4">
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: 'var(--color-ink-300)' }}>
                    Hospital Employee ID
                  </label>
                  <input
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    disabled={locked}
                    placeholder="e.g. EMP-40213"
                    className="w-full rounded-md px-3 py-2 text-sm font-data outline-none disabled:opacity-50"
                    style={{ background: 'var(--color-bg-inset)', border: '1px solid var(--color-hairline-strong)', color: 'var(--color-ink-100)' }}
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: 'var(--color-ink-300)' }}>
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={locked}
                    placeholder="••••••••"
                    className="w-full rounded-md px-3 py-2 text-sm outline-none disabled:opacity-50"
                    style={{ background: 'var(--color-bg-inset)', border: '1px solid var(--color-hairline-strong)', color: 'var(--color-ink-100)' }}
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: 'var(--color-ink-300)' }}>
                    Role
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as Role)}
                    className="w-full rounded-md px-3 py-2 text-sm outline-none"
                    style={{ background: 'var(--color-bg-inset)', border: '1px solid var(--color-hairline-strong)', color: 'var(--color-ink-100)' }}
                  >
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                {error && (
                  <div className="text-xs rounded-md px-3 py-2" style={{ background: 'rgba(225,29,72,0.12)', color: '#fca5a5', border: '1px solid rgba(225,29,72,0.35)' }}>
                    {error}
                  </div>
                )}
                {failCount > 0 && !locked && (
                  <div className="text-[11px]" style={{ color: 'var(--color-ink-500)' }}>
                    Attempt {failCount} of 5 before lockout.
                  </div>
                )}

                <button
                  type="submit"
                  disabled={locked}
                  className="w-full rounded-md py-2.5 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                  style={{ background: 'var(--color-med-cyan)', color: '#04222b' }}
                >
                  <Lock className="h-3.5 w-3.5" />
                  Continue to verification
                </button>
              </form>
            ) : (
              <MFAModal onVerified={completeMfa} employeeId={employeeId} inline />
            )}
          </div>

          <div className="mt-5 flex items-center gap-2 justify-center text-[11px]" style={{ color: 'var(--color-ink-700)' }}>
            <ShieldCheck className="h-3.5 w-3.5" />
            Zero-camera facility · Wi-Fi CSI telemetry only · Session hash-chained &amp; audited
          </div>
        </div>
      </div>
    </div>
  );
}
