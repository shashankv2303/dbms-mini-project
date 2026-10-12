'use client';
import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from '@/lib/client';

export interface Me { userId: number; username: string; role: 'admin' | 'artist' | 'listener' }
interface Ctx { me: Me | null; loading: boolean; refresh: () => Promise<void>; logout: () => Promise<void> }

const AuthCtx = createContext<Ctx>({ me: null, loading: true, refresh: async () => {}, logout: async () => {} });
export const useAuth = () => useContext(AuthCtx);

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const r = await api<{ user: Me | null }>('/api/auth/me');
      setMe(r.user);
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await api('/api/auth/logout', { method: 'POST' });
    setMe(null);
    window.location.href = '/';
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  return <AuthCtx.Provider value={{ me, loading, refresh, logout }}>{children}</AuthCtx.Provider>;
}
