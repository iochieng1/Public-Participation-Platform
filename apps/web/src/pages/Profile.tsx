import { useState } from 'react';
import { api } from '../api';
import { useApi } from '../hooks';
import { useSession } from '../session';
import { WardPicker } from '../WardPicker';

interface Me { name: string | null; phone: string; role: string; ward: { name: string; subCounty: { name: string; county: { name: string } } } | null }
interface MySubmission { id: string; reference: string; decision: string; decisionReason: string | null; consultation: { title: string } }

export function ProfilePage() {
  const { user, refresh } = useSession();
  const { data: me, reload } = useApi<Me>(user ? '/me' : null);
  const { data: mine } = useApi<MySubmission[]>(user ? '/me/submissions' : null);
  const [wardId, setWardId] = useState('');
  const [name, setName] = useState('');
  if (!user) return <p>Please sign in.</p>;

  const save = async () => {
    await api('/me', { method: 'PATCH', body: { ...(wardId && { wardId }), ...(name && { name }) } });
    await refresh();
    reload();
  };

  return (
    <>
      <h1>My ward</h1>
      <p className="muted">{me?.phone} · {me?.role}</p>
      <p>{me?.ward ? <>You are registered in <b>{me.ward.name}</b> ward, {me.ward.subCounty.name}, {me.ward.subCounty.county.name} County.</> : 'Choose your ward so your views are counted where you live.'}</p>
      <div className="panel">
        <input placeholder={me?.name ?? 'Your name (optional, never published)'} value={name} onChange={(e) => setName(e.target.value)} />
        <WardPicker onChange={setWardId} />
        <button className="btn" onClick={save} disabled={!wardId && !name}>Save</button>
      </div>
      <h3>My submissions</h3>
      <ul className="cards">
        {mine?.map((s) => (
          <li key={s.id} className="card">
            <code>{s.reference}</code> · {s.consultation.title}
            <div><b>{s.decision.replace('_', ' ')}</b>{s.decisionReason && ` — ${s.decisionReason}`}</div>
          </li>
        ))}
        {mine?.length === 0 && <p className="muted">None yet.</p>}
      </ul>
    </>
  );
}
