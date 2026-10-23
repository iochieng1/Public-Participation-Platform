import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type Consultation } from '../api';
import { useSession } from '../session';

const TYPES = ['BILL', 'FINANCE_BILL', 'BUDGET_ESTIMATES', 'CIDP', 'ADP', 'POLICY', 'OTHER'];

export function NewConsultationPage() {
  const { user } = useSession();
  const nav = useNavigate();
  const [f, setF] = useState({ code: '', type: 'BILL', title: '', titleSw: '', summary: '', summarySw: '', documentUrl: '', opensAt: '', closesAt: '' });
  const [error, setError] = useState<string | null>(null);
  if (!user || user.role === 'CITIZEN') return <p>Only county officers can create consultations.</p>;

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.value });

  return (
    <form className="panel" onSubmit={async (e) => {
      e.preventDefault();
      setError(null);
      try {
        const c = await api<Consultation>('/consultations', {
          body: {
            ...f,
            // Dates are East Africa Time: open at the start of the first day, close at the end of the last.
            opensAt: `${f.opensAt}T00:00:00+03:00`,
            closesAt: `${f.closesAt}T23:59:59+03:00`,
            countyId: user.role === 'ADMIN' ? null : user.countyId,
            titleSw: f.titleSw || undefined,
            summarySw: f.summarySw || undefined,
            documentUrl: f.documentUrl || undefined,
          },
        });
        nav(`/consultations/${c.id}`);
      } catch (err) { setError((err as Error).message); }
    }}>
      <h1>New consultation (draft)</h1>
      <p className="muted">
        {user.role === 'ADMIN' ? 'National consultation.' : 'For your county.'} Publishing requires a Kiswahili title and summary,
        the full document, and a long enough window.
      </p>
      <div className="row">
        <input required placeholder="SMS code, e.g. KSMFB26" value={f.code} onChange={set('code')} />
        <select value={f.type} onChange={set('type')}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select>
      </div>
      <input required placeholder="Title (English)" value={f.title} onChange={set('title')} />
      <input placeholder="Kichwa (Kiswahili)" value={f.titleSw} onChange={set('titleSw')} />
      <textarea required rows={4} placeholder="Plain-language summary (English)" value={f.summary} onChange={set('summary')} />
      <textarea rows={4} placeholder="Muhtasari kwa lugha rahisi (Kiswahili)" value={f.summarySw} onChange={set('summarySw')} />
      <input type="url" placeholder="Link to the full document (PDF)" value={f.documentUrl} onChange={set('documentUrl')} />
      <div className="row">
        <label>Opens <input required type="date" value={f.opensAt} onChange={set('opensAt')} /></label>
        <label>Closes <input required type="date" value={f.closesAt} onChange={set('closesAt')} /></label>
      </div>
      {error && <p className="error">{error}</p>}
      <button className="btn">Save draft</button>
    </form>
  );
}
