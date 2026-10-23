import { useState } from 'react';
import { Link } from 'react-router-dom';
import { fmtDate, type Consultation } from '../api';
import { useApi } from '../hooks';
import { useSession, useT } from '../session';
import { WardPicker } from '../WardPicker';

const TYPE_LABEL: Record<string, string> = {
  BILL: 'Bill', FINANCE_BILL: 'Finance Bill', BUDGET_ESTIMATES: 'Budget estimates',
  CIDP: 'CIDP', ADP: 'Annual Development Plan', POLICY: 'Policy', OTHER: 'Other',
};

export const PhaseBadge = ({ phase }: { phase: string }) => <span className={`badge ${phase.toLowerCase()}`}>{phase}</span>;

export function ConsultationsPage() {
  const { user, lang } = useSession();
  const t = useT();
  const [countyId, setCountyId] = useState<number | null>(null);
  const { data, error } = useApi<Consultation[]>(`/consultations${countyId ? `?countyId=${countyId}` : ''}`);

  return (
    <>
      <div className="row spread">
        <h1>{t('consultations')}</h1>
        {(user?.role === 'OFFICER' || user?.role === 'ADMIN') && <Link className="btn" to="/consultations/new">New consultation</Link>}
      </div>
      <WardPicker countyOnly onCounty={setCountyId} />
      {error && <p className="error">{error}</p>}
      <ul className="cards">
        {data?.map((c) => (
          <li key={c.id} className="card">
            <div className="row spread">
              <span className="muted">{c.county?.name ?? 'National'} · {TYPE_LABEL[c.type]} · SMS code <b>{c.code}</b></span>
              <PhaseBadge phase={c.phase} />
            </div>
            <h2><Link to={`/consultations/${c.id}`}>{lang === 'SW' && c.titleSw ? c.titleSw : c.title}</Link></h2>
            <p className="muted">
              {c.phase === 'UPCOMING' ? `${t('opens')} ${fmtDate(c.opensAt)}` : `${t('closes')} ${fmtDate(c.closesAt)}`}
              {' · '}{c._count?.submissions ?? 0} submissions
            </p>
          </li>
        ))}
        {data?.length === 0 && <p className="muted">No consultations yet.</p>}
      </ul>
    </>
  );
}
