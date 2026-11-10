import { notFound } from 'next/navigation';
import { exigirGestor } from '@/lib/auth';
import { q, q1 } from '@/lib/db';
import { clientesOpcoes } from '@/lib/tarefas';
import { salvarCobranca } from '@/app/actions/financeiro';
import { Cobranca, SQL_COBRANCAS } from '@/lib/cobrancas';
import { CobrancaCampos } from './CobrancaCampos';

export const metadata = { title: 'EcommFlow · Cobrança' };

export default async function EditarCobranca({ params }: { params: { id: string } }) {
  const s = await exigirGestor();
  const nova = params.id === 'nova';
  const id = nova ? null : parseInt(params.id);
  if (!nova && !Number.isFinite(id)) notFound();
  const c = nova ? null : await q1<Cobranca>(`${SQL_COBRANCAS} AND r.cobranca_id = $2 GROUP BY r.cobranca_id, r.cliente_id, c.razao_social, c.cnpj`, [s.esc, id]);
  if (!nova && !c) notFound();
  const [gestores, clientes] = await Promise.all([
    q<{ id: number; nome: string }>("SELECT id, nome FROM operadores WHERE escritorio_id = $1 AND ativo AND perfil = 'gestor' ORDER BY nome", [s.esc]),
    clientesOpcoes(s),
  ]);
  const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
  return (
    <form action={salvarCobranca} className="card form">
      <h3>{nova ? 'Novo cliente / boleto' : `Editar cobrança · ${c!.razao_social}`}</h3>
      {id && <input type="hidden" name="cobranca" value={id} />}
      <input type="hidden" name="back" value={nova ? '/financeiro/cobrancas/nova' : `/financeiro/cobrancas/${id}`} />
      <CobrancaCampos nova={nova} clientes={clientes} tipoInicial={c?.tipo ?? 'mensal'} hoje={hoje} />
      <div className="row">
        <div><label>Valor do boleto (R$) *</label><input name="valor" required inputMode="decimal" placeholder="0,00" defaultValue={c ? c.valor.toFixed(2).replace('.', ',') : ''} /></div>
        <div><label>Responsável</label><select name="responsavel" defaultValue={c?.operador_id ?? s.id}>{gestores.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}</select></div>
      </div>
      {(!c || c.tipo === 'mensal') && (
        <div className="row" data-tipo="mensal">
          <div><label>Vencimento do boleto (dia)</label><input type="number" name="dia_vencimento" min={1} max={31} defaultValue={c?.dia_vencimento ?? 10} /></div>
          <div><label>Gerar boleto (dia)</label><input type="number" name="dia_gerar" min={1} max={31} defaultValue={c?.dia_gerar ?? 5} /></div>
          <div><label>Enviar boleto (dia)</label><input type="number" name="dia_enviar" min={1} max={31} defaultValue={c?.dia_enviar ?? 5} /></div>
        </div>
      )}
      <label>Observação</label><input name="observacao" defaultValue={c?.observacao ?? ''} placeholder="Ex.: mensalidade contábil, honorário extra…" />
      {!nova && (
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--tx)' }}>
          <input type="checkbox" name="aplicar" defaultChecked style={{ width: 'auto' }} /> Atualizar também o boleto e as tarefas em aberto
        </label>
      )}
      <button className="btn" style={{ marginTop: 16 }}>Salvar</button>
    </form>
  );
}
