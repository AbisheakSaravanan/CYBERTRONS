import type { ActivityClass } from '../../types';
import { ACTIVITY_LABEL } from '../../lib/utils';
import { cn } from '../../lib/utils';

export function ActivityBadge({ activity, size = 'md' }: { activity: ActivityClass; size?: 'sm' | 'md' | 'lg' }) {
  const urgent = activity === 'confirmed_fall';
  const warn = activity === 'possible_fall';
  const colorClass =
    {
      no_movement: 'bg-slate-500/15 text-slate-300 ring-slate-500/30',
      sitting: 'bg-blue-500/15 text-blue-300 ring-blue-500/30',
      standing: 'bg-indigo-500/15 text-indigo-300 ring-indigo-500/30',
      walking: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
      lying: 'bg-teal-500/15 text-teal-300 ring-teal-500/30',
      possible_fall: 'bg-amber-500/15 text-amber-300 ring-amber-500/40',
      confirmed_fall: 'bg-rose-600/20 text-rose-300 ring-rose-500/50',
    }[activity] ?? 'bg-slate-500/15 text-slate-300 ring-slate-500/30';

  const sizeClass = size === 'sm' ? 'text-[11px] px-2 py-0.5' : size === 'lg' ? 'text-sm px-3.5 py-1.5' : 'text-xs px-2.5 py-1';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium ring-1 whitespace-nowrap',
        colorClass,
        sizeClass,
        warn && 'animate-pulse-ring',
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', urgent ? 'bg-rose-400' : warn ? 'bg-amber-400' : 'bg-current opacity-70')} />
      {ACTIVITY_LABEL[activity]}
    </span>
  );
}
