import Link from 'next/link';
import { notFound } from 'next/navigation';
import { exigirGestor } from '@/lib/auth';
import { q, q1 } from '@/lib/db';
import { fmtDataHora } from '@/lib/format';
import { listarTarefas } from '@/lib/tarefas';
import { TaskTable } from '@/components/TaskTable';

export const metadata = { title: 'EcommFlow · Equipe' };

const ABAS = { abertas: 'Em aberto', aconf: 'A conferir', conf: '✔ Conferidas', todas: 'Todas' } as const;

export default async function Pessoa({ params, searchParams }: { params: { id: string }; searchParams: { aba?: keyof typeof ABAS } }) {
  const s = await exigirGestor();
  const id = parseInt(params.id);
  if (!Number.isFinite(id)) notFound();
  const o = await q1<{ nome: string; perfil: string; empresas: number }>(
    'SELECT nome, perfil, (SELECT count(*) FROM clientes WHERE operador_padrao = o.id AND ativo) AS empresas FROM operadores o WHERE id = $1 AND escritorio_id = $2', [id, s.esc]);
  if (!o) notFound();
  const aba = searchParams.aba && ABAS[searchParams.aba] ? searchParams.aba : 'abertas';
  const filtro = aba === 'abertas' ? {} : aba === 'todas' ? { status: 'todas' } : { atalho: aba };
  const [tarefas, cont, hist] = await Promise.all([
    listarTarefas(s, { operador: id, ...filtro }),
    q1<Record<string, number>>(
      `SELECT count(*) FILTER (WHERE t.status NOT IN ('concluida','cancelada')) AS abertas,
              count(*) FILTER (WHERE t.status = 'concluida' AND t.conferida_por IS NULL) AS aconf,
              count(*) FILTER (WHERE t.conferida_por IS NOT NULL) AS conf, count(*) AS todas,
              count(*) FILTER (WHERE t.status = 'atrasada') AS atr,
              count(*) FILTER (WHERE t.status IN ('pendente','em_andamento') AND t.prazo = CURRENT_DATE) AS hoje
         FROM tarefas t JOIN departamentos d ON d.id = t.departamento_id WHERE t.operador_id = $1 AND NOT d.restrito_gestor`, [id]),
    q<{ registrado_em: string; acao: string; detalhe: string | null; titulo: string; status_novo: string | null }>(
      `SELECT h.registrado_em, h.acao, h.detalhe, t.titulo, h.status_novo FROM historico_tarefas h JOIN tarefas t ON t.id = h.tarefa_id
        WHERE h.operador_id = $1 ORDER BY h.registrado_em DESC LIMIT 15`, [id]),
  ]);
  return (
    <>
      <div className="filtros"><Link className="btn gh" href="/equipe">← Voltar à equipe</Link></div>
      <div className="card" style={{ marginBottom: 12, display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--pri)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700 }}>{o.nome[0]}</div>
        <div><h3 style={{ margin: 0 }}>{o.nome}</h3><span className="desc">{o.perfil} · {o.empresas} empresas</span></div>
        <div style={{ display: 'flex', gap: 22, marginLeft: 'auto', flexWrap: 'wrap' }}>
          {([['Em aberto', cont?.abertas, ''], ['Vencem hoje', cont?.hoje, 'var(--bad)'], ['Atrasadas', cont?.atr, 'var(--bad)'], ['A conferir', cont?.aconf, '#ca8a04'], ['Conferidas', cont?.conf, 'var(--ok)']] as const).map(([l, v, c]) => (
            <div key={l}><div className="desc">{l}</div><div style={{ fontSize: 22, fontWeight: 700, color: c || undefined }}>{v ?? 0}</div></div>
          ))}
        </div>
      </div>
      <div className="tabs">
        {Object.entries(ABAS).map(([k, l]) => <Link key={k} className={aba === k ? 'on' : ''} href={`/equipe/${id}?aba=${k}`}>{l} ({cont?.[k] ?? 0})</Link>)}
      </div>
      <TaskTable tarefas={tarefas} sessao={s} back={`/equipe/${id}?aba=${aba}`} />
      <div className="card" style={{ marginTop: 12 }}>
        <h3>Últimas ações de {o.nome}</h3>
        <table><tbody>
          {hist.length ? hist.map((h, i) => <tr key={i}><td className="desc">{fmtDataHora(h.registrado_em)}</td><td>{h.acao}{h.detalhe ? `: ${h.detalhe}` : h.status_novo ? ` → ${h.status_novo}` : ''}</td><td>{h.titulo}</td></tr>)
            : <tr><td className="mut">Nenhuma ação registrada.</td></tr>}
        </tbody></table>
      </div>
    </>
  );
}
