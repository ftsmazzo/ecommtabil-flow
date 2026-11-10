import Link from 'next/link';
import { exigirGestor } from '@/lib/auth';
import { q } from '@/lib/db';

export const metadata = { title: 'EcommFlow · Equipe' };

export default async function Equipe() {
  const s = await exigirGestor();
  const E = await q<{ id: number; nome: string; perfil: string; aberto: number; hoje: number; atr: number; breve: number; aconf: number; mes: number; noprazo: number }>(
    `SELECT o.id, o.nome, o.perfil,
            count(t.id) FILTER (WHERE t.status IN ('pendente','em_andamento','atrasada')) AS aberto,
            count(t.id) FILTER (WHERE t.status IN ('pendente','em_andamento') AND t.prazo = CURRENT_DATE) AS hoje,
            count(t.id) FILTER (WHERE t.status = 'atrasada') AS atr,
            count(t.id) FILTER (WHERE t.status IN ('pendente','em_andamento') AND t.prazo BETWEEN CURRENT_DATE + 1 AND CURRENT_DATE + 3) AS breve,
            count(t.id) FILTER (WHERE t.status = 'concluida' AND t.conferida_por IS NULL) AS aconf,
            count(t.id) FILTER (WHERE date_trunc('month', t.prazo) = date_trunc('month', CURRENT_DATE)) AS mes,
            count(t.id) FILTER (WHERE date_trunc('month', t.prazo) = date_trunc('month', CURRENT_DATE) AND t.status = 'concluida' AND t.concluida_em::date <= t.prazo) AS noprazo
       FROM operadores o
       LEFT JOIN tarefas t ON t.operador_id = o.id AND t.departamento_id IN (SELECT id FROM departamentos WHERE NOT restrito_gestor)
      WHERE o.escritorio_id = $1 AND o.ativo GROUP BY o.id ORDER BY o.perfil DESC, o.nome`, [s.esc]);
  return (
    <>
      <h2 style={{ margin: '0 0 14px' }}>Acompanhamento da equipe</h2>
      <p className="mut">Clique em uma pessoa para ver e conferir as tarefas dela.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 12 }}>
        {E.map((o) => {
          const pct = o.mes ? Math.round((100 * o.noprazo) / o.mes) : null;
          return (
            <Link key={o.id} href={`/equipe/${o.id}`} className="card kpi clk" style={o.hoje || o.atr ? { border: '2px solid var(--bad)' } : undefined}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><b style={{ fontSize: 16 }}>{o.nome}</b><span className="desc">{o.perfil}</span></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: 12, textAlign: 'center' }}>
                <div><div style={{ fontSize: 22, fontWeight: 700 }}>{o.aberto}</div><div className="desc">em aberto</div></div>
                <div><div style={{ fontSize: 22, fontWeight: 700, color: 'var(--bad)' }}>{o.hoje + o.atr}</div><div className="desc">hoje/atrasadas</div></div>
                <div><div style={{ fontSize: 22, fontWeight: 700, color: 'var(--warn)' }}>{o.breve}</div><div className="desc">até 3 dias</div></div>
              </div>
              <div style={{ marginTop: 12, height: 8, background: '#eef2f7', borderRadius: 4 }}><div style={{ width: `${pct || 0}%`, height: '100%', background: 'var(--ok)', borderRadius: 4 }} /></div>
              <div className="desc" style={{ marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                <span>{pct === null ? 'Sem tarefas no mês' : `${pct}% no prazo (mês)`}</span>
                {!!o.aconf && <span style={{ color: 'var(--ok)', fontWeight: 600 }}>🔎 {o.aconf} a conferir</span>}
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
