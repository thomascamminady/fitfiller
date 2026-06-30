import type { LegalPage } from './Legal';
import { GITHUB_URL, AUTHOR_URL } from './TopBar';

interface Props {
  onOpen: (page: LegalPage) => void;
}

export function Footer({ onOpen }: Props) {
  return (
    <footer className="footer">
      <span>
        © {new Date().getFullYear()} fitfiller · open source · by{' '}
        <a href={AUTHOR_URL} target="_blank" rel="noreferrer">
          Thomas Camminady
        </a>
      </span>
      <nav>
        <a href={GITHUB_URL} target="_blank" rel="noreferrer">
          GitHub
        </a>
        <button onClick={() => onOpen('impressum')}>Impressum</button>
        <button onClick={() => onOpen('privacy')}>Privacy / GDPR</button>
        <button onClick={() => onOpen('licenses')}>Licenses</button>
      </nav>
    </footer>
  );
}
