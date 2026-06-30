import type { FillMode, GapFill, PauseSegment, ParsedActivity } from '../types';
import { fmtDistance, fmtDuration, fmtPace, fmtSport } from '../format';
import { pauseStatus, pauseHasGps, type PauseStatus } from '../pauseStatus';

export interface PauseFillState {
  enabled: boolean;
  waypoints: { lat: number; lon: number }[];
  actualBreakSeconds: number;
  heartRate: FillMode;
  heartRateValue: number;
  cadence: FillMode;
  cadenceValue: number;
  elevation: 'linear' | 'route';
  gradeAdjust: boolean;
  snapToPath: boolean;
  preview: GapFill | null;
  previewError: string | null;
}

interface Props {
  activity: ParsedActivity;
  filename: string;
  activeIndex: number;
  setActiveIndex: (i: number) => void;
  fills: Record<string, PauseFillState>;
  updateFill: (pauseId: string, patch: Partial<PauseFillState>) => void;
  drawing: boolean;
  setDrawing: (b: boolean) => void;
  onUndoWaypoint: (pauseId: string) => void;
  onClearWaypoints: (pauseId: string) => void;
  onPreview: (pauseId: string) => void;
  previewBusy: boolean;
  onExport: () => void;
  exportBusy: boolean;
}

function Switch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      className="switch"
      disabled={disabled}
      onClick={() => onChange(!checked)}
    />
  );
}

function FillControl({
  label,
  mode,
  value,
  unit,
  onMode,
  onValue,
}: {
  label: string;
  mode: FillMode;
  value: number;
  unit: string;
  onMode: (v: FillMode) => void;
  onValue: (v: number) => void;
}) {
  return (
    <div className="toggle-row fill-control">
      <span>{label}</span>
      <div className="fill-inputs">
        {mode === 'value' && (
          <input
            className="input"
            type="number"
            min={0}
            aria-label={`${label} ${unit}`}
            value={value}
            onChange={(e) => onValue(Math.max(0, Number(e.target.value)))}
          />
        )}
        <select
          className="select"
          value={mode}
          onChange={(e) => onMode(e.target.value as FillMode)}
        >
          <option value="none">Leave empty</option>
          <option value="average">Average</option>
          <option value="value">Set value</option>
        </select>
      </div>
    </div>
  );
}

