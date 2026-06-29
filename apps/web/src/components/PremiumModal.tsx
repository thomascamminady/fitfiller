import { useDismissable } from '../hooks/useDismissable';

interface Props {
  onSubscribe: () => void;
  onClose: () => void;
  busy: boolean;
}

export function PremiumModal({ onSubscribe, onClose, busy }: Props) {
  const ref = useDismissable<HTMLDivElement>(onClose);
  return (
    <div className="overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className="modal premium-modal"
        ref={ref}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="legal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <p className="eyebrow" style={{ color: 'var(--brass)' }}>fitfiller premium</p>
        <h2>Repair with real terrain</h2>
        <ul className="premium-list">
          <li>
            <strong>Real elevation</strong> — query trusted elevation data along
            your traced route instead of a straight line.
          </li>
          <li>
            <strong>Grade-adjusted pace</strong> — distribute effort by slope, so
            the filled segment matches how you actually ran it.
          </li>
          <li>Support an open-source project and keep it ad-free.</li>
        </ul>
        <button
          className="btn btn-premium"
          style={{ width: '100%', justifyContent: 'center' }}
          onClick={onSubscribe}
          disabled={busy}
        >
          {busy ? 'Activating…' : 'Go premium'}
        </button>
        <p className="notice" style={{ marginTop: 10, textAlign: 'center' }}>
          Demo checkout — unlocks instantly, no card required.
        </p>
      </div>
    </div>
  );
}
