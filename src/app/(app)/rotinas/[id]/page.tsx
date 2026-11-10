import { notFound } from 'next/navigation';
import { exigirGestor } from '@/lib/auth';
import { q, q1 } from '@/lib/db';
import { departamentos, pessoas } from '@/lib/tarefas';
import { salvarRotina } from '@/app/actions/tarefas';

export const metadata = { title: 'EcommFlow · Editar rotina' };

export default async function EditarRotina({ params }: { params: { id: string } }) {
  const s = await exigirGestor();
  const id = parseInt(params.id);
  if (!Number.isFinite(id)) notFound();
  const r = await q1<{ titulo: string; departamento_id: number; operador_id: number | null; dia_mes: number | null; prioridade: string; exige_conferencia: boolean; descricao: string | null; ativa: boolean; cliente: string | null }>(
    `SELECT r.*, c.razao_social AS cliente FROM rotinas r LEFT JOIN clientes c ON c.id = r.cliente_id
      JOIN departamentos d ON d.id = r.departamento_id WHERE r.id = $1 AND r.escritorio_id = $2 AND NOT d.restrito_gestor`, [id, s.esc]);
  if (!r) notFound();
  const [deps, ops, etapas] = await Promise.all([departamentos(s), pessoas(s), q<{ nome: string }>('SELECT nome FROM rotina_etapas WHERE rotina_id = $1 ORDER BY ordem', [id])]);
  return (
    <>
      <h2 style={{ margin: '0 0 14px' }}>Editar rotina</h2>
      <form action={salvarRotina} className="card form">
        <input type="hidden" name="id" value={id} /><input type="hidden" name="back" value={`/rotinas/${id}`} />
        <p className="mut">Cliente: <b>{r.cliente || 'Interna'}</b></p>
        <label>Título *</label><input name="titulo" required defaultValue={r.titulo} />
        <div className="row">
          <div><label>Departamento</label><select name="departamento" defaultValue={r.departamento_id}>{deps.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}</select></div>
          <div><label>Responsável</label><select name="responsavel" defaultValue={r.operador_id ?? ''}><option value="">Responsável padrão do cliente</option>{ops.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}</select></div>
        </div>
        <div className="row">
          <div><label>Dia do mês</label><input type="number" name="dia_mes" min={1} max={31} defaultValue={r.dia_mes ?? ''} /></div>
          <div><label>Prioridade</label><select name="prioridade" defaultValue={r.prioridade}><option value="alta">Alta</option><option value="media">Média</option><option value="baixa">Baixa</option></select></div>
        </div>
        <label>Descrição</label><input name="descricao" defaultValue={r.descricao ?? ''} />
        <label>Etapas / checklist <span className="desc">(uma por linha)</span></label>
        <textarea name="etapas" rows={4} defaultValue={etapas.map((e) => e.nome).join('\n')} />
        {[['exige_conferencia', '🔎 Exige conferência do gestor', r.exige_conferencia], ['ativa', 'Rotina ativa', r.ativa], ['aplicar', 'Aplicar também às tarefas em aberto desta rotina', true]].map(([n, l, v]) => (
          <label key={n as string} style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--tx)' }}>
            <input type="checkbox" name={n as string} defaultChecked={v as boolean} style={{ width: 'auto' }} /> {l as string}
          </label>
        ))}
        <button className="btn" style={{ marginTop: 16 }}>Salvar</button>
      </form>
    </>
  );
}
