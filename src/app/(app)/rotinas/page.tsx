import Link from 'next/link';
import { exigirGestor } from '@/lib/auth';
import { q } from '@/lib/db';
import { fmtData } from '@/lib/format';
import { alternarRotina } from '@/app/actions/tarefas';

export const metadata = { title: 'EcommFlow · Rotinas' };
const SEM = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

export default async function Rotinas({ searchParams: sp }: { searchParams: { q?: string; titulo?: string } }) {
  const s = await exigirGestor();
  const R = await q<{ id: number; titulo: string; departamento: string; cliente: string | null; responsavel: string | null; periodicidade: string; dia_mes: number | null; dia_semana: number | null; ativa: boolean; exige_conferencia: boolean; etapas: number; proximo: string | null }>(
    `SELECT r.id, r.titulo, d.nome AS departamento, c.razao_social AS cliente, COALESCE(o.nome, op.nome) AS responsavel,
            r.periodicidade, r.dia_mes, r.dia_semana, r.ativa, r.exige_conferencia,
            (SELECT count(*) FROM rotina_etapas e WHERE e.rotina_id = r.id) AS etapas,
            CASE WHEN r.ativa THEN proximo_prazo(r, CURRENT_DATE) END AS proximo
       FROM rotinas r JOIN departamentos d ON d.id = r.departamento_id
       LEFT JOIN clientes c ON c.id = r.cliente_id LEFT JOIN operadores o ON o.id = r.operador_id LEFT JOIN operadores op ON op.id = c.operador_padrao
      WHERE r.escritorio_id = $1 AND NOT d.restrito_gestor AND ($2 = '' OR c.razao_social ILIKE '%' || $2 || '%' OR r.titulo ILIKE '%' || $2 || '%')
        AND ($3 = '' OR r.titulo = $3)
      ORDER BY r.titulo, c.razao_social`, [s.esc, sp.q || '', sp.titulo || '']);
  const titulos = [...new Set(R.map((r) => r.titulo))];
  const rec = (r: (typeof R)[0]) =>
    r.periodicidade === 'mensal' ? `Mensal, dia ${r.dia_mes}` : r.periodicidade === 'semanal' ? `Semanal, ${SEM[r.dia_semana ?? 1]}`
      : r.periodicidade === 'diaria' ? 'Diária (dias úteis)' : `${r.periodicidade[0].toUpperCase()}${r.periodicidade.slice(1)}, dia ${r.dia_mes}`;
  return (
    <>
      <h2 style={{ margin: '0 0 14px' }}>Rotinas recorrentes</h2>
      <form className="filtros">
        <select name="titulo" defaultValue={sp.titulo || ''}><option value="">Todas as rotinas</option>{titulos.map((t) => <option key={t}>{t}</option>)}</select>
        <input name="q" placeholder="🔎 Buscar empresa ou rotina" defaultValue={sp.q || ''} />
        <button className="btn sm">Filtrar</button>
        <span className="mut right" style={{ alignSelf: 'center' }}>{R.filter((r) => r.ativa).length} ativas · {R.filter((r) => !r.ativa).length} pausadas · nova rotina em <b>+ Nova tarefa → Recorrente</b></span>
      </form>
      <div className="card tblwrap"><table>
        <thead><tr><th>Rotina</th><th>Depto</th><th>Cliente</th><th>Responsável</th><th>Recorrência</th><th>Próxima</th><th>Status</th><th>Ações</th></tr></thead>
        <tbody>
          {R.map((r) => (
            <tr key={r.id} style={r.ativa ? undefined : { opacity: 0.55 }}>
              <td>{r.exige_conferencia ? '🔎 ' : ''}{r.titulo}{r.etapas > 0 && <div className="desc">{r.etapas} etapas</div>}</td>
              <td><span className="tag dep">{r.departamento}</span></td><td>{r.cliente || 'Interna'}</td><td>{r.responsavel || '—'}</td>
              <td>{rec(r)}</td><td>{fmtData(r.proximo)}</td>
              <td><span className={`tag ${r.ativa ? 'concluida' : 'pendente'}`}>{r.ativa ? 'Ativa' : 'Pausada'}</span></td>
              <td style={{ whiteSpace: 'nowrap' }}>
                <Link className="btn sm gh" href={`/rotinas/${r.id}`}>✎ Editar</Link>{' '}
                <form action={alternarRotina} className="inline"><input type="hidden" name="id" value={r.id} /><input type="hidden" name="back" value="/rotinas" />
                  <button className="btn sm gh">{r.ativa ? '⏸ Pausar' : '▶ Retomar'}</button></form>
              </td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </>
  );
}
