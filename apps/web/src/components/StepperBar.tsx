import type { PauseSegment } from '../types';
import type { PauseStatus } from '../pauseStatus';

interface Props {
  pauses: PauseSegment[];
  statuses: Record<string, PauseStatus>;
  activeIndex: number;
  onSelect: (i: number) => void;
}

/**
 * The big, centred pause navigator that floats over the map: a "Pause X of Y"
 * readout and the status-coloured segment bar. Hidden in the overview state
 * (activeIndex < 0), where the whole file is shown instead.
 */
export function StepperBar({ pauses, statuses, activeIndex, onSelect }: Props) {
  const total = pauses.length;
  if (total === 0 || activeIndex < 0) return null;

  return (
    <div className="stepper-bar" role="group" aria-label="Pause navigation">
      <button
        className="step-arrow"
        aria-label="Previous pause"
        onClick={() => onSelect(activeIndex - 1)}
      >
        ‹
      </button>

      <div className="step-body">
        <div className="step-count">
          Pause <span className="step-n">{activeIndex + 1}</span>
          <span className="step-of"> of {total}</span>
        </div>
        <div className="step-ribbon" role="tablist" aria-label="Pauses">
          {pauses.map((p, i) => (
            <button
              key={p.id}
              role="tab"
              aria-selected={i === activeIndex}
              aria-label={`Pause ${i + 1} — ${statuses[p.id] ?? 'break'}`}
              title={`Pause ${i + 1}`}
              className={`step-node status-${statuses[p.id] ?? 'break'} ${
                i === activeIndex ? 'active' : ''
              }`}
              onClick={() => onSelect(i)}
            />
          ))}
        </div>
      </div>

      <button
        className="step-arrow"
        aria-label="Next pause"
        disabled={activeIndex >= total - 1}
        onClick={() => onSelect(activeIndex + 1)}
      >
        ›
      </button>
    </div>
  );
}
