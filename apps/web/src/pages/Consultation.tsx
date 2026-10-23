import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, fmtDate, type Consultation, type Decision, type Submission } from '../api';
import { useApi } from '../hooks';
import { useSession, useT } from '../session';
import { PhaseBadge } from './Consultations';
import { WardPicker } from '../WardPicker';

export function ConsultationPage() {
  const { id } = useParams();
  const { user, lang } = useSession();
  const t = useT();
  const { data: c, error, reload } = useApi<Consultation>(`/consultations/${id}`);
  if (error) return <p className="error">{error}</p>;
  if (!c) return <p className="muted">Loading…</p>;

  const sw = lang === 'SW';
  return (
    <>
      <p className="muted">{c.county?.name ?? 'National'} · SMS code <b>{c.code}</b> · <PhaseBadge phase={c.phase} /></p>
      <h1>{sw && c.titleSw ? c.titleSw : c.title}</h1>
      <p className="lead">{sw && c.summarySw ? c.summarySw : c.summary}</p>
      <p className="muted">{t('opens')} {fmtDate(c.opensAt)} · {t('closes')} {fmtDate(c.closesAt)}</p>
      {c.documentUrl && <p><a href={c.documentUrl} target="_blank" rel="noreferrer">{t('readDoc')} ↗</a></p>}
      {(c.phase === 'REPORTED' || c.canManage) && c.phase !== 'DRAFT' && (
        <p><Link className="btn secondary" to={`/consultations/${c.id}/report`}>{t('viewReport')}</Link></p>
      )}

      {c.phase === 'OPEN' && (user ? <SubmitForm c={c} /> : (
        <div className="panel">
          <h3>{t('haveYourSay')}</h3>
          <p><Link to="/signin">{t('signIn')}</Link> — or SMS <code>{c.code} your comment</code> to the county shortcode.</p>
        </div>
      ))}

      {c.canManage && <ManagePanel c={c} onChange={reload} />}
    </>
  );
}

function SubmitForm({ c }: { c: Consultation }) {
  const t = useT();
  const [stance, setStance] = useState('GENERAL');
  const [clause, setClause] = useState('');
  const [body, setBody] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const s = await api<Submission>(`/consultations/${c.id}/submissions`, { body: { stance, clause: clause || undefined, body } });
      setResult(s.reference);
      setBody('');
      setClause('');
    } catch (err) { setError((err as Error).message); }
  }

  if (result) return <div className="panel ok">Received. Your reference is <b>{result}</b>; we have also sent it by SMS.</div>;
  return (
    <form className="panel" onSubmit={submit}>
      <h3>{t('haveYourSay')}</h3>
      <div className="row">
        {[['SUPPORT', 'Support'], ['OPPOSE', 'Oppose'], ['AMEND', 'Propose a change'], ['GENERAL', 'General comment']].map(([v, l]) => (
          <label key={v} className="chip"><input type="radio" name="stance" checked={stance === v} onChange={() => setStance(v)} /> {l}</label>
        ))}
      </div>
      <input placeholder="Section / clause / vote head (optional)" value={clause} onChange={(e) => setClause(e.target.value)} />
      <textarea required minLength={3} rows={5} placeholder="Your views" value={body} onChange={(e) => setBody(e.target.value)} />
      {error && <p className="error">{error}</p>}
      <button className="btn">{t('submit')}</button>
    </form>
  );
}

const DECISIONS: [Exclude<Decision, 'PENDING'>, string][] = [
  ['ADOPTED', 'Adopted'], ['PARTIALLY_ADOPTED', 'Partially adopted'], ['NOT_ADOPTED', 'Not adopted'],
];

