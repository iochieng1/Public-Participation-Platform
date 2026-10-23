import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

interface Receipt { reference: string; consultation: { id: string; title: string; phase: string }; stance: string; decision: string; decisionReason: string | null }

export function TrackPage() {
  const [ref, setRef] = useState('');
  const [r, setR] = useState<Receipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <h1>Track a submission</h1>
      <form className="panel narrow" onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setR(null);
        try { setR(await api<Receipt>(`/submissions/${encodeURIComponent(ref.trim())}`)); }
        catch (err) { setError((err as Error).message); }
      }}>
        <input placeholder="S-ABC234" value={ref} onChange={(e) => setRef(e.target.value)} required />
        <button className="btn">Look up</button>
        {error && <p className="error">{error}</p>}
      </form>
      {r && (
        <div className="panel">
          <p><code>{r.reference}</code> on <Link to={`/consultations/${r.consultation.id}`}>{r.consultation.title}</Link></p>
          <p>Status: <b>{r.decision.replace('_', ' ')}</b></p>
          {r.decisionReason && <p>Reason given: {r.decisionReason}</p>}
        </div>
      )}
    </>
  );
}
