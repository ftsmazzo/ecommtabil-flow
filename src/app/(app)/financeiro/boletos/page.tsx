import { exigirGestor } from '@/lib/auth';
import { q } from '@/lib/db';
import { brl, fmtComp, fmtData, SITUACAO_BOLETO } from '@/lib/format';
import { receberBoleto } from '@/app/actions/financeiro';

export const metadata = { title: 'EcommFlow · Boletos' };
const COR: Record<string, string> = { recebido: 'rec', a_receber: 'arec', vencido: 'venc', nao_gerado: 'ng' };

export default async function Boletos({ searchParams: sp }: { searchParams: { comp?: string; sit?: string; q?: string } }) {
  const s = await exigirGestor();
  const comps = await q<{ comp: string }>('SELECT DISTINCT competencia AS comp FROM boletos WHERE escritorio_id = $1 ORDER BY 1', [s.esc]);
  const B = await q<{ id: number; razao_social: string; cnpj: string | null; valor: number; vencimento: string; gerado_em: string | null; enviado_em: string | null; arquivo_pdf: string | null; divergencia: string | null; pago_em: string | null; situacao: string }>(
    `SELECT id, razao_social, cnpj, valor, vencimento, gerado_em, enviado_em, arquivo_pdf, divergencia, pago_em, situacao FROM vw_boletos
      WHERE escritorio_id = $1 AND ($2 = '' OR competencia = NULLIF($2,'')::date) AND ($3 = '' OR situacao = $3) AND ($4 = '' OR razao_social ILIKE '%' || $4 || '%')
      ORDER BY vencimento, razao_social`, [s.esc, sp.comp && sp.comp !== 'todas' ? sp.comp : '', sp.sit || '', sp.q || '']);
  const back = `/financeiro/boletos?${new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== 'm') as [string, string][])}`;
  return (
    <>
      <form className="filtros">
        <select name="comp" defaultValue={sp.comp || ''}><option value="">Todos os meses</option>{comps.map((c) => <option key={c.comp} value={c.comp}>Vencimento {fmtComp(c.comp)}</option>)}</select>
        <select name="sit" defaultValue={sp.sit || ''}><option value="">Todas as situações</option>{Object.entries(SITUACAO_BOLETO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <input name="q" placeholder="🔎 Buscar empresa" defaultValue={sp.q || ''} />
        <button className="btn sm">Filtrar</button>
        <span className="mut right" style={{ alignSelf: 'center' }}>{B.length} boleto(s) · {brl(B.reduce((a, b) => a + b.valor, 0))}</span>
      </form>
      <div className="card tblwrap"><table>
        <thead><tr><th>Empresa</th><th>Valor</th><th>Vencimento</th><th>Gerado</th><th>Enviado</th><th>Situação</th><th>Ação</th></tr></thead>
        <tbody>{B.map((b) => (
          <tr key={b.id}>
            <td>{b.razao_social}{b.divergencia && <div className="desc" style={{ color: '#b45309' }}>⚠ {b.divergencia}</div>}</td>
            <td style={{ whiteSpace: 'nowrap' }}>{brl(b.valor)}</td><td>{fmtData(b.vencimento)}</td>
            <td>{b.gerado_em ? '✔' : <span className="desc">—</span>}</td>
            <td>{b.enviado_em ? <>✔ {b.arquivo_pdf && <span className="desc" title={b.arquivo_pdf}>📎 PDF</span>}</> : <span className="desc">—</span>}</td>
            <td><span className={`sit ${COR[b.situacao]}`}>{SITUACAO_BOLETO[b.situacao]}</span>{b.pago_em && <div className="desc">em {fmtData(b.pago_em)}</div>}</td>
            <td style={{ whiteSpace: 'nowrap' }}>
              {b.gerado_em && !b.pago_em && (
                <form action={receberBoleto} className="inline" style={{ display: 'inline-flex', gap: 4 }}>
                  <input type="hidden" name="id" value={b.id} /><input type="hidden" name="back" value={back} />
                  <input type="date" name="data" title="Data do recebimento (padrão: hoje)" style={{ padding: '3px 6px', fontSize: 12 }} />
                  <button className="btn sm" style={{ background: 'var(--ok)' }}>✔ Recebido</button>
                </form>
              )}
              {b.pago_em && (
                <form action={receberBoleto} className="inline"><input type="hidden" name="id" value={b.id} /><input type="hidden" name="desfazer" value="true" /><input type="hidden" name="back" value={back} />
                  <button className="btn sm gh">↺ Desfazer</button></form>
              )}
            </td>
          </tr>))}
        </tbody></table></div>
    </>
  );
}
