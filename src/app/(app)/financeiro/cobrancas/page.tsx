import Link from 'next/link';
import { exigirGestor } from '@/lib/auth';
import { q } from '@/lib/db';
import { brl, fmtData } from '@/lib/format';
import { alternarCobranca } from '@/app/actions/financeiro';
import { Cobranca, SQL_COBRANCAS } from '@/lib/cobrancas';

export const metadata = { title: 'EcommFlow · Cobranças' };

export default async function Cobrancas({ searchParams: sp }: { searchParams: { q?: string } }) {
  const s = await exigirGestor();
  const C = await q<Cobranca>(
    `${SQL_COBRANCAS} AND ($2 = '' OR c.razao_social ILIKE '%' || $2 || '%' OR c.cnpj ILIKE '%' || $2 || '%')
     GROUP BY r.cobranca_id, r.cliente_id, c.razao_social, c.cnpj ORDER BY c.razao_social`, [s.esc, sp.q || '']);
  const ativas = C.filter((c) => c.ativa && c.tipo === 'mensal');
  return (
    <>
      <form className="filtros">
        <Link className="btn" href="/financeiro/cobrancas/nova">+ Novo cliente / boleto</Link>
        <input name="q" placeholder="🔎 Buscar empresa ou CNPJ" defaultValue={sp.q || ''} />
        <button className="btn sm">Buscar</button>
        <span className="mut right" style={{ alignSelf: 'center' }}>{ativas.length} cobranças mensais ativas · {brl(ativas.reduce((a, c) => a + c.valor, 0))}/mês</span>
      </form>
      <div className="card tblwrap"><table>
        <thead><tr><th>Empresa</th><th>CNPJ/CPF</th><th>Tipo</th><th>Valor</th><th>Vencimento</th><th>Gerar / Enviar</th><th>Responsável</th><th>Status</th><th>Ações</th></tr></thead>
        <tbody>{C.map((c) => (
          <tr key={c.cobranca_id} style={c.ativa ? undefined : { opacity: 0.55 }}>
            <td>{c.razao_social}{c.observacao && <div className="desc">{c.observacao}</div>}</td><td style={{ whiteSpace: 'nowrap' }}>{c.cnpj || '—'}</td>
            <td>{c.tipo === 'mensal' ? '🔁 Mensal' : '1️⃣ Avulso'}</td><td style={{ whiteSpace: 'nowrap' }}>{brl(c.valor)}</td>
            <td>{c.tipo === 'mensal' ? `dia ${c.dia_vencimento}` : fmtData(c.data_vencimento)}</td>
            <td>{c.tipo === 'mensal' ? `dia ${c.dia_gerar} / dia ${c.dia_enviar}` : fmtData(c.data_gerar)}</td>
            <td>{c.responsavel}</td>
            <td>{c.tipo === 'avulso' ? <span className="tag pendente">{c.situacao_avulso === 'recebido' ? 'Recebido' : c.situacao_avulso === 'nao_gerado' ? 'Não gerado' : 'Gerado'}</span>
              : <span className={`tag ${c.ativa ? 'concluida' : 'pendente'}`}>{c.ativa ? 'Ativa' : 'Pausada'}</span>}</td>
            <td style={{ whiteSpace: 'nowrap' }}>
              <Link className="btn sm gh" href={`/financeiro/cobrancas/${c.cobranca_id}`}>✎ Editar</Link>{' '}
              {c.tipo === 'mensal' && (
                <form action={alternarCobranca} className="inline"><input type="hidden" name="cobranca" value={c.cobranca_id} /><input type="hidden" name="back" value="/financeiro/cobrancas" />
                  <button className="btn sm gh">{c.ativa ? '⏸ Pausar' : '▶ Retomar'}</button></form>
              )}
            </td>
          </tr>))}
        </tbody></table></div>
    </>
  );
}
