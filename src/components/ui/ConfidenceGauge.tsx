export function ConfidenceGauge({ value, size = 88, colorVar = 'var(--color-med-cyan)' }: { value: number; size?: number; colorVar?: string }) {
  const stroke = 7;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - value / 100);
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--color-hairline-strong)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colorVar}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-data text-lg font-semibold text-ink-100" style={{ color: 'var(--color-ink-100)' }}>
          {value}%
        </span>
        <span className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--color-ink-500)' }}>
          confidence
        </span>
      </div>
    </div>
  );
}
