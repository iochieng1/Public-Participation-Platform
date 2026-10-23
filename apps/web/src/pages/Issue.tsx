import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, fmtDate, type Issue } from '../api';
import { useApi } from '../hooks';
import { useSession } from '../session';

const STATUSES = ['ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'];

export function IssuePage() {
  const { id } = useParams();
  const { user } = useSession();
  const { data: i, error, reload } = useApi<Issue>(`/issues/${id}`);
  const [status, setStatus] = useState('ACKNOWLEDGED');
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);
  if (error) return <p className="error">{error}</p>;
  if (!i) return <p className="muted">Loading…</p>;

  const isOfficer =
    user?.role === 'ADMIN' || (user?.role === 'OFFICER' && user.countyId === i.ward.subCounty.county.id);

  return (
    <>
      <p className="muted"><code>{i.reference}</code> · {i.category} · {i.ward.name}, {i.ward.subCounty.name}, {i.ward.subCounty.county.name}</p>
      <h1>{i.title}</h1>
      <p className="lead">{i.description}</p>
      <div className="row">
        <span className={`badge ${i.status.toLowerCase()}`}>{i.status.replace('_', ' ')}</span>
        {user && (
          <button className="btn secondary" disabled={i.upvoted} onClick={() => api(`/issues/${i.id}/upvote`, { method: 'POST' }).then(reload)}>
            ▲ {i.upvoted ? 'You raised this too' : 'This affects me too'} ({i.upvoteCount})
          </button>
        )}
      </div>
      <h3>County response</h3>
      <ol className="timeline">
        <li><b>Reported</b> via {i.channel} · {fmtDate(i.createdAt)}</li>
        {i.updates?.map((u) => (
          <li key={u.id}><b>{u.status.replace('_', ' ')}</b> · {fmtDate(u.createdAt)}{u.author.name && ` · ${u.author.name}`}<p>{u.note}</p></li>
        ))}
      </ol>
      {isOfficer && (
        <form className="panel manage" onSubmit={async (e) => {
          e.preventDefault();
          setErr(null);
          try { await api(`/issues/${i.id}/updates`, { body: { status, note } }); setNote(''); reload(); }
          catch (x) { setErr((x as Error).message); }
        }}>
          <h3>Respond (the reporter gets this by SMS)</h3>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
          <textarea required rows={3} placeholder="Public note" value={note} onChange={(e) => setNote(e.target.value)} />
          {err && <p className="error">{err}</p>}
          <button className="btn">Post update</button>
        </form>
      )}
    </>
  );
}
