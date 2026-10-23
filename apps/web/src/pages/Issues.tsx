import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fmtDate, type Issue } from '../api';
import { useApi } from '../hooks';
import { useSession, useT } from '../session';
import { WardPicker } from '../WardPicker';

export const CATEGORIES = ['WATER', 'ROADS', 'HEALTH', 'EDUCATION', 'SECURITY', 'WASTE', 'OTHER'];

export function IssuesPage() {
  const { user } = useSession();
  const t = useT();
  const [countyId, setCountyId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const { data, error, reload } = useApi<Issue[]>(`/issues${countyId ? `?countyId=${countyId}` : ''}`);

  return (
    <>
      <div className="row spread">
        <h1>{t('issues')}</h1>
        {user ? <button className="btn" onClick={() => setShowForm(!showForm)}>Report an issue</button>
          : <Link to="/signin">{t('signIn')} to report an issue</Link>}
      </div>
      {showForm && <IssueForm onDone={() => { setShowForm(false); reload(); }} />}
      <WardPicker countyOnly onCounty={setCountyId} />
      {error && <p className="error">{error}</p>}
      <ul className="cards">
        {data?.map((i) => (
          <li key={i.id} className="card row">
            <div className="votes"><b>{i.upvoteCount}</b><span>▲</span></div>
            <div>
              <h2><Link to={`/issues/${i.id}`}>{i.title}</Link></h2>
              <p className="muted">
                {i.category} · {i.ward.name}, {i.ward.subCounty.name}, {i.ward.subCounty.county.name} · {fmtDate(i.createdAt)} ·{' '}
                <span className={`badge ${i.status.toLowerCase()}`}>{i.status.replace('_', ' ')}</span>
              </p>
            </div>
          </li>
        ))}
        {data?.length === 0 && <p className="muted">No issues reported yet.</p>}
      </ul>
    </>
  );
}

function IssueForm({ onDone }: { onDone: () => void }) {
  const [wardId, setWardId] = useState('');
  const [category, setCategory] = useState('WATER');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  return (
    <form className="panel" onSubmit={async (e) => {
      e.preventDefault();
      try { await api('/issues', { body: { wardId, category, title, description } }); onDone(); }
      catch (err) { setError((err as Error).message); }
    }}>
      <WardPicker onChange={setWardId} />
      <select value={category} onChange={(e) => setCategory(e.target.value)}>
        {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
      </select>
      <input required minLength={5} placeholder="Short title, e.g. Burst pipe on Kondele road" value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea required minLength={10} rows={4} placeholder="Describe the issue and exact location" value={description} onChange={(e) => setDescription(e.target.value)} />
      {error && <p className="error">{error}</p>}
      <button className="btn" disabled={!wardId}>Submit</button>
    </form>
  );
}
