import Link from 'next/link';
import { conferir, marcarEtapa, mudarStatus } from '@/app/actions/tarefas';
import { brl, fmtData, PRIORIDADE, STATUS } from '@/lib/format';
import type { Sessao } from '@/lib/session';
import type { Tarefa } from '@/lib/tarefas';

function Prazo({ t }: { t: Tarefa }) {
  const aberta = ['pendente', 'em_andamento'].includes(t.status);
  return (
    <td style={{ whiteSpace: 'nowrap' }}>
      {fmtData(t.prazo)}
      {aberta && t.dias === 0 && <span className="bdg hoje">⚠ VENCE HOJE</span>}
      {aberta && t.dias > 0 && t.dias <= 3 && <span className="bdg breve">⏰ {t.dias === 1 ? 'amanhã' : `em ${t.dias} dias`}</span>}
    </td>
  );
}

function Hidden({ back, ...v }: Record<string, string | number>) {
  return (
    <>
      {Object.entries(v).map(([k, x]) => <input key={k} type="hidden" name={k} value={x} />)}
      <input type="hidden" name="back" value={back} />
    </>
  );
}

export function TaskTable({ tarefas, sessao, back, mostrarResponsavel = true }: {
  tarefas: Tarefa[]; sessao: Sessao; back: string; mostrarResponsavel?: boolean;
}) {
  const gestor = sessao.perfil === 'gestor';
  if (!tarefas.length) return <div className="card mut">Nenhuma tarefa encontrada.</div>;
  return (
    <div className="card tblwrap">
      <table>
        <thead>
          <tr>
            <th>Tarefa</th><th>Depto</th><th>Cliente</th>{mostrarResponsavel && <th>Responsável</th>}
            <th>Atribuída por</th><th>Prioridade</th><th>Prazo</th><th>Status</th><th>Ação</th>
          </tr>
        </thead>
        <tbody>
          {tarefas.map((t) => {
            const aberta = ['pendente', 'em_andamento'].includes(t.status);
            const nivel = aberta && t.dias === 0 ? 'r-hoje' : aberta && t.dias > 0 && t.dias <= 3 ? 'r-breve' : '';
            const podeMexer = gestor || t.operador_id === sessao.id;
            const feitas = t.etapas.filter((e) => e.ok).length;
            return (
              <tr key={t.id} className={nivel}>
                <td>
                  <Link href={`/tarefas/${t.id}`} style={{ textDecoration: 'none' }}>{t.rotina_id ? '🔁 ' : ''}{t.titulo}</Link>
                  {t.descricao && <div className="desc">{t.descricao}</div>}
                  {t.valor != null && <div className="desc">Boleto {brl(t.valor)}</div>}
                  {t.etapas.length > 0 && (
                    <div className="chk">
                      <div className="chkbar"><span style={{ width: `${(100 * feitas) / t.etapas.length}%` }} /></div>
                      <span className="desc">{feitas}/{t.etapas.length} etapas</span>
                      {t.etapas.map((e) => (
                        <form key={e.id} action={marcarEtapa} className={e.ok ? 'ok' : ''}>
                          <Hidden etapa={e.id} back={back} />
                          <button type="submit" disabled={!podeMexer || t.status === 'concluida'} title={e.ok && e.por ? `Feito por ${e.por}` : 'Marcar etapa'}>
                            <span className="box">{e.ok ? '✓' : ''}</span><span className="n">{e.nome}</span>{e.ok && e.por && <i>· {e.por}</i>}
                          </button>
                        </form>
                      ))}
                    </div>
                  )}
                </td>
                <td><span className="tag dep">{t.departamento}</span></td>
                <td>{t.cliente || <span className="desc">Interna</span>}</td>
                {mostrarResponsavel && <td>{t.responsavel}</td>}
                <td>{t.criado_por_nome || <span className="desc">Rotina</span>}</td>
                <td><span className={`tag ${t.prioridade}`}>{PRIORIDADE[t.prioridade]}</span></td>
                <Prazo t={t} />
                <td>
                  <span className={`tag ${t.status}`}>{STATUS[t.status]}</span>
                  {t.conferida_por_nome ? <div className="desc" style={{ color: 'var(--ok)' }}>✔ conferida por {t.conferida_por_nome}</div>
                    : t.exige_conferencia && t.status === 'concluida' ? <div className="desc" style={{ color: 'var(--warn)', fontWeight: 600 }}>⏳ aguardando conferência</div>
                    : t.exige_conferencia ? <div className="desc">🔎 exige conferência</div> : null}
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {podeMexer && t.status !== 'concluida' && <Link className="btn sm gh" href={`/tarefas/${t.id}#transferir`} title="Transferir">⇄</Link>}{' '}
                  {podeMexer && ['pendente', 'atrasada'].includes(t.status) && (
                    <form action={mudarStatus} className="inline"><Hidden id={t.id} status="em_andamento" back={back} /><button className="btn sm gh">▶ Iniciar</button></form>
                  )}{' '}
                  {podeMexer && t.status !== 'concluida' && (
                    <form action={mudarStatus} className="inline"><Hidden id={t.id} status="concluida" back={back} />
                      <button className="btn sm" style={t.etapas.length && feitas < t.etapas.length ? { opacity: 0.45 } : undefined}>✔ Concluir</button></form>
                  )}
                  {t.status === 'concluida' && gestor && !t.conferida_por && (
                    <form action={conferir} className="inline"><Hidden id={t.id} back={back} /><button className="btn sm" style={{ background: 'var(--ok)' }}>🔎 Conferir</button></form>
                  )}{' '}
                  {t.status === 'concluida' && podeMexer && (
                    <form action={mudarStatus} className="inline"><Hidden id={t.id} status="pendente" back={back} /><button className="btn sm gh">↺ Reabrir</button></form>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
