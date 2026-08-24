import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceDot } from 'recharts';
import type { Room, RoomReading } from '../../types';
import { ACTIVITY_COLOR_VAR, ACTIVITY_LABEL, formatClock } from '../../lib/utils';
import { ActivityBadge } from '../ui/ActivityBadge';

export function ActivityTimeline({ room }: { room: Room }) {
  const [selected, setSelected] = useState<RoomReading | null>(null);
  const data = room.history.map((h, i) => ({ i, confidence: h.confidence, activity: h.activity, timestamp: h.timestamp }));
  const active = selected ?? room.current;

  return (
    <div className="rounded-lg p-4" style={{ background: 'var(--color-bg-panel)', border: '1px solid var(--color-hairline)' }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium" style={{ color: 'var(--color-ink-100)' }}>
          Activity history
        </h3>
        <span className="text-[10px] font-data" style={{ color: 'var(--color-ink-700)' }}>
          click a point to scrub
        </span>
      </div>

      <div style={{ height: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} onClick={(e: any) => {
            const idx = e?.activeTooltipIndex;
            if (typeof idx === 'number' && data[idx]) setSelected(room.history[idx]);
          }}>
            <CartesianGrid stroke="var(--color-hairline)" vertical={false} />
            <XAxis dataKey="i" hide />
            <YAxis domain={[0, 100]} width={28} tick={{ fontSize: 10, fill: 'var(--color-ink-700)' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: 'var(--color-bg-panel-raised)', border: '1px solid var(--color-hairline-strong)', borderRadius: 8, fontSize: 11 }}
              labelFormatter={() => ''}
              formatter={(value: any, _name, p: any) => [`${value}%`, ACTIVITY_LABEL[p.payload.activity]]}
            />
            <Line type="monotone" dataKey="confidence" stroke="var(--color-med-cyan)" strokeWidth={1.75} dot={{ r: 2.5 }} activeDot={{ r: 5 }} isAnimationActive={false} />
            {data.map((d, i) =>
              d.activity === 'possible_fall' || d.activity === 'confirmed_fall' ? (
                <ReferenceDot key={i} x={d.i} y={d.confidence} r={5} fill={ACTIVITY_COLOR_VAR[d.activity]} stroke="none" />
              ) : null,
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid var(--color-hairline)' }}>
        <div className="flex items-center gap-2">
          <ActivityBadge activity={active.activity} size="sm" />
          <span className="font-data text-xs" style={{ color: 'var(--color-ink-500)' }}>
            {formatClock(active.timestamp)}
          </span>
        </div>
        <span className="font-data text-xs" style={{ color: 'var(--color-ink-300)' }}>
          {active.confidence}% confidence
        </span>
        {selected && (
          <button onClick={() => setSelected(null)} className="text-[10px] underline" style={{ color: 'var(--color-ink-700)' }}>
            back to live
          </button>
        )}
      </div>
    </div>
  );
}
