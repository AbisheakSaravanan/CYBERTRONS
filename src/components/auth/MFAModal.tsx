import { useRef, useState } from 'react';
import { KeyRound } from 'lucide-react';

export function MFAModal({
  employeeId,
  onVerified,
  inline = false,
}: {
  employeeId: string;
  onVerified: (displayName: string) => void;
  inline?: boolean;
}) {
  const [digits, setDigits] = useState(Array(6).fill(''));
  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState('');
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  function setDigit(i: number, val: string) {
    if (!/^[0-9]?$/.test(val)) return;
    const next = [...digits];
    next[i] = val;
    setDigits(next);
    if (val && i < 5) refs.current[i + 1]?.focus();
  }

  function submit() {
    if (locked) return;
    const code = digits.join('');
    if (code.length < 6) {
      setError('Enter the full 6-digit code from your authenticator.');
      return;
    }
    // Simulated verification: any fully-entered code that isn't "000000" succeeds.
    if (code === '000000') {
      const next = attempts + 1;
      setAttempts(next);
      setError('Invalid TOTP code.');
      setDigits(Array(6).fill(''));
      refs.current[0]?.focus();
      if (next >= 3) {
        setLocked(true);
        setError('Too many invalid codes. Locked for 30s.');
        window.setTimeout(() => {
          setLocked(false);
          setAttempts(0);
          setError('');
        }, 30000);
      }
      return;
    }
    const name = `Dr. ${employeeId.replace(/[^A-Za-z0-9]/g, '').slice(-4) || 'Staff'}`;
    onVerified(name);
  }

  return (
    <div className={inline ? '' : 'fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4'}>
      <div className={inline ? '' : 'w-full max-w-sm rounded-xl p-6'} style={inline ? {} : { background: 'var(--color-bg-panel)', border: '1px solid var(--color-hairline)' }}>
        <div className="flex items-center gap-2 mb-1">
          <KeyRound className="h-4 w-4" style={{ color: 'var(--color-med-cyan)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--color-ink-100)' }}>
            Two-factor verification
          </span>
        </div>
        <p className="text-xs mb-4" style={{ color: 'var(--color-ink-500)' }}>
          Enter the 6-digit code from your authenticator app for {employeeId || 'your account'}.
        </p>
        <div className="flex gap-2 mb-3">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { refs.current[i] = el; }}
              value={d}
              disabled={locked}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus();
                if (e.key === 'Enter') submit();
              }}
              inputMode="numeric"
              maxLength={1}
              className="w-10 h-12 text-center text-lg font-data rounded-md outline-none disabled:opacity-40"
              style={{ background: 'var(--color-bg-inset)', border: '1px solid var(--color-hairline-strong)', color: 'var(--color-ink-100)' }}
            />
          ))}
        </div>
        {error && (
          <div className="text-xs rounded-md px-3 py-2 mb-3" style={{ background: 'rgba(225,29,72,0.12)', color: '#fca5a5', border: '1px solid rgba(225,29,72,0.35)' }}>
            {error}
          </div>
        )}
        <button
          onClick={submit}
          disabled={locked}
          className="w-full rounded-md py-2.5 text-sm font-medium disabled:opacity-50"
          style={{ background: 'var(--color-med-cyan)', color: '#04222b' }}
        >
          Verify &amp; sign in
        </button>
        <p className="text-[10px] mt-3 text-center" style={{ color: 'var(--color-ink-700)' }}>
          Demo build: any code other than 000000 verifies.
        </p>
      </div>
    </div>
  );
}