function ManagePanel({ c, onChange }: { c: Consultation; onChange: () => void }) {
  const { data: subs, reload } = useApi<Submission[]>(c.phase === 'DRAFT' ? null : `/consultations/${c.id}/submissions`);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [decision, setDecision] = useState<Exclude<Decision, 'PENDING'>>('ADOPTED');
  const [reason, setReason] = useState('');
  const [summary, setSummary] = useState('');
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try { await fn(); reload(); onChange(); } catch (e) { setError((e as Error).message); }
  };
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const pending = subs?.filter((s) => s.decision === 'PENDING').length ?? 0;

  return (
    <section className="panel manage">
      <h3>County officer tools</h3>
      {error && <p className="error">{error}</p>}
      {c.phase === 'DRAFT' && (
        <button className="btn" onClick={() => run(() => api(`/consultations/${c.id}/publish`, { method: 'POST' }))}>Publish</button>
      )}
      {subs && (
        <>
          <p className="muted">{subs.length} submissions · {pending} awaiting a decision</p>
          <table>
            <thead><tr><th /><th>Ref</th><th>Ward</th><th>Via</th><th>Stance</th><th>Comment</th><th>Decision</th></tr></thead>
            <tbody>
              {subs.map((s) => (
                <tr key={s.id}>
                  <td><input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} disabled={c.phase === 'REPORTED'} /></td>
                  <td><code>{s.reference}</code></td>
                  <td>{s.ward?.name ?? '—'}</td>
                  <td>{s.channel}</td>
                  <td>{s.stance}</td>
                  <td>{s.clause && <b>{s.clause}: </b>}{s.body}</td>
                  <td>{s.decision.replace('_', ' ')}{s.decisionReason && <div className="muted">{s.decisionReason}</div>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {c.phase !== 'REPORTED' && selected.size > 0 && (
            <div className="row">
              <select value={decision} onChange={(e) => setDecision(e.target.value as typeof decision)}>
                {DECISIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <input placeholder="Reason (required unless adopted)" value={reason} onChange={(e) => setReason(e.target.value)} />
              <button className="btn" onClick={() => run(async () => {
                await api(`/consultations/${c.id}/decisions`, { body: { submissionIds: [...selected], decision, reason: reason || undefined } });
                setSelected(new Set());
                setReason('');
              })}>Record decision for {selected.size}</button>
            </div>
          )}
          {(c.phase === 'OPEN' || c.phase === 'CLOSED') && <OfflineForm c={c} onDone={reload} />}
          {c.phase === 'CLOSED' && (
            <div>
              <textarea rows={4} placeholder="Report summary: how public views shaped the final version" value={summary} onChange={(e) => setSummary(e.target.value)} />
              <button className="btn" disabled={pending > 0} onClick={() => run(() => api(`/consultations/${c.id}/report`, { body: { summary } }))}>
                Publish feedback report &amp; notify participants
              </button>
              {pending > 0 && <p className="muted">Record a decision for every submission first.</p>}
            </div>
          )}
        </>
      )}
    </section>
  );
}

/** Digitise a written memorandum or a comment made at a town hall / baraza. */
function OfflineForm({ c, onDone }: { c: Consultation; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ channel: 'PAPER', phone: '', stance: 'GENERAL', clause: '', body: '' });
  const [wardId, setWardId] = useState('');
  const [error, setError] = useState<string | null>(null);
  if (!open) return <button className="btn secondary" onClick={() => setOpen(true)}>Record a paper memorandum / forum comment</button>;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.value });
  return (
    <form className="panel" onSubmit={async (e) => {
      e.preventDefault();
      setError(null);
      try {
        await api(`/consultations/${c.id}/submissions/offline`, {
          body: { ...f, phone: f.phone || undefined, clause: f.clause || undefined, wardId: wardId || undefined },
        });
        setF({ ...f, phone: '', clause: '', body: '' });
        onDone();
      } catch (err) { setError((err as Error).message); }
    }}>
      <div className="row">
        <select value={f.channel} onChange={set('channel')}>
          <option value="PAPER">Paper memorandum</option>
          <option value="FORUM">Town hall / baraza</option>
        </select>
        <select value={f.stance} onChange={set('stance')}>
          {['SUPPORT', 'OPPOSE', 'AMEND', 'GENERAL'].map((s) => <option key={s}>{s}</option>)}
        </select>
        <input placeholder="Phone (optional, for SMS receipt)" value={f.phone} onChange={set('phone')} />
      </div>
      <WardPicker onChange={setWardId} />
      <input placeholder="Section / clause (optional)" value={f.clause} onChange={set('clause')} />
      <textarea required rows={3} placeholder="Comment, as written or said" value={f.body} onChange={set('body')} />
      {error && <p className="error">{error}</p>}
      <button className="btn">Record</button>
    </form>
  );
}
