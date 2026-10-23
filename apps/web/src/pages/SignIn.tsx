import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type User } from '../api';
import { useSession } from '../session';

export function SignInPage() {
  const { signIn } = useSession();
  const nav = useNavigate();
  const [phone, setPhone] = useState('');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function go(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (!sent) {
        const r = await api<{ phone: string }>('/auth/otp/request', { body: { phone } });
        setPhone(r.phone);
        setSent(true);
      } else {
        const r = await api<{ token: string; user: User }>('/auth/otp/verify', { body: { phone, code } });
        signIn(r.token, r.user);
        nav(r.user.wardId ? '/' : '/profile');
      }
    } catch (err) { setError((err as Error).message); }
  }

  return (
    <form className="panel narrow" onSubmit={go}>
      <h1>Sign in</h1>
      <p className="muted">We'll send a 6-digit code by SMS. No password, no ID number needed.</p>
      <input inputMode="tel" placeholder="0712 345 678" value={phone} disabled={sent} onChange={(e) => setPhone(e.target.value)} required />
      {sent && <input inputMode="numeric" autoFocus placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value)} required />}
      {error && <p className="error">{error}</p>}
      <button className="btn">{sent ? 'Verify' : 'Send code'}</button>
    </form>
  );
}
