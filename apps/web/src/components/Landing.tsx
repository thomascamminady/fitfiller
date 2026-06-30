import { useRef, useState } from 'react';

interface Props {
  onFile: (file: File) => void;
  busy: boolean;
}

/** The hero motif: a route with a missing middle, redrawn whole. */
function TraceArt() {
  return (
    <svg
      className="trace-art"
      viewBox="0 0 460 120"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        {/* The mend: blue (paused) bleeding into red (resumed), echoing the map. */}
        <linearGradient
          id="mend"
          x1="195"
          y1="72"
          x2="300"
          y2="28"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="var(--paused)" />
          <stop offset="1" stopColor="var(--resumed)" />
        </linearGradient>
      </defs>
      <path
        d="M8 96 C 60 96, 70 40, 120 38 C 150 37, 165 70, 195 72"
        stroke="var(--route)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M195 72 C 235 75, 250 30, 300 28"
        stroke="url(#mend)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="2 9"
      />
      <path
        d="M300 28 C 345 26, 360 92, 410 94 C 432 95, 444 86, 452 78"
        stroke="var(--route)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="195" cy="72" r="5.5" fill="var(--paused)" />
      <circle cx="300" cy="28" r="5.5" fill="var(--resumed)" />
      <circle cx="8" cy="96" r="4" fill="var(--route)" />
      <circle cx="452" cy="78" r="4" fill="var(--route)" />
    </svg>
  );
}

export function Landing({ onFile, busy }: Props) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function pick(files: FileList | null) {
    const f = files?.[0];
    if (f) onFile(f);
  }

  return (
    <main className="landing">
      <div className="landing-card">
        <p className="eyebrow">FIT repair · for the run you actually ran</p>
        <TraceArt />
        <h1>
          You forgot to unpause.
          <br />
          <span className="accent">Let's mend the gap.</span>
        </h1>
        <p className="lede">
          Upload your .fit file, trace the stretch your watch missed, and
          fitfiller rebuilds a clean file you can upload anywhere.
        </p>

        <div
          className={`dropzone ${drag ? 'drag' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            pick(e.dataTransfer.files);
          }}
        >
          <button
            className="btn btn-primary"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            {busy ? 'Reading file…' : 'Choose a .fit file'}
          </button>
          <p className="hint">or drag it here</p>
          <input
            ref={inputRef}
            type="file"
            accept=".fit"
            hidden
            onChange={(e) => pick(e.target.files)}
          />
        </div>
      </div>
    </main>
  );
}
