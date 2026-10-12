'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/client';

function LoginForm() {
  const params = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await api('/api/auth/login', { method: 'POST', json: { username, password } });
      const next = params.get('next');
      window.location.href = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
    } catch (err: any) {
      setError(err.message); setBusy(false);
    }
  }

  return (
    <form className="card stack" onSubmit={submit} style={{ maxWidth: 420, margin: '2rem auto' }}>
      <h1>Sign in</h1>
      <label className="field"><span>Username or email</span>
        <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
      </label>
      <label className="field"><span>Password</span>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
      </label>
      {error && <p className="error">{error}</p>}
      <button className="primary" disabled={busy}>Sign in</button>
      <p className="muted small">No account? <Link href="/register">Create one</Link></p>
    </form>
  );
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}
