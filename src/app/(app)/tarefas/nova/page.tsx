import { exigirUsuario } from '@/lib/auth';
import { clientesOpcoes, departamentos, pessoas } from '@/lib/tarefas';
import { criarTarefa } from '@/app/actions/tarefas';
import { TipoTarefa } from './TipoTarefa';

export const metadata = { title: 'EcommFlow · Nova tarefa' };

export default async function Nova() {
  const s = await exigirUsuario();
  const [deps, ops, clientes] = await Promise.all([departamentos(s, true), pessoas(s), clientesOpcoes(s)]);
  const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
  return (
    <>
      <h2 style={{ margin: '0 0 14px' }}>Nova tarefa</h2>
      <form action={criarTarefa} className="card form">
        <input type="hidden" name="back" value="/tarefas/nova" />
        <TipoTarefa hoje={hoje} />
        <label>Título *</label><input name="titulo" required maxLength={160} placeholder="Ex.: Revisar apuração ICMS" />
        <label>Descrição / instruções</label><input name="descricao" maxLength={500} />
        <div className="row">
          <div><label>Departamento *</label>
            <select name="departamento" required defaultValue=""><option value="" disabled>Selecione…</option>
              {deps.map((d) => <option key={d.id} value={d.id}>{d.nome}{d.restrito_gestor ? ' (gestores)' : ''}</option>)}</select></div>
          <div><label>Atribuir para *</label>
            <select name="responsavel" required defaultValue={s.id}>
              {['gestor', 'operador'].map((p) => (
                <optgroup key={p} label={p === 'gestor' ? 'Gestores' : 'Operadores'}>
                  {ops.filter((o) => o.perfil === p).map((o) => <option key={o.id} value={o.id}>{o.nome}{o.id === s.id ? ' (eu)' : ''}</option>)}
                </optgroup>
              ))}
            </select></div>
        </div>
        <label>Cliente</label>
        <select name="cliente" defaultValue=""><option value="">Interna (sem cliente)</option>
          {clientes.map((c) => <option key={c.id} value={c.id}>{c.razao_social}{c.grupo ? ` [${c.grupo}]` : ''}</option>)}</select>
        <label>Prioridade</label>
        <select name="prioridade" defaultValue="media"><option value="media">Média</option><option value="alta">Alta</option><option value="baixa">Baixa</option></select>
        <label>Etapas / checklist <span className="desc">(opcional, uma por linha)</span></label>
        <textarea name="etapas" rows={3} placeholder="Ex.: Importar Notas" />
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--tx)' }}>
          <input type="checkbox" name="exige_conferencia" style={{ width: 'auto' }} /> 🔎 Exige conferência do gestor após concluída
        </label>
        <button className="btn" style={{ marginTop: 16 }}>Salvar tarefa</button>
      </form>
    </>
  );
}
