import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useSession, useT } from './session';

/** Kenyan flag: black, red and green bands with white fimbriation and a Maasai shield. */
export function KenyaFlag({ width = 48 }: { width?: number }) {
  return (
    <svg width={width} height={(width * 2) / 3} viewBox="0 0 60 40" role="img" aria-label="Flag of Kenya" className="flag">
      <rect width="60" height="40" fill="#fff" />
      <rect width="60" height="12" fill="#000" />
      <rect y="14" width="60" height="12" fill="#BB0000" />
      <rect y="28" width="60" height="12" fill="#006600" />
      <g transform="translate(30 20)">
        <path d="M-9-15 9 15M9-15-9 15" stroke="#fff" strokeWidth="1.4" />
        <ellipse rx="6" ry="13" fill="#BB0000" />
        <path d="M-6 0a6 13 0 0 0 4 12.3V-12.3A6 13 0 0 0-6 0z" fill="#000" />
        <path d="M6 0a6 13 0 0 1-4 12.3V-12.3A6 13 0 0 1 6 0z" fill="#000" />
        <ellipse rx="1.3" ry="3" fill="#fff" />
        <path d="M0-12V-7M0 7V12" stroke="#fff" strokeWidth="1" />
      </g>
    </svg>
  );
}

const icon = (d: string) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);
const ICONS = {
  consultations: icon('M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h5'),
  issues: icon('M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z'),
  track: icon('M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3'),
  profile: icon('M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'),
  signIn: icon('M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3'),
  add: icon('M12 5v14M5 12h14'),
  menu: icon('M3 6h18M3 12h18M3 18h18'),
};

function Item({ to, i, children, match }: {
  to: string;
  i: keyof typeof ICONS;
  children: ReactNode;
  /** Overrides NavLink's prefix matching, e.g. so "/" stays active on /consultations/:id. */
  match?: (pathname: string) => boolean;
}) {
  const { pathname } = useLocation();
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) => `nav-item${(match ? match(pathname) : isActive) ? ' active' : ''}`}
    >
      {ICONS[i]}
      <span>{children}</span>
    </NavLink>
  );
}

export function Sidebar() {
  const { user, lang, setLang, signOut } = useSession();
  const t = useT();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);

  const isOfficer = user?.role === 'OFFICER' || user?.role === 'ADMIN';

  return (
    <>
      <header className="mobile-bar">
        <button className="icon-btn" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}>{ICONS.menu}</button>
        <KenyaFlag width={30} />
        <b>Public Participation</b>
      </header>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}

      <aside className={`sidebar${open ? ' open' : ''}`} aria-label="Main navigation">
        <div className="brand">
          <KenyaFlag />
          <div>
            <b>Public Participation</b>
            <span>Ushiriki wa Umma · Kenya</span>
          </div>
        </div>

        <nav className="nav-group">
          <Item to="/" i="consultations" match={(p) => p === '/' || (p.startsWith('/consultations/') && p !== '/consultations/new')}>{t('consultations')}</Item>
          <Item to="/issues" i="issues" match={(p) => p.startsWith('/issues')}>{t('issues')}</Item>
          <Item to="/track" i="track">{t('track')}</Item>
          {user && <Item to="/profile" i="profile">{t('profile')}</Item>}
        </nav>

        {isOfficer && (
          <nav className="nav-group">
            <p className="nav-label">{user?.role === 'ADMIN' ? 'National admin' : 'County officer'}</p>
            <Item to="/consultations/new" i="add">New consultation</Item>
          </nav>
        )}

        <div className="sidebar-foot">
          <div className="lang-switch" role="group" aria-label="Language">
            <button aria-pressed={lang === 'EN'} onClick={() => setLang('EN')}>English</button>
            <button aria-pressed={lang === 'SW'} onClick={() => setLang('SW')}>Kiswahili</button>
          </div>
          {user ? (
            <div className="who">
              <div>
                <b>{user.name ?? user.phone.replace('+254', '0')}</b>
                <span>{user.role === 'CITIZEN' ? (lang === 'SW' ? 'Mwananchi' : 'Citizen') : user.role === 'ADMIN' ? 'Admin' : 'Officer'}</span>
              </div>
              <button className="link" onClick={signOut}>{t('signOut')}</button>
            </div>
          ) : (
            <Item to="/signin" i="signIn">{t('signIn')}</Item>
          )}
        </div>
      </aside>
    </>
  );
}
