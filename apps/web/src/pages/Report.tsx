import { useParams } from 'react-router-dom';
import { fmtDate, type Consultation } from '../api';
import { useApi } from '../hooks';

interface Report {
  consultation: Consultation & { reportPublishedAt: string | null };
  totals: { submissions: number; participants: number };
  byStance: Record<string, number>;
  byChannel: Record<string, number>;
  byDecision: Record<string, number>;
  bySubCounty: Record<string, number>;
  submissions: { reference: string; channel: string; stance: string; clause: string | null; body: string; ward: string | null; subCounty: string | null; decision: string; decisionReason: string | null }[];
}

function Bars({ title, data }: { title: string; data: Record<string, number> }) {
  const max = Math.max(1, ...Object.values(data));
  return (
    <div className="bars">
      <h4>{title}</h4>
      {Object.entries(data).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
        <div key={k} className="bar-row">
          <span>{k.replace('_', ' ').toLowerCase()}</span>
          <div className="bar"><div style={{ width: `${(v / max) * 100}%` }} /></div>
          <b>{v}</b>
        </div>
      ))}
    </div>
  );
}

export function ReportPage() {
  const { id } = useParams();
  const { data: r, error } = useApi<Report>(`/consultations/${id}/report`);
  if (error) return <p className="error">{error}</p>;
  if (!r) return <p className="muted">Loading…</p>;
  const c = r.consultation;
  return (
    <article className="report">
      <p className="muted">Public participation report · {c.county?.name ?? 'National'}</p>
      <h1>{c.title}</h1>
      {c.phase !== 'REPORTED' && <p className="panel warn">Draft preview, visible to county officers only.</p>}
      <p className="muted">
        Open {fmtDate(c.opensAt)} – {fmtDate(c.closesAt)}
        {c.reportPublishedAt && ` · Report published ${fmtDate(c.reportPublishedAt)}`}
      </p>
      {c.reportSummary && <p className="lead">{c.reportSummary}</p>}
      <div className="stats">
        <div><b>{r.totals.submissions}</b><span>submissions</span></div>
        <div><b>{r.totals.participants}</b><span>participants</span></div>
      </div>
      <div className="grid">
        <Bars title="Stance" data={r.byStance} />
        <Bars title="Outcome" data={r.byDecision} />
        <Bars title="Channel" data={r.byChannel} />
        <Bars title="Sub-county" data={r.bySubCounty} />
      </div>
      <h3>Every submission and how it was considered</h3>
      <table>
        <thead><tr><th>Ref</th><th>Where</th><th>Stance</th><th>Comment</th><th>Decision &amp; reason</th></tr></thead>
        <tbody>
          {r.submissions.map((s) => (
            <tr key={s.reference}>
              <td><code>{s.reference}</code><div className="muted">{s.channel}</div></td>
              <td>{s.ward ? `${s.ward}, ${s.subCounty}` : '—'}</td>
              <td>{s.stance}</td>
              <td>{s.clause && <b>{s.clause}: </b>}{s.body}</td>
              <td><b>{s.decision.replace('_', ' ')}</b>{s.decisionReason && <div>{s.decisionReason}</div>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="btn secondary noprint" onClick={() => window.print()}>Print / save as PDF</button>
    </article>
  );
}