export function PauseInspector(props: Props) {
  const {
    activity,
    activeIndex,
    setActiveIndex,
    fills,
    updateFill,
    drawing,
    setDrawing,
    onUndoWaypoint,
    onClearWaypoints,
    onPreview,
    previewBusy,
    onExport,
    exportBusy,
  } = props;

  const { summary, pauses } = activity;
  const pause: PauseSegment | undefined = pauses[activeIndex];
  const enabledCount = Object.values(fills).filter((f) => f.enabled).length;

  const statuses = pauses.map((p) =>
    pauseStatus(p, fills[p.id]?.enabled ?? false),
  );
  const issueCount = statuses.filter((s) => s === 'issue').length;
  const firstReviewIndex = Math.max(0, statuses.indexOf('issue'));
  const plural = (n: number) => (n === 1 ? '' : 's');

  return (
    <aside className="sidebar">
      <section className="sidebar-section">
        <p className="eyebrow">{fmtSport(summary.sport)}</p>
        <div className="summary-grid">
          <Stat
            label="Distance"
            value={fmtDistance(summary.totalDistanceMeters)}
          />
          <Stat
            label="Moving time"
            value={fmtDuration(summary.totalTimerSeconds)}
          />
          <Stat label="Laps" value={String(summary.lapCount)} />
          <Stat label="Pauses found" value={String(summary.pauseCount)} />
        </div>
      </section>

      {pauses.length === 0 ? (
        <section className="sidebar-section">
          <p className="notice">
            No paused segments detected — nothing to fill. Your watch ran clean.
          </p>
        </section>
      ) : activeIndex < 0 ? (
        /* Overview: the whole file is shown on the map; invite the review. */
        <section className="sidebar-section overview-panel">
          <p className="eyebrow">Review</p>
          <h3 className="overview-title">
            {issueCount > 0
              ? `${issueCount} gap${plural(issueCount)} to fix`
              : 'Nothing needs fixing'}
          </h3>
          <p className="notice">
            {pauses.length} pause{plural(pauses.length)} detected.{' '}
            {issueCount > 0
              ? `${issueCount} look${issueCount === 1 ? 's' : ''} like the watch missed real ground — the rest read as genuine breaks.`
              : 'They all look like genuine breaks.'}
          </p>
          <button
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => setActiveIndex(firstReviewIndex)}
          >
            {issueCount > 0 ? 'Review gaps' : 'Step through pauses'}
          </button>
          <p className="help-text" style={{ textAlign: 'center', margin: 0 }}>
            or pick a gap on the bar above the map
          </p>
        </section>
      ) : (
        <section className="sidebar-section">
          {pause && (
            <PauseCard
              pause={pause}
              state={fills[pause.id]!}
              update={(patch) => updateFill(pause.id, patch)}
              drawing={drawing}
              setDrawing={setDrawing}
              onUndo={() => onUndoWaypoint(pause.id)}
              onClear={() => onClearWaypoints(pause.id)}
              onPreview={() => onPreview(pause.id)}
              previewBusy={previewBusy}
            />
          )}
        </section>
      )}

      {pauses.length > 0 && (
        <div className="export-bar">
          <p className="summary-line">
            {enabledCount === 0
              ? 'Enable “Fill this gap” on the pauses you want to rebuild.'
              : `${enabledCount} gap${enabledCount > 1 ? 's' : ''} will be written into the new file.`}
          </p>
          <button
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
            disabled={enabledCount === 0 || exportBusy}
            onClick={onExport}
          >
            {exportBusy ? 'Building file…' : 'Export corrected .fit'}
          </button>
        </div>
      )}
    </aside>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}

function StatusBadge({
  status,
  meters,
}: {
  status: PauseStatus;
  meters: number;
}) {
  const text: Record<PauseStatus, string> = {
    break: 'Barely moved — likely a real break, probably nothing to fix',
    issue: `Moved ~${fmtDistance(meters)} while paused — the watch missed real ground`,
    fixed: 'Rebuilding this gap — it will be written into the new file',
    nogps: 'No GPS on one side — this gap can’t be traced on the map',
  };
  const icon: Record<PauseStatus, string> = {
    break: '✓',
    issue: '⚠',
    fixed: '✓',
    nogps: '—',
  };
  return (
    <span className={`status-badge tone-${status}`}>
      <span className="status-icon">{icon[status]}</span>
      {text[status]}
    </span>
  );
}

