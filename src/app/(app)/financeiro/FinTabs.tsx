'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ABAS = [
  ['/financeiro', '📊 Painel'],
  ['/financeiro/boletos', '🧾 Boletos'],
  ['/financeiro/cobrancas', '👥 Clientes de cobrança'],
  ['/financeiro/tarefas', '✅ Tarefas'],
  ['/financeiro/conciliacao', '📎 Conciliar PDFs'],
];

export function FinTabs() {
  const p = usePathname();
  return (
    <div className="tabs">
      {ABAS.map(([h, l]) => <Link key={h} href={h} className={(h === '/financeiro' ? p === h : p.startsWith(h)) ? 'on' : ''}>{l}</Link>)}
    </div>
  );
}
