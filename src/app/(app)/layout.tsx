import Link from 'next/link';
import { Suspense } from 'react';
import { exigirUsuario } from '@/lib/auth';
import { q1 } from '@/lib/db';
import { sair } from '@/app/actions/auth';
import { Flash } from '@/components/Flash';
import { Logo, OndasMenu } from '@/components/Logo';
import { NavLinks } from './NavLinks';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await exigirUsuario();
  const gestor = s.perfil === 'gestor';
  const al = await q1<{ hoje: number; breve: number; fin: number; titulos: string | null }>(
    `SELECT count(*) FILTER (WHERE t.prazo = CURRENT_DATE) AS hoje,
            count(*) FILTER (WHERE t.prazo BETWEEN CURRENT_DATE + 1 AND CURRENT_DATE + 3) AS breve,
            (SELECT count(*) FROM boletos b WHERE b.escritorio_id = $2 AND $3 AND b.gerado_em IS NOT NULL AND b.pago_em IS NULL AND b.vencimento < CURRENT_DATE) AS fin,
            string_agg(DISTINCT t.titulo, ' · ') FILTER (WHERE t.prazo = CURRENT_DATE) AS titulos
       FROM tarefas t JOIN departamentos d ON d.id = t.departamento_id
      WHERE t.operador_id = $1 AND NOT d.restrito_gestor AND t.status IN ('pendente','em_andamento')`,
    [s.id, s.esc, gestor],
  );
  return (
    <div className="app">
      <nav>
        <div className="nbrand"><Logo size={32} /><div><b>EcommFlow</b><span>{s.escNome}</span></div></div>
        <NavLinks gestor={gestor} alertas={(al?.hoje ?? 0) + (al?.breve ?? 0)} vencidos={al?.fin ?? 0} />
        <OndasMenu />
      </nav>
      <main>
        <header>
          <div />
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <Link className="btn" href="/tarefas/nova">+ Nova tarefa</Link>
            <span>👤 <b>{s.nome}</b> <span className="desc">({s.perfil})</span></span>
            <Link className="btn sm gh" href="/conta">Minha conta</Link>
            <form action={sair}><button className="btn sm gh">Sair</button></form>
          </div>
        </header>
        <Suspense><Flash /></Suspense>
        {!!al?.hoje && (
          <Link href="/minhas?atalho=hoje" className="alerta hoje" style={{ textDecoration: 'none' }}>
            <span className="ic">🚨</span>
            <span>ATENÇÃO: você tem <b>{al.hoje} tarefa{al.hoje > 1 ? 's' : ''} vencendo HOJE</b>: {al.titulos}</span>
            <span className="vr">Ver agora →</span>
          </Link>
        )}
        {!!al?.breve && (
          <Link href="/minhas?atalho=breve" className="alerta breve" style={{ textDecoration: 'none' }}>
            <span className="ic">⏰</span><span><b>{al.breve} tarefa{al.breve > 1 ? 's' : ''}</b> vence{al.breve > 1 ? 'm' : ''} nos próximos 3 dias</span>
            <span className="vr">Ver →</span>
          </Link>
        )}
        {children}
      </main>
    </div>
  );
}
