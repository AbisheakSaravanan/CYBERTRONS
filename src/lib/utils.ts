export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour12: false });
}

export function formatClock(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

export function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diffMs / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

export function countdown(iso: string | null): string {
  if (!iso) return '';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return '0:00';
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export const ACTIVITY_LABEL: Record<string, string> = {
  no_movement: 'No Movement',
  sitting: 'Sitting',
  standing: 'Standing',
  walking: 'Walking',
  lying: 'Lying',
  possible_fall: 'Possible Fall',
  confirmed_fall: 'Confirmed Fall',
};

export const ACTIVITY_COLOR_VAR: Record<string, string> = {
  no_movement: 'var(--color-act-none)',
  sitting: 'var(--color-act-sitting)',
  standing: 'var(--color-act-standing)',
  walking: 'var(--color-act-walking)',
  lying: 'var(--color-act-lying)',
  possible_fall: 'var(--color-act-possible)',
  confirmed_fall: 'var(--color-act-confirmed)',
};
