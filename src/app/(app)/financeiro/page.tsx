import Link from 'next/link';
import { exigirGestor } from '@/lib/auth';
import { q, q1 } from '@/lib/db';
import { brl, fmtComp, fmtData } from '@/lib/format';

export const metadata = { title: 'EcommFlow · Financeiro' };

export default async function Painel({ searchParams }: { searchParams: { comp?: string } }) {
  const s = await exigirGestor();
  const comps = await q<{ comp: string }>('SELECT DISTINCT competencia AS comp FROM boletos WHERE escritorio_id = $1 ORDER BY 1', [s.esc]);
  const atual = await q1<{ c: string }>("SELECT date_trunc('month', CURRENT_DATE)::date AS c");
  // Padrão: competência mais recente até o mês atual
  const passadas = comps.filter((c) => c.comp <= (atual?.c ?? ''));
  const comp = searchParams.comp ?? (passadas.length ? passadas[passadas.length - 1].comp : comps[0]?.comp ?? '');
  const P = [s.esc, comp === 'todas' ? null : comp || null];
  const W = 'escritorio_id = $1 AND ($2::date IS NULL OR competencia = $2::date)';
  const [k, vencidos, porVenc] = await Promise.all([
    q1<Record<string, number>>(
      `SELECT count(*) AS previstos, count(*) FILTER (WHERE gerado_em IS NOT NULL) AS gerados, count(*) FILTER (WHERE enviado_em IS NOT NULL) AS enviados,
              COALESCE(sum(valor) FILTER (WHERE gerado_em IS NOT NULL), 0) AS v_gerado,
              COALESCE(sum(COALESCE(valor_pago, valor)) FILTER (WHERE situacao = 'recebido'), 0) AS v_rec, count(*) FILTER (WHERE situacao = 'recebido') AS n_rec,
              COALESCE(sum(valor) FILTER (WHERE situacao = 'a_receber'), 0) AS v_arec, count(*) FILTER (WHERE situacao = 'a_receber') AS n_arec,
              COALESCE(sum(valor) FILTER (WHERE situacao = 'vencido'), 0) AS v_venc, count(*) FILTER (WHERE situacao = 'vencido') AS n_venc
         FROM vw_boletos WHERE ${W}`, P),
    q<{ id: number; razao_social: string; valor: number; vencimento: string; dias: number }>(
      `SELECT id, razao_social, valor, vencimento, CURRENT_DATE - vencimento AS dias FROM vw_boletos WHERE ${W} AND situacao = 'vencido' ORDER BY valor DESC LIMIT 8`, P),
    q<{ vencimento: string; n: number; total: number; rec: number }>(
      `SELECT vencimento, count(*) AS n, sum(valor) AS total, COALESCE(sum(valor) FILTER (WHERE pago_em IS NOT NULL), 0) AS rec FROM vw_boletos WHERE ${W} GROUP BY 1 ORDER BY 1`, P),
  ]);
  const tot = k?.v_gerado || 1;
  const pr = (v: number) => (100 * v) / tot;
  const card = (ic: string, l: string, v: string | number, sub: string, c: string, href: string) => (
    <Link href={href} className="card kpi fk clk"><div className="l">{ic} {l}</div><div className="v" style={{ color: c }}>{v}</div><div className="sub">{sub}</div></Link>
  );
  const sq = comp ? `&comp=${comp}` : '';
  return (
    <>
      <form className="filtros">
        <select name="comp" defaultValue={comp}>
          {comps.map((c) => <option key={c.comp} value={c.comp}>Vencimento {fmtComp(c.comp)}</option>)}
          <option value="todas">Todos os meses</option>
        </select>
        <button className="btn sm gh">Ver</button>
        <Link className="btn right" href="/financeiro/conciliacao">📎 Enviar boletos (PDF) e conciliar</Link>
      </form>
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))' }}>
        {card('🧾', 'Boletos gerados', k?.gerados ?? 0, `de ${k?.previstos ?? 0} previstos`, 'var(--tx)', `/financeiro/boletos?${sq}`)}
        {card('📤', 'Boletos enviados', k?.enviados ?? 0, `de ${k?.gerados ?? 0} gerados`, 'var(--pri)', '/financeiro/tarefas?titulo=ENVIAR+BOLETOS')}
        {card('💵', 'Valor gerado', brl(k?.v_gerado), `${k?.gerados ?? 0} boletos`, 'var(--tx)', `/financeiro/boletos?${sq}`)}
        {card('✅', 'Valor recebido', brl(k?.v_rec), `${k?.n_rec ?? 0} boletos · ${Math.round(pr(k?.v_rec ?? 0))}%`, 'var(--ok)', `/financeiro/boletos?sit=recebido${sq}`)}
        {card('⏳', 'Valor a receber', brl(k?.v_arec), `${k?.n_arec ?? 0} boletos a vencer`, '#0369a1', `/financeiro/boletos?sit=a_receber${sq}`)}
        {card('🚨', 'Valor vencido', brl(k?.v_venc), `${k?.n_venc ?? 0} boletos em atraso`, 'var(--bad)', `/financeiro/boletos?sit=vencido${sq}`)}
      </div>
      <div className="card" style={{ marginBottom: 12 }}>
        <h3>Composição do valor gerado</h3>
        <div style={{ display: 'flex', height: 22, borderRadius: 6, overflow: 'hidden', background: '#eef2f7' }}>
          <span style={{ width: `${pr(k?.v_rec ?? 0)}%`, background: 'var(--ok)' }} />
          <span style={{ width: `${pr(k?.v_arec ?? 0)}%`, background: '#38bdf8' }} />
          <span style={{ width: `${pr(k?.v_venc ?? 0)}%`, background: 'var(--bad)' }} />
        </div>
        <div className="leg">
          <span><i style={{ background: 'var(--ok)' }} />Recebido {Math.round(pr(k?.v_rec ?? 0))}%</span>
          <span><i style={{ background: '#38bdf8' }} />A receber {Math.round(pr(k?.v_arec ?? 0))}%</span>
          <span><i style={{ background: 'var(--bad)' }} />Vencido {Math.round(pr(k?.v_venc ?? 0))}%</span>
        </div>
      </div>
      <div className="grid2">
        <div className="card"><h3>Maiores valores vencidos</h3><table><thead><tr><th>Empresa</th><th>Valor</th><th>Venceu</th><th>Dias</th></tr></thead><tbody>
          {vencidos.length ? vencidos.map((b) => <tr key={b.id}><td>{b.razao_social}</td><td>{brl(b.valor)}</td><td>{fmtData(b.vencimento)}</td><td style={{ color: 'var(--bad)' }}><b>{b.dias}</b></td></tr>)
            : <tr><td colSpan={4} className="mut">Nenhum boleto vencido 🎉</td></tr>}</tbody></table></div>
        <div className="card"><h3>Por vencimento</h3><table><thead><tr><th>Dia</th><th>Boletos</th><th>Valor</th><th>Recebido</th></tr></thead><tbody>
          {porVenc.map((v) => <tr key={v.vencimento}><td>{fmtData(v.vencimento)}</td><td>{v.n}</td><td>{brl(v.total)}</td><td>{brl(v.rec)}</td></tr>)}</tbody></table></div>
      </div>
    </>
  );
}
