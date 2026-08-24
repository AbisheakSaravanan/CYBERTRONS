import { useStore } from '../../store/useStore';
import { ALL_WARDS } from '../../lib/mockEngine';
import { cn } from '../../lib/utils';

export function WardFilter() {
  const wardFilter = useStore((s) => s.wardFilter);
  const setWardFilter = useStore((s) => s.setWardFilter);

  const options: ('All' | (typeof ALL_WARDS)[number])[] = ['All', ...ALL_WARDS];

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((w) => {
        const active = wardFilter === w;
        return (
          <button
            key={w}
            onClick={() => setWardFilter(w)}
            className={cn('rounded-full px-3 py-1.5 text-xs font-medium transition-colors')}
            style={{
              background: active ? 'var(--color-med-cyan)' : 'var(--color-bg-panel)',
              color: active ? '#04222b' : 'var(--color-ink-300)',
              border: `1px solid ${active ? 'var(--color-med-cyan)' : 'var(--color-hairline-strong)'}`,
            }}
          >
            {w}
          </button>
        );
      })}
    </div>
  );
}
