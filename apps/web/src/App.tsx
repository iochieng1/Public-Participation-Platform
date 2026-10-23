import { NavLink, Route, Routes } from 'react-router-dom';
import { useSession, useT } from './session';
import { ConsultationsPage } from './pages/Consultations';
import { ConsultationPage } from './pages/Consultation';
import { NewConsultationPage } from './pages/NewConsultation';
import { ReportPage } from './pages/Report';
import { IssuesPage } from './pages/Issues';
import { IssuePage } from './pages/Issue';
import { SignInPage } from './pages/SignIn';
import { ProfilePage } from './pages/Profile';
import { TrackPage } from './pages/Track';

export function App() {
  const { user, lang, setLang, signOut } = useSession();
  const t = useT();
  return (
    <>
      <header className="top">
        <div className="wrap bar">
          <NavLink to="/" className="brand">
            <span className="flag" aria-hidden /> Public Participation Kenya
          </NavLink>
          <nav>
            <NavLink to="/">{t('consultations')}</NavLink>
            <NavLink to="/issues">{t('issues')}</NavLink>
            <NavLink to="/track">{t('track')}</NavLink>
            {user ? (
              <>
                <NavLink to="/profile">{t('profile')}</NavLink>
                <button className="link" onClick={signOut}>{t('signOut')}</button>
              </>
            ) : (
              <NavLink to="/signin">{t('signIn')}</NavLink>
            )}
            <button className="lang" onClick={() => setLang(lang === 'EN' ? 'SW' : 'EN')}>
              {lang === 'EN' ? 'Kiswahili' : 'English'}
            </button>
          </nav>
        </div>
      </header>
      <main className="wrap">
        <Routes>
          <Route path="/" element={<ConsultationsPage />} />
          <Route path="/consultations/new" element={<NewConsultationPage />} />
          <Route path="/consultations/:id" element={<ConsultationPage />} />
          <Route path="/consultations/:id/report" element={<ReportPage />} />
          <Route path="/issues" element={<IssuesPage />} />
          <Route path="/issues/:id" element={<IssuePage />} />
          <Route path="/signin" element={<SignInPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/track" element={<TrackPage />} />
        </Routes>
      </main>
      <footer className="wrap foot">{t('noPhone')}</footer>
    </>
  );
}
