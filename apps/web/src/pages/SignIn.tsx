import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type User } from '../api';
import { useApi } from '../hooks';
import { useSession } from '../session';

interface Meta { demoMode: boolean; demoAccounts: { label: string; phone: string }[] }

export function SignInPage() {
  const { signIn } = useSession();
  const nav = useNavigate();
  const { data: meta } = useApi<Meta>('/meta');
  const [phone, setPhone] = useState('');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(number: string) {
    const r = await api<{ phone: string; demoCode?: string }>('/auth/otp/request', { body: { phone: number } });
    setPhone(r.phone);
    setSent(true);
    if (r.demoCode) {
      setDemoCode(r.demoCode);
      setCode(r.demoCode);
    }
  }

  async function go(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (!sent) return await sendCode(phone);
      const r = await api<{ token: string; user: User }>('/auth/otp/verify', { body: { phone, code } });
      signIn(r.token, r.user);
      nav(r.user.wardId || r.user.role !== 'CITIZEN' ? '/' : '/profile');
    } catch (err) { setError((err as Error).message); }
  }

  const reset = () => { setSent(false); setCode(''); setDemoCode(null); setError(null); };

  return (
    <div className="narrow-col">
      <form className="panel" onSubmit={go}>
        <h1>Sign in</h1>
        <p className="muted">We'll send a 6-digit code by SMS. No password, no ID number needed.</p>
        <input inputMode="tel" placeholder="0712 345 678" value={phone} disabled={sent} onChange={(e) => setPhone(e.target.value)} required />
        {sent && (
          <>
            {demoCode && (
              <p className="demo-code">
                Demo mode: no SMS was sent. Your code is <b>{demoCode}</b> (already filled in).
              </p>
            )}
            <input inputMode="numeric" autoFocus placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value)} required />
          </>
        )}
        {error && <p className="error">{error}</p>}
        <div className="row">
          <button className="btn">{sent ? 'Verify' : 'Send code'}</button>
          {sent && <button type="button" className="btn secondary" onClick={reset}>Use another number</button>}
        </div>
      </form>

      {meta?.demoMode && !sent && (
        <section className="panel warn">
          <h3>Reviewing the demo?</h3>
          <p className="muted">This server has no SMS gateway, so codes are shown on screen. Pick an account to sign in as:</p>
          <div className="row">
            {meta.demoAccounts.map((a) => (
              <button key={a.phone} type="button" className="btn secondary"
                onClick={() => sendCode(a.phone).catch((e: Error) => setError(e.message))}>
                {a.label}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