function PauseCard({
  pause,
  state,
  update,
  drawing,
  setDrawing,
  onUndo,
  onClear,
  onPreview,
  previewBusy,
}: {
  pause: PauseSegment;
  state: PauseFillState;
  update: (patch: Partial<PauseFillState>) => void;
  drawing: boolean;
  setDrawing: (b: boolean) => void;
  onUndo: () => void;
  onClear: () => void;
  onPreview: () => void;
  previewBusy: boolean;
}) {
  const hasGps = pauseHasGps(pause);
  const status: PauseStatus = pauseStatus(pause, state.enabled);

  const breakSec = Math.min(state.actualBreakSeconds, pause.pausedSeconds);
  const movingSeconds = Math.max(1, pause.pausedSeconds - breakSec);

  return (
    <div className="pause-card">
      <div className="pause-readout">
        <Stat label="Paused for" value={fmtDuration(pause.pausedSeconds)} />
        <Stat
          label="Distance apart"
          value={fmtDistance(pause.straightLineMeters)}
        />
      </div>
      <StatusBadge status={status} meters={pause.straightLineMeters} />

      {!hasGps ? (
        <p className="notice">
          This pause has no GPS fix on one side, so it can't be traced on the
          map. Skip it or fix it in a GPS editor.
        </p>
      ) : (
        <>
          <div className="toggle-row" style={{ borderTop: 'none' }}>
            <span>
              <strong>Fill this gap</strong>
            </span>
            <Switch
              checked={state.enabled}
              onChange={(v) => update({ enabled: v })}
            />
          </div>

          {state.enabled && (
            <>
              <div className="field" style={{ marginTop: 14 }}>
                <label>
                  Trace the route you ran{' '}
                  <span className="sub">
                    ({state.waypoints.length} point
                    {state.waypoints.length === 1 ? '' : 's'} added)
                  </span>
                </label>
                <p className="help-text">
                  {drawing
                    ? 'Click along the map from the blue point to the red point — one click per bend. Finish on the map when you’re done.'
                    : 'Optional. We connect the blue and red points with a straight line — only draw if you didn’t run straight.'}
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className={`btn btn-sm ${drawing ? 'btn-primary' : 'btn-route'}`}
                    onClick={() => setDrawing(!drawing)}
                  >
                    {drawing ? '✓ Finish drawing' : '✎ Draw your route'}
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={onUndo}
                    disabled={state.waypoints.length === 0}
                  >
                    Undo
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={onClear}
                    disabled={state.waypoints.length === 0}
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="toggle-row">
                <span>
                  Snap to path{' '}
                  <span className="sub">follow roads &amp; trails</span>
                </span>
                <Switch
                  checked={state.snapToPath}
                  onChange={(v) => update({ snapToPath: v })}
                />
              </div>

              <div className="field">
                <label>
                  Actual break{' '}
                  <span className="sub">seconds standing still</span>
                </label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={Math.floor(pause.pausedSeconds)}
                  value={state.actualBreakSeconds}
                  onChange={(e) =>
                    update({
                      actualBreakSeconds: Math.max(0, Number(e.target.value)),
                    })
                  }
                />
              </div>

              <FillControl
                label="Heart rate"
                unit="bpm"
                mode={state.heartRate}
                value={state.heartRateValue}
                onMode={(v) => update({ heartRate: v })}
                onValue={(v) => update({ heartRateValue: v })}
              />
              <FillControl
                label="Cadence"
                unit="rpm"
                mode={state.cadence}
                value={state.cadenceValue}
                onMode={(v) => update({ cadence: v })}
                onValue={(v) => update({ cadenceValue: v })}
              />

              <div className="toggle-row">
                <span>
                  Real elevation{' '}
                  <span className="sub">sample terrain along the route</span>
                </span>
                <Switch
                  checked={state.elevation === 'route'}
                  onChange={(v) =>
                    update({ elevation: v ? 'route' : 'linear' })
                  }
                />
              </div>
              <div className="toggle-row">
                <span>
                  Grade-adjusted pace{' '}
                  <span className="sub">vary speed by slope</span>
                </span>
                <Switch
                  checked={state.gradeAdjust}
                  onChange={(v) => update({ gradeAdjust: v })}
                />
              </div>

              <button
                className="btn btn-ghost btn-sm"
                style={{ marginTop: 14 }}
                onClick={onPreview}
                disabled={previewBusy}
              >
                {previewBusy ? 'Calculating…' : 'Preview filled segment'}
              </button>

              {state.previewError && (
                <div className="preview-result error">{state.previewError}</div>
              )}
              {state.preview && !state.previewError && (
                <div className="preview-result">
                  <div className="pause-readout" style={{ margin: 0 }}>
                    <Stat
                      label="Filled distance"
                      value={fmtDistance(state.preview.addedDistanceMeters)}
                    />
                    <Stat
                      label="Moving time"
                      value={fmtDuration(state.preview.movingSeconds)}
                    />
                    <Stat
                      label="Avg pace"
                      value={fmtPace(
                        state.preview.addedDistanceMeters /
                          state.preview.movingSeconds,
                      )}
                    />
                    <Stat
                      label="Added points"
                      value={String(state.preview.records.length)}
                    />
                  </div>
                </div>
              )}

              {!state.preview && (
                <p className="notice" style={{ marginTop: 10 }}>
                  Moving time {fmtDuration(movingSeconds)} · trace a route, then
                  preview to see pace.
                </p>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
