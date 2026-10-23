import { Route, Routes } from 'react-router-dom';
import { useT } from './session';
import { Sidebar } from './Sidebar';
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
  const t = useT();
  return (
    <div className="layout">
      <Sidebar />
      <div className="content">
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
      </div>
    </div>
  );
}
