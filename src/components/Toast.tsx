'use client';
import { useCallback, useEffect, useState } from 'react';

export function useToast() {
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);
  const show = useCallback((msg: string, err = false) => setToast({ msg, err }), []);
  const node = toast ? <div className={`toast${toast.err ? ' err' : ''}`}>{toast.msg}</div> : null;
  return { show, node };
}
