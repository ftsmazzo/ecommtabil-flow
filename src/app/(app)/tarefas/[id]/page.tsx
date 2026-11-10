import { notFound } from 'next/navigation';
import { exigirUsuario } from '@/lib/auth';
import { q, q1 } from '@/lib/db';
import { fmtDataHora, STATUS } from '@/lib/format';
import { listarTarefas, pessoas } from '@/lib/tarefas';
import { TaskTable } from '@/components/TaskTable';
import { transferir } from '@/app/actions/tarefas';

export const metadata = { title: 'EcommFlow · Tarefa' };

export default async function Detalhe({ params }: { params: { id: string } }) {
  const s = await exigirUsuario();
  const id = parseInt(params.id);
  if (!Number.isFinite(id)) notFound();
  const meta = await q1<{ restrito: boolean; operador_id: number }>(
    'SELECT d.restrito_gestor AS restrito, t.operador_id FROM tarefas t JOIN departamentos d ON d.id = t.departamento_id WHERE t.id = $1 AND t.escritorio_id = $2',
    [id, s.esc]);
  if (!meta || (meta.restrito && s.perfil !== 'gestor')) notFound();
  const [t] = await listarTarefas(s, { id, status: 'todas', financeiro: meta.restrito });
  if (!t) notFound();
  const podeMexer = s.perfil === 'gestor' || t.operador_id === s.id;
  const [hist, ops] = await Promise.all([
    q<{ registrado_em: string; quem: string | null; acao: string; status_anterior: string | null; status_novo: string | null; detalhe: string | null }>(
      `SELECT h.registrado_em, o.nome AS quem, h.acao, h.status_anterior, h.status_novo, h.detalhe
         FROM historico_tarefas h LEFT JOIN operadores o ON o.id = h.operador_id WHERE h.tarefa_id = $1 ORDER BY h.registrado_em DESC, h.id DESC`, [id]),
    pessoas(s),
  ]);
  const destinos = ops.filter((o) => o.id !== t.operador_id && (!t.restrito || o.perfil === 'gestor'));
  return (
    <>
      <h2 style={{ margin: '0 0 14px' }}>{t.titulo}</h2>
      <TaskTable tarefas={[t]} sessao={s} back={`/tarefas/${id}`} />
      <div className="grid2" style={{ marginTop: 12 }}>
        <div className="card" id="transferir">
          <h3>{s.perfil === 'gestor' ? 'Reatribuir' : 'Transferir'} tarefa</h3>
          {podeMexer && t.status !== 'concluida' ? (
            <form action={transferir} className="form">
              <input type="hidden" name="id" value={t.id} /><input type="hidden" name="back" value={`/tarefas/${id}`} />
              <p className="mut">Responsável atual: <b>{t.responsavel}</b></p>
              <label>Novo responsável</label>
              <select name="para" required defaultValue="">
                <option value="" disabled>Selecione…</option>
                {['gestor', 'operador'].map((p) => (
                  <optgroup key={p} label={p === 'gestor' ? 'Gestores' : 'Operadores'}>
                    {destinos.filter((o) => o.perfil === p).map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
                  </optgroup>
                ))}
              </select>
              <label>Motivo (opcional)</label><input name="motivo" maxLength={300} />
              <button className="btn" style={{ marginTop: 12 }}>Transferir</button>
            </form>
          ) : <p className="mut">Esta tarefa não pode ser transferida por você.</p>}
        </div>
        <div className="card">
          <h3>Histórico</h3>
          <div className="tblwrap" style={{ maxHeight: 360, overflow: 'auto' }}><table><tbody>
            {hist.map((h, i) => (
              <tr key={i}><td className="desc" style={{ whiteSpace: 'nowrap' }}>{fmtDataHora(h.registrado_em)}</td><td>{h.quem || 'Sistema'}</td>
                <td>{h.acao === 'status' ? `${STATUS[h.status_anterior || ''] || ''} → ${STATUS[h.status_novo || '']}` : h.acao === 'criada' ? 'Criada' : `${h.acao}: ${h.detalhe || ''}`}</td></tr>
            ))}
          </tbody></table></div>
        </div>
      </div>
    </>
  );
}
