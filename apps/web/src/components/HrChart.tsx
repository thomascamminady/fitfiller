import { useEffect, useRef, useState } from 'react';
import type { Lap, PauseSegment, TrackPoint } from '../types';
import { STATUS_META, type PauseStatus } from '../pauseStatus';

interface Props {
  points: TrackPoint[];
  pauses: PauseSegment[];
  pauseStatuses: Record<string, PauseStatus>;
  laps: Lap[];
  activePauseId: string | null;
  /** Filled records per pause id (from previews), drawn over the gaps. */
  filledByPause: Record<string, TrackPoint[]>;
}

const PAD = { l: 40, r: 12, t: 10, b: 18 };
const PANEL_H = 76;
const PANEL_GAP = 14;

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

interface SeriesDef {
  key: 'hr' | 'ele';
  label: string;
  value: (p: TrackPoint) => number | null;
  area: boolean;
}

const SERIES: SeriesDef[] = [
  { key: 'hr', label: 'Heart rate', value: (p) => p.heartRate, area: false },
  { key: 'ele', label: 'Elevation', value: (p) => p.altitude, area: true },
];

export function HrChart({
  points,
  pauses,
  pauseStatuses,
  laps,
  activePauseId,
  filledByPause,
}: Props) {
  const [ref, w] = useWidth();

  const filledRecords = Object.values(filledByPause).flat();
  const tStart = points[0]?.time ?? 0;
  const tEnd = points[points.length - 1]?.time ?? tStart + 1;
  const totalSec = Math.max(1, (tEnd - tStart) / 1000);

  const plotW = Math.max(1, w - PAD.l - PAD.r);
  const x = (t: number) => PAD.l + (((t - tStart) / 1000) / totalSec) * plotW;

  // Only show a panel for a metric the file actually carries.
  const panels = SERIES.map((s) => {
    const recorded = points.filter((p) => s.value(p) !== null);
    if (recorded.length < 2) return null;
    const vals = [...recorded, ...filledRecords]
      .map((p) => s.value(p))
      .filter((v): v is number => v !== null);
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const span = Math.max(1, hi - lo);
    const pad = span * 0.12;
    return { def: s, lo: lo - pad, hi: hi + pad };
  }).filter((p): p is NonNullable<typeof p> => p !== null);

  const H =
    PAD.t + panels.length * PANEL_H + Math.max(0, panels.length - 1) * PANEL_GAP + PAD.b;
  const bandTop = PAD.t;
  const bandH = Math.max(1, H - PAD.t - PAD.b);

  const panelTop = (i: number) => PAD.t + i * (PANEL_H + PANEL_GAP);
  const yScale = (lo: number, hi: number, top: number) => (v: number) =>
    top + (1 - (v - lo) / Math.max(1, hi - lo)) * PANEL_H;

  // A path that lifts the pen across pauses / missing readings so gaps show.
  const linePath = (
    pts: TrackPoint[],
    valueOf: (p: TrackPoint) => number | null,
    yOf: (v: number) => number,
    breakSec = 6,
  ): string => {
    let d = '';
    let pen = false;
    let prevT: number | null = null;
    for (const p of pts) {
      const v = valueOf(p);
      if (v === null) {
        pen = false;
        continue;
      }
      const jump = prevT !== null && (p.time - prevT) / 1000 > breakSec;
      d += `${!pen || jump ? 'M' : 'L'}${x(p.time).toFixed(1)} ${yOf(v).toFixed(1)} `;
      pen = true;
      prevT = p.time;
    }
    return d.trim();
  };

  const areaPath = (
    pts: TrackPoint[],
    valueOf: (p: TrackPoint) => number | null,
    yOf: (v: number) => number,
    baseline: number,
  ): string => {
    const valid = pts.filter((p) => valueOf(p) !== null);
    if (valid.length < 2) return '';
    const first = x(valid[0]!.time);
    const last = x(valid[valid.length - 1]!.time);
    let d = `M${first.toFixed(1)} ${baseline.toFixed(1)} `;
    for (const p of valid) d += `L${x(p.time).toFixed(1)} ${yOf(valueOf(p)!).toFixed(1)} `;
    d += `L${last.toFixed(1)} ${baseline.toFixed(1)} Z`;
    return d;
  };

  const heading = panels.map((p) => p.def.label).join(' & ') || 'Timeline';

  return (
    <div className="hr-chart" ref={ref}>
      <div className="hr-chart-head">
        <span className="eyebrow">{heading} · elapsed time</span>
        <span className="hr-legend">
          <i className="dot trace" /> recorded
          <i className="dot fill" /> filled
        </span>
      </div>
      {panels.length === 0 ? (
        <p className="notice" style={{ padding: '8px 0' }}>
          No heart-rate or elevation data in this activity.
        </p>
      ) : (
        <svg width={w} height={H} role="img" aria-label="Heart rate and elevation over time">
          {/* status-coloured pause bands, spanning every panel so gaps align */}
          {pauses.map((p) => {
            const x0 = x(p.stopTime);
            const x1 = x(p.startTime);
            const status = pauseStatuses[p.id] ?? 'break';
            return (
              <rect
                key={p.id}
                x={x0}
                y={bandTop}
                width={Math.max(1.5, x1 - x0)}
                height={bandH}
                className={`hr-band tone-${status} ${p.id === activePauseId ? 'active' : ''}`}
                fill={STATUS_META[status].color}
              />
            );
          })}

          {/* lap boundaries across the whole chart */}
          {laps
            .map((l) => l.startTime)
            .filter((t): t is number => t !== null && t > tStart)
            .map((t) => (
              <line key={t} x1={x(t)} y1={bandTop} x2={x(t)} y2={bandTop + bandH} className="hr-lap" />
            ))}

          {panels.map((panel, i) => {
            const top = panelTop(i);
            const yOf = yScale(panel.lo, panel.hi, top);
            const valueOf = panel.def.value;
            const baseline = top + PANEL_H;
            const recorded = points.filter((p) => valueOf(p) !== null);
            return (
              <g key={panel.def.key}>
                {/* gridlines + y labels */}
                {[panel.hi, (panel.lo + panel.hi) / 2, panel.lo].map((v) => (
                  <g key={v}>
                    <line x1={PAD.l} y1={yOf(v)} x2={w - PAD.r} y2={yOf(v)} className="hr-grid" />
                    <text x={PAD.l - 6} y={yOf(v) + 3} className="hr-axis" textAnchor="end">
                      {Math.round(v)}
                    </text>
                  </g>
                ))}
                {/* panel label */}
                <text x={PAD.l} y={top - 2} className="hr-panel-label">
                  {panel.def.label.toUpperCase()}
                </text>

                {/* ambient area (elevation), then filled overlays, then recorded */}
                {panel.def.area && (
                  <path d={areaPath(recorded, valueOf, yOf, baseline)} className="hr-area" />
                )}
                {Object.entries(filledByPause).map(([id, recs]) => (
                  <path key={id} d={linePath(recs, valueOf, yOf, 999)} className="hr-line fill" />
                ))}
                <path d={linePath(recorded, valueOf, yOf)} className="hr-line trace" />
              </g>
            );
          })}

          {/* shared x ticks */}
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <text
              key={f}
              x={PAD.l + f * plotW}
              y={H - 5}
              className="hr-axis"
              textAnchor={f === 0 ? 'start' : f === 1 ? 'end' : 'middle'}
            >
              {mmss(totalSec * f)}
            </text>
          ))}
        </svg>
      )}
    </div>
  );
}
