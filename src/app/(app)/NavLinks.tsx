'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function NavLinks({ gestor, alertas, vencidos }: { gestor: boolean; alertas: number; vencidos: number }) {
  const p = usePathname();
  const L = (href: string, ic: string, txt: string, badge?: number) => (
    <Link href={href} className={`nav-link ${p === href || (href !== '/dashboard' && p.startsWith(href + '/')) ? 'on' : ''}`}>
      {ic} <span className="t">{txt}{!!badge && <span className="nbadge">{badge}</span>}</span>
    </Link>
  );
  return (
    <>
      {L('/dashboard', '📊', 'Dashboard')}
      {L('/minhas', '✅', 'Minhas tarefas', alertas)}
      {gestor && (
        <>
          {L('/equipe', '👀', 'Equipe')}
          {L('/tarefas', '🗂️', 'Todas as tarefas')}
          {L('/rotinas', '🔁', 'Rotinas')}
          {L('/cadastros', '👥', 'Cadastros')}
          {L('/historico', '🕓', 'Histórico')}
          <div className="navsep"><span className="t">MÓDULO FINANCEIRO</span></div>
          {L('/financeiro', '💰', 'Financeiro', vencidos)}
        </>
      )}
    </>
  );
}
