import Link from 'next/link';
import { STATUS } from '@/lib/format';
import { ATALHOS } from '@/lib/tarefas';

type Op = { id: number; nome: string };
export type Busca = { dep?: string; titulo?: string; status?: string; q?: string; atalho?: string; operador?: string };

/** Barra de filtros (GET) usada em Minhas tarefas, Todas as tarefas e Financeiro. */
export function FiltrosTarefas({ sp, deps, titulos, operadores, base, total }: {
  sp: Busca; deps?: Op[]; titulos?: { titulo: string; abertas: number }[]; operadores?: Op[]; base: string; total: number;
}) {
  const algum = sp.dep || sp.titulo || sp.status || sp.q || sp.atalho || sp.operador;
  return (
    <form className="filtros" action={base}>
      {sp.atalho && <input type="hidden" name="atalho" value={sp.atalho} />}
      {deps && (
        <select name="dep" defaultValue={sp.dep || ''}>
          <option value="">Todos os departamentos</option>
          {deps.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
        </select>
      )}
      {titulos && (
        <select name="titulo" defaultValue={sp.titulo || ''}>
          <option value="">Todas as tarefas</option>
          {titulos.map((t) => <option key={t.titulo} value={t.titulo}>{t.titulo} ({t.abertas})</option>)}
        </select>
      )}
      {operadores && (
        <select name="operador" defaultValue={sp.operador || ''}>
          <option value="">Todos os responsáveis</option>
          {operadores.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
      )}
      <select name="status" defaultValue={sp.status || ''}>
        <option value="">Em aberto</option>
        {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        <option value="todas">Todos os status</option>
      </select>
      <input name="q" placeholder="🔎 Buscar empresa, CNPJ ou tarefa" defaultValue={sp.q || ''} style={{ minWidth: 230 }} />
      <button className="btn sm">Filtrar</button>
      {algum && <Link className="btn sm gh" href={base}>✕ Limpar</Link>}
      {sp.atalho && ATALHOS[sp.atalho] && <span className="chip">Filtro: <b>{ATALHOS[sp.atalho].rotulo}</b></span>}
      <span className="mut right" style={{ alignSelf: 'center' }}>{total} tarefa(s)</span>
    </form>
  );
}

export function urlAtual(base: string, sp: Record<string, string | undefined>) {
  const u = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== 'm') as [string, string][]);
  return `${base}${u.size ? `?${u}` : ''}`;
}
