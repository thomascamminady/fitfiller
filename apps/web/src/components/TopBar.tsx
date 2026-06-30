import type { AuthContext } from '../types';

export const GITHUB_URL =
  import.meta.env.VITE_GITHUB_URL ??
  'https://github.com/thomascamminady/fitfiller';

interface Props {
  auth: AuthContext | null;
  onReset: () => void;
  onUpgrade: () => void;
  hasActivity: boolean;
}

/**
 * The logo: a single clean trace that breaks mid-stride — black line, a blue
 * "paused" node, a dashed gap, a red "resumed" node — the whole idea in one mark.
 */
function Logo() {
  return (
    <svg width="34" height="20" viewBox="0 0 34 20" aria-hidden="true">
      <path
        d="M2 14 H13"
        stroke="#181a1f"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M13 14 H21"
        stroke="#94a3b8"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeDasharray="1 3.2"
      />
      <path
        d="M21 14 H32"
        stroke="#181a1f"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle cx="13" cy="14" r="3" fill="#2563eb" />
      <circle cx="21" cy="14" r="3" fill="#dc2626" />
    </svg>
  );
}

function GithubMark() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

export function TopBar({ auth, onReset, onUpgrade, hasActivity }: Props) {
  const isPremium = auth?.isPremium ?? false;
  return (
    <header className="topbar">
      <button
        className="wordmark"
        onClick={onReset}
        aria-label="fitfiller home"
      >
        <Logo />
        fitfiller
      </button>
      <div className="topbar-right">
        {hasActivity && (
          <button className="btn btn-ghost btn-sm" onClick={onReset}>
            New file
          </button>
        )}
        {auth &&
          (isPremium ? (
            <span className="tier-chip premium">Premium</span>
          ) : (
            <button className="tier-chip upgrade" onClick={onUpgrade}>
              Go premium
            </button>
          ))}
        <a
          className="icon-link"
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          aria-label="Source on GitHub"
        >
          <GithubMark />
        </a>
      </div>
    </header>
  );
}
