import { useEffect, useRef, useState } from 'react';
import type { Lap, PauseSegment, TrackPoint } from '../types';

interface Props {
  points: TrackPoint[];
  pauses: PauseSegment[];
  laps: Lap[];
  activePauseId: string | null;
  /** Filled records per pause id (from previews), drawn over the gaps. */
  filledByPause: Record<string, TrackPoint[]>;
}

const H = 150;
const PAD = { l: 36, r: 10, t: 12, b: 20 };

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(800);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((e) => setW(e[0]!.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

const mmss = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

export function HrChart({
  points,
  pauses,
  laps,
  activePauseId,
  filledByPause,
}: Props) {
  const [ref, w] = useWidth();

  const withHr = points.filter((p) => p.heartRate !== null);
  const tStart = points[0]?.time ?? 0;
  const tEnd = points[points.length - 1]?.time ?? tStart + 1;
  const totalSec = Math.max(1, (tEnd - tStart) / 1000);

  const filledRecords = Object.values(filledByPause).flat();
  const hrs = [...withHr, ...filledRecords]
    .map((p) => p.heartRate!)
    .filter((v) => v !== null);
  const hrMin = hrs.length ? Math.min(...hrs) - 5 : 60;
  const hrMax = hrs.length ? Math.max(...hrs) + 5 : 200;

  const plotW = Math.max(1, w - PAD.l - PAD.r);
  const plotH = H - PAD.t - PAD.b;
  const x = (t: number) => PAD.l + (((t - tStart) / 1000) / totalSec) * plotW;
  const y = (hr: number) =>
    PAD.t + (1 - (hr - hrMin) / Math.max(1, hrMax - hrMin)) * plotH;

  // Build a path, breaking the line wherever there's a time gap (a pause) or a
  // missing reading — so the gaps are literally visible.
  const path = (pts: TrackPoint[], breakSec = 6): string => {
    let d = '';
    let pen = false;
    let prevT: number | null = null;
    for (const p of pts) {
      if (p.heartRate === null) {
        pen = false;
        continue;
      }
      const jump = prevT !== null && (p.time - prevT) / 1000 > breakSec;
      d += `${!pen || jump ? 'M' : 'L'}${x(p.time).toFixed(1)} ${y(p.heartRate).toFixed(1)} `;
      pen = true;
      prevT = p.time;
    }
    return d.trim();
  };

  const hasData = withHr.length > 1;

  return (
    <div className="hr-chart" ref={ref}>
      <div className="hr-chart-head">
        <span className="eyebrow">Heart rate · elapsed time</span>
        <span className="hr-legend">
          <i className="dot trace" /> recorded
          <i className="dot fill" /> filled
        </span>
      </div>
      {!hasData ? (
        <p className="notice" style={{ padding: '8px 0' }}>
          No heart-rate data in this activity.
        </p>
      ) : (
        <svg width={w} height={H} role="img" aria-label="Heart rate over time">
          {/* y gridlines + labels */}
          {[hrMax - 5, (hrMin + hrMax) / 2, hrMin + 5].map((v) => (
            <g key={v}>
              <line x1={PAD.l} y1={y(v)} x2={w - PAD.r} y2={y(v)} className="hr-grid" />
              <text x={PAD.l - 6} y={y(v) + 3} className="hr-axis" textAnchor="end">
                {Math.round(v)}
              </text>
            </g>
          ))}

          {/* pause bands */}
          {pauses.map((p) => {
            const x0 = x(p.stopTime);
            const x1 = x(p.startTime);
            return (
              <rect
                key={p.id}
                x={x0}
                y={PAD.t}
                width={Math.max(1.5, x1 - x0)}
                height={plotH}
                className={`hr-band ${p.id === activePauseId ? 'active' : ''}`}
              />
            );
          })}

          {/* lap boundaries */}
          {laps
            .map((l) => l.startTime)
            .filter((t): t is number => t !== null && t > tStart)
            .map((t) => (
              <line
                key={t}
                x1={x(t)}
                y1={PAD.t}
                x2={x(t)}
                y2={PAD.t + plotH}
                className="hr-lap"
              />
            ))}

          {/* x ticks */}
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <text
              key={f}
              x={PAD.l + f * plotW}
              y={H - 6}
              className="hr-axis"
              textAnchor={f === 0 ? 'start' : f === 1 ? 'end' : 'middle'}
            >
              {mmss(totalSec * f)}
            </text>
          ))}

          {/* filled overlays (green), then recorded (black) on top */}
          {Object.entries(filledByPause).map(([id, recs]) => (
            <path key={id} d={path(recs, 999)} className="hr-line fill" />
          ))}
          <path d={path(withHr)} className="hr-line trace" />
        </svg>
      )}
    </div>
  );
}
