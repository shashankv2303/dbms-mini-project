'use client';
import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/client';

export default function RegisterPage() {
  const [f, setF] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await api('/api/auth/register', { method: 'POST', json: f });
      window.location.href = '/';
    } catch (err: any) {
      setError(err.message); setBusy(false);
    }
  }
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <form className="card stack" onSubmit={submit} style={{ maxWidth: 420, margin: '2rem auto' }}>
      <h1>Create account</h1>
      <label className="field"><span>Username</span><input value={f.username} onChange={set('username')} minLength={3} maxLength={40} required /></label>
      <label className="field"><span>Email</span><input type="email" value={f.email} onChange={set('email')} required /></label>
      <label className="field"><span>Password (min 8 characters)</span><input type="password" value={f.password} onChange={set('password')} minLength={8} maxLength={72} required /></label>
      {error && <p className="error">{error}</p>}
      <button className="primary" disabled={busy}>Create account</button>
      <p className="muted small">Already registered? <Link href="/login">Sign in</Link></p>
    </form>
  );
}
