import { useDismissable } from '../hooks/useDismissable';

export type LegalPage = 'impressum' | 'privacy' | 'licenses';

interface Props {
  page: LegalPage;
  onClose: () => void;
}

/**
 * Placeholder legal text. The bracketed fields MUST be completed by the
 * operator before going live — German law (TMG §5) requires a real Impressum
 * and the GDPR requires an accurate privacy notice.
 */
export function Legal({ page, onClose }: Props) {
  const ref = useDismissable<HTMLDivElement>(onClose);
  return (
    <div className="overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className="legal-modal"
        ref={ref}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="legal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        {page === 'impressum' && <Impressum />}
        {page === 'privacy' && <Privacy />}
        {page === 'licenses' && <Licenses />}
      </div>
    </div>
  );
}

function Impressum() {
  return (
    <>
      <h2>Impressum</h2>
      <p>Angaben gemäß § 5 TMG / Information according to § 5 TMG.</p>
      <h3>Diensteanbieter</h3>
      <p>
        [Full legal name]
        <br />
        [Street and number]
        <br />
        [Postal code, City]
        <br />
        [Country]
      </p>
      <h3>Kontakt</h3>
      <p>
        E-Mail: [contact email]
        <br />
        Telefon: [phone, optional]
      </p>
      <h3>Verantwortlich i. S. d. § 18 Abs. 2 MStV</h3>
      <p>[Responsible person name and address]</p>
      <h3>EU-Streitschlichtung</h3>
      <p>
        Die Europäische Kommission stellt eine Plattform zur
        Online-Streitbeilegung (OS) bereit:{' '}
        <a href="https://ec.europa.eu/consumers/odr/" rel="noreferrer">
          ec.europa.eu/consumers/odr
        </a>
        . Wir sind nicht verpflichtet und nicht bereit, an
        Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle
        teilzunehmen.
      </p>
    </>
  );
}

function Privacy() {
  return (
    <>
      <h2>Privacy Notice (GDPR)</h2>
      <p>
        This notice explains how fitfiller handles your data. Complete the
        bracketed fields before publishing.
      </p>
      <h3>Controller</h3>
      <p>[Legal name and contact — see Impressum]</p>
      <h3>What we process</h3>
      <ul>
        <li>
          <strong>Uploaded .fit files.</strong> Parsed in memory to detect
          pauses and rebuild the track. Held only for the length of your editing
          session (auto-expires within one hour) and never shared.
        </li>
        <li>
          <strong>Route coordinates</strong> you draw, sent to the API to
          compute the filled segment.
        </li>
        <li>
          <strong>Account &amp; billing data</strong> (premium only): handled by
          our payment processor [Stripe]; we store only the identifiers needed
          to unlock premium features.
        </li>
      </ul>
      <h3>Third parties</h3>
      <ul>
        <li>
          Map tiles are served by [map tile provider]; your IP is visible to
          them.
        </li>
        <li>
          Elevation lookups (premium) send route coordinates to [elevation
          provider].
        </li>
        <li>Payments are processed by [Stripe].</li>
      </ul>
      <h3>Legal basis</h3>
      <p>
        Processing of uploaded files is based on Art. 6(1)(b) GDPR (performing
        the service you requested). Billing data is processed to fulfil the
        premium contract.
      </p>
      <h3>Your rights</h3>
      <p>
        You may request access, rectification, erasure, restriction, and data
        portability, and you may lodge a complaint with a supervisory authority.
        Contact: [data protection contact email].
      </p>
    </>
  );
}

function Licenses() {
  return (
    <>
      <h2>Open-source licenses</h2>
      <p>fitfiller is built on the work of others. Thank you.</p>
      <h3>Core libraries</h3>
      <ul>
        <li>
          <strong>Garmin FIT JavaScript SDK</strong> — FIT decode/encode. Used
          under the Flexible and Interoperable Data Transfer (FIT) Protocol
          License.
        </li>
        <li>
          <strong>MapLibre GL JS</strong> — map rendering (BSD-3-Clause).
        </li>
        <li>
          <strong>React</strong> (MIT), <strong>Fastify</strong> (MIT),{' '}
          <strong>Vite</strong> (MIT), <strong>Zod</strong> (MIT).
        </li>
        <li>Map tiles &amp; styles: [tile provider attribution].</li>
      </ul>
      <p className="notice">
        Full dependency licenses are generated from each package's LICENSE file
        at build time; see the repository's NOTICE for the complete list.
      </p>
    </>
  );
}
