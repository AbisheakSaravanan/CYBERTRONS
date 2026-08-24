import { useEffect, useRef } from 'react';

/**
 * The one recurring signature motif: a quiet, continuously-drawn multi-subcarrier
 * amplitude trace. It is the visual reminder, on every screen, that the system
 * senses through RF disturbance rather than optics — never decorative for its
 * own sake, always literally plotting synthetic subcarrier amplitude.
 */
export function WaveformStrip({ height = 28, className = '' }: { height?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const frame = useRef<number>(0);
  const t = useRef(0);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    const resize = () => {
      width = canvas.clientWidth;
      canvas.width = width * devicePixelRatio;
      canvas.height = height * devicePixelRatio;
      ctx.scale(devicePixelRatio, devicePixelRatio);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = () => {
      t.current += 0.02;
      ctx.clearRect(0, 0, width, height);
      const lines = 3;
      const colors = ['rgba(34,211,238,0.55)', 'rgba(34,211,238,0.3)', 'rgba(34,211,238,0.16)'];
      for (let l = 0; l < lines; l++) {
        ctx.beginPath();
        ctx.strokeStyle = colors[l];
        ctx.lineWidth = 1.2;
        const amp = height / 2 - 3 - l * 1.5;
        const mid = height / 2;
        const freq = 0.06 + l * 0.015;
        const phase = t.current * (1.1 - l * 0.2) + l * 1.7;
        for (let x = 0; x <= width; x += 3) {
          const noise = Math.sin(x * 0.35 + t.current * 3 + l) * 0.15;
          const y = mid + Math.sin(x * freq + phase) * amp * (0.55 + 0.45 * Math.sin(x * 0.01 + t.current * 0.5)) + noise * amp * 0.3;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      frame.current = requestAnimationFrame(draw);
    };
    frame.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame.current);
      ro.disconnect();
    };
  }, [height]);

  return <canvas ref={ref} className={className} style={{ width: '100%', height }} aria-hidden="true" />;
}
