'use client';
import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/** Mensagem de retorno das ações (parâmetro ?m= na URL, removido após exibir). */
export function Flash() {
  const sp = useSearchParams();
  const path = usePathname();
  const [m, setM] = useState<{ tipo: string; msg: string } | null>(null);
  useEffect(() => {
    const v = sp.get('m');
    if (!v) return;
    try { setM(JSON.parse(v)); } catch { /* ignora */ }
    const u = new URLSearchParams(sp.toString());
    u.delete('m');
    window.history.replaceState(null, '', `${path}${u.size ? `?${u}` : ''}`);
    const t = setTimeout(() => setM(null), 7000);
    return () => clearTimeout(t);
  }, [sp, path]);
  if (!m) return null;
  return <div className={`flash ${m.tipo}`} role="status">{m.tipo === 'erro' ? '⚠ ' : '✔ '}{m.msg}</div>;
}
