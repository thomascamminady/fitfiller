import type { ExportSummary } from '../types';
import { fmtDistance, fmtDuration } from '../format';
import { useDismissable } from '../hooks/useDismissable';

interface Props {
  summary: ExportSummary;
  onConfirm: () => void;
  onClose: () => void;
  busy: boolean;
}

function Row({
  label,
  before,
  after,
}: {
  label: string;
  before: string;
  after: string;
}) {
  return (
    <tr>
      <th>{label}</th>
      <td className="mono">{before}</td>
      <td className="arrow">→</td>
      <td className="mono">{after}</td>
    </tr>
  );
}

export function ExportReview({ summary, onConfirm, onClose, busy }: Props) {
  const { original, filled, delta, ok } = summary;
  const ref = useDismissable<HTMLDivElement>(onClose);
  return (
    <div className="overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className="modal review-modal"
        ref={ref}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="legal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <p className="eyebrow">Before you download</p>
        <h2>Review the changes</h2>

        <div className={`integrity ${ok ? 'ok' : 'bad'}`}>
          {ok
            ? '✓ Verified — the rebuilt file decodes cleanly and isn’t corrupted.'
            : '✕ The rebuilt file failed to decode. Don’t upload it; please report this.'}
        </div>

        <table className="diff-table">
          <thead>
            <tr>
              <th></th>
              <th>Original</th>
              <th></th>
              <th>Rebuilt</th>
            </tr>
          </thead>
          <tbody>
            <Row
              label="Distance"
              before={fmtDistance(original.distanceMeters)}
              after={fmtDistance(filled.distanceMeters)}
            />
            <Row
              label="Moving time"
              before={fmtDuration(original.durationSeconds)}
              after={fmtDuration(filled.durationSeconds)}
            />
            <Row
              label="GPS points"
              before={String(original.points)}
              after={String(filled.points)}
            />
            <Row
              label="Open gaps"
              before={String(original.pauses)}
              after={String(filled.pauses)}
            />
          </tbody>
        </table>

        <p className="review-note">
          {delta.pausesRemoved > 0
            ? `Filling ${delta.pausesRemoved} gap${delta.pausesRemoved > 1 ? 's' : ''} adds `
            : 'Adds '}
          <strong>{fmtDistance(delta.distanceMeters)}</strong> and{' '}
          <strong>{fmtDuration(delta.durationSeconds)}</strong> of movement.
        </p>

        <div className="review-actions">
          <button className="btn btn-ghost" onClick={onClose}>
            Keep editing
          </button>
          <button
            className="btn btn-primary"
            onClick={onConfirm}
            disabled={busy || !ok}
          >
            {busy ? 'Preparing…' : 'Download .fit'}
          </button>
        </div>
      </div>
    </div>
  );
}
