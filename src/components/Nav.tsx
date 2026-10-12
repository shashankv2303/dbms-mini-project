'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from './AuthProvider';

export default function Nav() {
  const { me, loading, logout } = useAuth();
  const path = usePathname();
  const cls = (p: string) => 'link' + (path === p || (p !== '/' && path.startsWith(p)) ? ' active' : '');
  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link href="/" className="brand">Sound<span>Trail</span></Link>
        <Link href="/" className={cls('/')}>Discover</Link>
        <Link href="/playlists" className={cls('/playlists')}>Playlists</Link>
        {me && <Link href="/profile" className={cls('/profile')}>Profile</Link>}
        {me?.role === 'admin' && <Link href="/admin" className={cls('/admin')}>Admin</Link>}
        <span className="spacer" />
        {loading ? null : me ? (
          <>
            <span className="muted small">{me.username} <span className={`pill ${me.role}`}>{me.role}</span></span>
            <button className="small" onClick={logout}>Sign out</button>
          </>
        ) : (
          <>
            <Link href="/login" className="link">Sign in</Link>
            <Link href="/register"><button className="primary small">Create account</button></Link>
          </>
        )}
      </div>
    </nav>
  );
}
