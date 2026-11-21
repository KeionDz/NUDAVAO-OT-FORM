import { useState } from 'react';

/**
 * The navy bar with the gold rule — the NU Davao chrome every sibling app
 * shares. The shield is `public/nu-shield.png`, the same asset as
 * ../nu-room-booking; until it loads (or if it is missing) a neutral monogram
 * stands in, deliberately NOT an imitation of the mark.
 */
export function Header() {
  const [logoFailed, setLogoFailed] = useState(false);

  return (
    <header className="header">
      <div className="header__inner">
        <div className="header__brand">
          {logoFailed ? (
            <span className="logo--placeholder" aria-hidden="true">
              NU
            </span>
          ) : (
            <img
              className="logo"
              src={`${import.meta.env.BASE_URL}nu-shield.png`}
              alt="National University Davao"
              width={40}
              height={40}
              onError={() => setLogoFailed(true)}
            />
          )}
          <span className="header__titles">
            <span className="header__system">OT Form Davao</span>
            <span className="header__sub">Overtime Authorization Form</span>
          </span>
        </div>
        <span className="header__code" title="Form code and version">
          DVO-ADM-HRO-F-001 · v2026
        </span>
      </div>
    </header>
  );
}
