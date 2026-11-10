import Link from 'next/link';
import { exigirUsuario } from '@/lib/auth';
import { q, q1 } from '@/lib/db';
import { fmtComp, fmtData } from '@/lib/format';
import { departamentos } from '@/lib/tarefas';

export const metadata = { title: 'EcommFlow · Dashboard' };

export default async function Dashboard({ searchParams }: { searchParams: { dep?: string } }) {
  const s = await exigirUsuario();
  const g = s.perfil === 'gestor';
  const dep = parseInt(searchParams.dep || '') || null;
  // Escopo: gestor vê o escritório; operador vê só as próprias tarefas. Departamentos restritos ficam no módulo próprio.
  const base = `FROM tarefas t JOIN departamentos d ON d.id = t.departamento_id
                WHERE t.escritorio_id = $1 AND NOT d.restrito_gestor AND t.status <> 'cancelada'
                  AND ($2::int IS NULL OR t.operador_id = $2) AND ($3::int IS NULL OR t.departamento_id = $3)`;
  const P = [s.esc, g ? null : s.id, dep];

  const [k, porOp, porDep, evol, atrasadas, deps] = await Promise.all([
    q1<Record<string, number>>(
      `SELECT count(*) FILTER (WHERE date_trunc('month', t.prazo) = date_trunc('month', CURRENT_DATE)) AS mes,
              count(*) FILTER (WHERE t.status = 'concluida' AND date_trunc('month', t.prazo) = date_trunc('month', CURRENT_DATE)) AS concl,
              count(*) FILTER (WHERE t.status = 'em_andamento') AS andam,
              count(*) FILTER (WHERE t.status IN ('pendente','em_andamento') AND t.prazo = CURRENT_DATE) AS hoje,
              count(*) FILTER (WHERE t.status IN ('pendente','em_andamento') AND t.prazo BETWEEN CURRENT_DATE + 1 AND CURRENT_DATE + 3) AS breve,
              count(*) FILTER (WHERE t.status = 'atrasada') AS atr ${base}`, P),
    q<{ id: number; nome: string; perfil: string; total: number; atr: number; ate3: number; aconf: number; conf: number; pend: number; andam: number }>(
      `SELECT o.id, o.nome, o.perfil, count(t.id) AS total,
              count(t.id) FILTER (WHERE t.status = 'atrasada') AS atr,
              count(t.id) FILTER (WHERE t.status IN ('pendente','em_andamento') AND t.prazo BETWEEN CURRENT_DATE AND CURRENT_DATE + 3) AS ate3,
              count(t.id) FILTER (WHERE t.status = 'concluida' AND t.conferida_por IS NULL) AS aconf,
              count(t.id) FILTER (WHERE t.conferida_por IS NOT NULL) AS conf,
              count(t.id) FILTER (WHERE t.status = 'pendente') AS pend,
              count(t.id) FILTER (WHERE t.status = 'em_andamento') AS andam
         FROM operadores o
         LEFT JOIN (SELECT t.* ${base}) t ON t.operador_id = o.id
        WHERE o.escritorio_id = $1 AND o.ativo AND ($2::int IS NULL OR o.id = $2)
        GROUP BY o.id ORDER BY o.perfil DESC, o.nome`, P),
    q<{ nome: string; mes: number; concl: number; aberto: number; atr: number }>(
      `SELECT d.nome, count(*) FILTER (WHERE date_trunc('month', t.prazo) = date_trunc('month', CURRENT_DATE)) AS mes,
              count(*) FILTER (WHERE t.status = 'concluida' AND date_trunc('month', t.prazo) = date_trunc('month', CURRENT_DATE)) AS concl,
              count(*) FILTER (WHERE t.status IN ('pendente','em_andamento','atrasada')) AS aberto,
              count(*) FILTER (WHERE t.status = 'atrasada') AS atr ${base} GROUP BY d.nome ORDER BY d.nome`, P),
    q<{ mes: string; total: number; prazo: number }>(
      `SELECT date_trunc('month', t.prazo)::date AS mes, count(*) AS total,
              count(*) FILTER (WHERE t.status = 'concluida' AND t.concluida_em::date <= t.prazo) AS prazo ${base}
          AND t.prazo >= date_trunc('month', CURRENT_DATE) - INTERVAL '5 months' AND t.prazo < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'
        GROUP BY 1 ORDER BY 1`, P),
    q<{ id: number; titulo: string; cliente: string | null; nome: string; prazo: string; dias: number }>(
      `SELECT t.id, t.titulo, c.razao_social AS cliente, o.nome, t.prazo, CURRENT_DATE - t.prazo AS dias
         FROM (SELECT t.* ${base} AND t.status = 'atrasada') t
         JOIN operadores o ON o.id = t.operador_id LEFT JOIN clientes c ON c.id = t.cliente_id
        ORDER BY t.prazo LIMIT 10`, P),
    departamentos(s),
  ]);

  const emp = g ? await q1<{ empresas: number; grupos: number }>(
    'SELECT (SELECT count(*) FROM clientes WHERE escritorio_id = $1 AND ativo) AS empresas, (SELECT count(*) FROM grupos WHERE escritorio_id = $1) AS grupos', [s.esc]) : null;
  const ff = g ? await q1<{ comp: string | null; total: number; conf: number; aconf: number }>(
    `WITH c AS (SELECT max(competencia) AS comp FROM tarefas WHERE escritorio_id = $1 AND titulo = 'FECHAMENTO FISCAL')
     SELECT (SELECT comp FROM c) AS comp, count(*) AS total, count(*) FILTER (WHERE conferida_por IS NOT NULL) AS conf,
            count(*) FILTER (WHERE status = 'concluida' AND conferida_por IS NULL) AS aconf
       FROM tarefas WHERE escritorio_id = $1 AND titulo = 'FECHAMENTO FISCAL' AND competencia = (SELECT comp FROM c)`, [s.esc]) : null;

  const lk = (atalho: string, extra = '') => `${g ? '/tarefas' : '/minhas'}?atalho=${atalho}${dep ? `&dep=${dep}` : ''}${extra}`;
  const pct = k?.mes ? Math.round((100 * k.concl) / k.mes) : 0;
  const carga = porOp.filter((o) => o.perfil === 'operador' || o.total);
  const maxCarga = Math.max(6, ...carga.map((o) => o.atr + o.pend + o.andam));
  const Kpi = ({ l, v, c, href, borda }: { l: string; v: number | string; c?: string; href: string; borda?: boolean }) => (
    <Link href={href} className="card kpi clk" style={borda ? { border: '2px solid var(--bad)' } : undefined}>
      <div className="l">{l}</div><div className="v" style={{ color: c }}>{v}</div>
    </Link>
  );

  return (
    <>
      <h2 style={{ margin: '0 0 14px' }}>Dashboard</h2>
      <form className="filtros">
        <select name="dep" defaultValue={dep ?? ''}>
          <option value="">Todos os departamentos</option>
          {deps.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
        </select>
        <button className="btn sm gh">Filtrar</button>
        {!g && <span className="mut" style={{ alignSelf: 'center' }}>Mostrando apenas as suas tarefas</span>}
      </form>

      {g && emp && ff && (
        <div className="kpis" style={{ gridTemplateColumns: '1fr 2fr' }}>
          <Link href="/cadastros" className="card kpi clk"><div className="l">🏢 Empresas cadastradas</div><div className="v">{emp.empresas}</div><div className="desc">{emp.grupos} grupos</div></Link>
          <Link href={lk('ffconf')} className="card kpi clk">
            <div className="l">✔ Fechamento Fiscal conferido {ff.comp && `· competência ${fmtComp(ff.comp)}`}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <div className="v" style={{ color: 'var(--ok)' }}>{ff.conf}</div>
              <div className="mut" style={{ fontSize: 16 }}>de {ff.total} empresas ({ff.total ? Math.round((100 * ff.conf) / ff.total) : 0}%)</div>
            </div>
            <div style={{ height: 10, background: '#eef2f7', borderRadius: 5, marginTop: 8, display: 'flex', overflow: 'hidden' }}>
              <span style={{ width: `${ff.total ? (100 * ff.conf) / ff.total : 0}%`, background: 'var(--ok)' }} />
              <span style={{ width: `${ff.total ? (100 * ff.aconf) / ff.total : 0}%`, background: '#fbbf24' }} />
            </div>
            <div className="desc" style={{ marginTop: 5 }}>🟩 conferidas {ff.conf} · 🟨 aguardando conferência {ff.aconf} · ⬜ não concluídas {ff.total - ff.conf - ff.aconf}</div>
          </Link>
        </div>
      )}

      {g && (
        <div className="card" style={{ marginBottom: 12 }}>
          <h3>Situação por operador</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))', gap: 10 }}>
            {carga.map((o) => (
              <div key={o.id} style={{ border: `1px solid ${o.atr ? 'var(--bad)' : 'var(--bd)'}`, borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><b>{o.nome}</b><span className="desc">{o.total} tarefas</span></div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 4, marginTop: 8, textAlign: 'center' }}>
                  {([['atr', o.atr, 'var(--bad)', 'Vencidas'], ['ate3', o.ate3, 'var(--warn)', 'A vencer 3d'], ['aconf', o.aconf, '#ca8a04', 'A conferir'], ['conf', o.conf, 'var(--ok)', 'Conferidas']] as const).map(([a, v, c, l]) => (
                    <Link key={a} className="opk" href={`/tarefas?atalho=${a}&operador=${o.id}`} style={{ textDecoration: 'none' }}>
                      <div style={{ fontSize: 22, fontWeight: 700, color: v ? c : '#cbd5e1' }}>{v}</div><div className="desc">{l}</div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="kpis">
        <Kpi l="Tarefas no mês" v={k?.mes ?? 0} href={lk('mes')} />
        <Kpi l="Concluídas" v={k?.concl ?? 0} c="var(--ok)" href={lk('concl')} />
        <Kpi l="Em andamento" v={k?.andam ?? 0} c="var(--info)" href={lk('and')} />
        <Kpi l="⚠ Vencem hoje" v={k?.hoje ?? 0} c="var(--bad)" href={lk('hoje')} borda={!!k?.hoje} />
        <Kpi l="⏰ Vencem em até 3 dias" v={k?.breve ?? 0} c="var(--warn)" href={lk('breve')} />
        <Kpi l="Atrasadas" v={k?.atr ?? 0} c="var(--bad)" href={lk('atr')} />
        <Kpi l="% conclusão no mês" v={`${pct}%`} href={lk('mes')} />
      </div>

      <div className="grid2">
        <div className="card">
          <h3>{g ? 'Carga de trabalho em aberto' : 'Minha carga em aberto'}</h3>
          {carga.map((o) => (
            <div className="bar" key={o.id}>
              <div className="n">{o.nome}</div>
              <div className="tr">
                <span style={{ width: `${(100 * o.atr) / maxCarga}%`, background: 'var(--bad)' }} />
                <span style={{ width: `${(100 * o.andam) / maxCarga}%`, background: 'var(--info)' }} />
                <span style={{ width: `${(100 * o.pend) / maxCarga}%`, background: 'var(--mut)' }} />
              </div>
              <b>{o.atr + o.andam + o.pend}</b>
            </div>
          ))}
          <div className="leg"><span><i style={{ background: 'var(--bad)' }} />Atrasada</span><span><i style={{ background: 'var(--info)' }} />Em andamento</span><span><i style={{ background: 'var(--mut)' }} />Pendente</span></div>
        </div>
        <div className="card">
          <h3>Evolução mensal: % entregue no prazo</h3>
          {evol.length ? (
            <table><thead><tr><th>Mês</th><th>Tarefas</th><th>No prazo</th><th>%</th></tr></thead><tbody>
              {evol.map((e) => {
                const p = e.total ? Math.round((100 * e.prazo) / e.total) : 0;
                return (
                  <tr key={e.mes}><td>{fmtComp(e.mes)}</td><td>{e.total}</td><td>{e.prazo}</td>
                    <td><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div className="chkbar" style={{ flex: 1, maxWidth: 'none', height: 8 }}><span style={{ width: `${p}%` }} /></div><b>{p}%</b></div></td></tr>
                );
              })}
            </tbody></table>
          ) : <p className="mut">Sem histórico ainda.</p>}
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <h3>Por departamento</h3>
          <div className="tblwrap"><table><thead><tr><th>Departamento</th><th>No mês</th><th>Concluídas</th><th>Em aberto</th><th>Atrasadas</th></tr></thead><tbody>
            {porDep.map((d) => <tr key={d.nome}><td>{d.nome}</td><td>{d.mes}</td><td>{d.concl}</td><td>{d.aberto}</td><td style={{ color: d.atr ? 'var(--bad)' : undefined }}>{d.atr}</td></tr>)}
          </tbody></table></div>
        </div>
        <div className="card">
          <h3>Tarefas atrasadas</h3>
          <div className="tblwrap"><table><thead><tr><th>Tarefa</th><th>Cliente</th><th>Responsável</th><th>Dias</th></tr></thead><tbody>
            {atrasadas.length ? atrasadas.map((t) => (
              <tr key={t.id}><td><Link href={`/tarefas/${t.id}`}>{t.titulo}</Link><div className="desc">venceu {fmtData(t.prazo)}</div></td><td>{t.cliente || '—'}</td><td>{t.nome}</td><td style={{ color: 'var(--bad)' }}><b>{t.dias}</b></td></tr>
            )) : <tr><td colSpan={4} className="mut">Nenhuma 🎉</td></tr>}
          </tbody></table></div>
        </div>
      </div>
    </>
  );
}
