import { useState } from 'react';
import { useStore } from '../../store/useStore';
import { Bot, Send, X, FileText, Radio } from 'lucide-react';
import { formatClock } from '../../lib/utils';
import type { AssistantMessage, AssistantSource } from '../../types';

const SOPS = [
  { id: 'SOP-204', title: 'Unverified fall triage protocol — Geriatrics', body: 'Dispatch nearest available nurse within 90 seconds; do not move patient until vitals are assessed; escalate to RRT if unresponsive after 2 minutes.' },
  { id: 'SOP-118', title: 'Break-glass access review', body: 'Security reviews all break-glass activations within 24 hours and confirms rationale against the incident record.' },
  { id: 'SOP-071', title: 'Sensor offline response', body: 'Offline CSI nodes trigger a technician work order within 15 minutes; ward reverts to manual rounding cadence until restored.' },
];

function seedGreeting(): AssistantMessage {
  return {
    id: 'seed',
    role: 'assistant',
    text: 'I can summarize recent room events or look up an approved hospital SOP. This is a read-only assistant — I cannot change monitoring settings or patient records.',
    timestamp: new Date().toISOString(),
  };
}

export function AssistantDrawer() {
  const open = useStore((s) => s.assistantOpen);
  const toggle = useStore((s) => s.toggleAssistant);
  const rooms = useStore((s) => s.rooms);
  const alerts = useStore((s) => s.alerts);
  const [messages, setMessages] = useState<AssistantMessage[]>([seedGreeting()]);
  const [input, setInput] = useState('');

  function respond(query: string): { text: string; sources: AssistantSource[] } {
    const q = query.toLowerCase();

    const sop = SOPS.find(() => q.includes('protocol') || q.includes('sop') || q.includes('triage'));
    if (sop) {
      return { text: sop.body, sources: [{ label: sop.title, type: 'sop', refId: sop.id }] };
    }

    const wardMatch = rooms.find((r) => q.includes(r.code.toLowerCase()));
    const recentFalls = alerts.filter((a) => (wardMatch ? a.roomId === wardMatch.id : true));

    if (q.includes('fall')) {
      if (recentFalls.length === 0) {
        return { text: 'No fall events are recorded in the current session for that scope.', sources: [] };
      }
      const summary = recentFalls
        .slice(0, 5)
        .map((a) => `${a.roomCode} — ${a.stage} (${a.confidence}% confidence, logged ${formatClock(a.createdAt)})`)
        .join('; ');
      return {
        text: `Found ${recentFalls.length} fall event(s) this session: ${summary}.`,
        sources: recentFalls.slice(0, 5).map((a) => ({ label: `Event ${a.id}`, type: 'event', refId: a.id })),
      };
    }

    if (wardMatch) {
      return {
        text: `${wardMatch.code} (${wardMatch.ward}) is currently classified as "${wardMatch.current.activity.replace('_', ' ')}" at ${wardMatch.current.confidence}% confidence, last updated ${formatClock(wardMatch.lastUpdated)}.`,
        sources: [{ label: `${wardMatch.code} telemetry`, type: 'event', refId: wardMatch.id }],
      };
    }

    return {
      text: 'Try asking about a specific room code, recent fall events, or a clinical protocol — for example, "summarize fall events in the last 2 hours" or "triage protocol for an unverified fall".',
      sources: [],
    };
  }

  function send() {
    const text = input.trim();
    if (!text) return;
    const userMsg: AssistantMessage = { id: `m-${Date.now()}`, role: 'user', text, timestamp: new Date().toISOString() };
    const { text: replyText, sources } = respond(text);
    const reply: AssistantMessage = { id: `m-${Date.now() + 1}`, role: 'assistant', text: replyText, sources, timestamp: new Date().toISOString() };
    setMessages((m) => [...m, userMsg, reply]);
    setInput('');
  }

  if (!open) return null;

  return (
    <div
      className="fixed top-0 right-0 h-full w-full sm:w-96 z-50 flex flex-col"
      style={{ background: 'var(--color-bg-panel)', borderLeft: '1px solid var(--color-hairline)' }}
    >
      <div className="flex items-center justify-between px-4 h-14" style={{ borderBottom: '1px solid var(--color-hairline)' }}>
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4" style={{ color: 'var(--color-med-cyan)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--color-ink-100)' }}>
            Hospital Monitoring Assistant
          </span>
        </div>
        <button onClick={toggle} style={{ color: 'var(--color-ink-500)' }}>
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((m) => (
          <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div
              className="max-w-[85%] rounded-lg px-3 py-2 text-xs"
              style={{
                background: m.role === 'user' ? 'var(--color-med-cyan)' : 'var(--color-bg-inset)',
                color: m.role === 'user' ? '#04222b' : 'var(--color-ink-300)',
                border: m.role === 'assistant' ? '1px solid var(--color-hairline)' : 'none',
              }}
            >
              <p>{m.text}</p>
              {m.sources && m.sources.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {m.sources.map((src) => (
                    <span
                      key={src.refId}
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]"
                      style={{ background: 'var(--color-bg-panel-raised)', color: 'var(--color-ink-500)', border: '1px solid var(--color-hairline-strong)' }}
                    >
                      {src.type === 'sop' ? <FileText className="h-2.5 w-2.5" /> : <Radio className="h-2.5 w-2.5" />}
                      {src.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="px-3 py-3" style={{ borderTop: '1px solid var(--color-hairline)' }}>
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="Ask about events or SOPs…"
            className="flex-1 rounded-md px-3 py-2 text-xs outline-none"
            style={{ background: 'var(--color-bg-inset)', border: '1px solid var(--color-hairline-strong)', color: 'var(--color-ink-100)' }}
          />
          <button onClick={send} className="rounded-md p-2" style={{ background: 'var(--color-med-cyan)', color: '#04222b' }}>
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="text-[9px] mt-2 leading-relaxed" style={{ color: 'var(--color-ink-700)' }}>
          Informational summary generated from audit logs. Verify directly with bedside staff. Read-only — cannot modify
          monitoring settings or patient records.
        </p>
      </div>
    </div>
  );
}
