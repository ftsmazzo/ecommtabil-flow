import { notFound } from 'next/navigation';
import { exigirGestor } from '@/lib/auth';
import { q, q1 } from '@/lib/db';
import { RAMOS, REGIMES } from '@/lib/format';
import { pessoas } from '@/lib/tarefas';
import { salvarCliente } from '@/app/actions/cadastros';

export const metadata = { title: 'EcommFlow · Cliente' };

export default async function Cliente({ params }: { params: { id: string } }) {
  const s = await exigirGestor();
  const novo = params.id === 'novo';
  const id = novo ? null : parseInt(params.id);
  if (!novo && !Number.isFinite(id)) notFound();
  const c = novo ? null : await q1<Record<string, any>>(
    `SELECT c.*, g.nome AS grupo FROM clientes c LEFT JOIN grupos g ON g.id = c.grupo_id WHERE c.id = $1 AND c.escritorio_id = $2`, [id, s.esc]);
  if (!novo && !c) notFound();
  const [ops, grupos] = await Promise.all([pessoas(s), q<{ nome: string }>('SELECT nome FROM grupos WHERE escritorio_id = $1 ORDER BY nome', [s.esc])]);
  return (
    <>
      <h2 style={{ margin: '0 0 14px' }}>{novo ? 'Novo cliente' : 'Editar cliente'}</h2>
      <form action={salvarCliente} className="card form">
        {id && <input type="hidden" name="id" value={id} />}
        <input type="hidden" name="back" value={novo ? '/cadastros/clientes/novo' : `/cadastros/clientes/${id}`} />
        <label>Razão social *</label><input name="razao_social" required defaultValue={c?.razao_social} />
        <div className="row">
          <div><label>CNPJ ou CPF *</label><input name="cnpj" required maxLength={18} defaultValue={c?.cnpj ?? ''} placeholder="00.000.000/0000-00" /></div>
          <div><label>Cód. Alter</label><input name="cod_alter" defaultValue={c?.cod_alter ?? ''} /></div>
        </div>
        <label>Grupo <span className="desc">(escolha um existente ou digite um novo)</span></label>
        <input name="grupo" list="grupos" defaultValue={c?.grupo ?? ''} placeholder="Sem grupo" />
        <datalist id="grupos">{grupos.map((g) => <option key={g.nome} value={g.nome} />)}</datalist>
        <div className="row">
          <div><label>Ramo</label><select name="ramo" defaultValue={c?.ramo ?? ''}><option value="">—</option>{RAMOS.map((r) => <option key={r}>{r}</option>)}</select></div>
          <div><label>Regime</label><select name="regime" defaultValue={c?.regime ?? 'Simples Nacional'}>{REGIMES.map((r) => <option key={r}>{r}</option>)}</select></div>
        </div>
        <div className="row">
          <div><label>Entrada no escritório</label><input type="month" name="entrada" defaultValue={c?.entrada_escritorio?.slice(0, 7) ?? ''} /></div>
          <div><label>Responsável</label><select name="operador" defaultValue={c?.operador_padrao ?? ''}><option value="">Sem responsável</option>{ops.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}</select></div>
        </div>
        <label>Contato para envio de documentos</label><input name="contato" defaultValue={c?.contato_documentos ?? ''} placeholder="E-mail ou WhatsApp" />
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--tx)' }}><input type="checkbox" name="ativo" defaultChecked={c ? c.ativo : true} style={{ width: 'auto' }} /> Cliente ativo</label>
        <button className="btn" style={{ marginTop: 16 }}>Salvar</button>
      </form>
    </>
  );
}
