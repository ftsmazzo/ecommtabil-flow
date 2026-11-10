'use client';
import { useFormState, useFormStatus } from 'react-dom';
import { aplicarConciliacao, lerPdfs, type LinhaConciliacao } from '@/app/actions/financeiro';

const brl = (v: number | null) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const data = (d: string) => (d ? d.split('-').reverse().join('/') : '—');
const ROT = { confere: ['ok', '✔ Confere'], divergente: ['dv', '⚠ Divergente'], nao_encontrado: ['nf', '✖ Não encontrado'], duplicado: ['nf', '✖ Já conciliado'] } as const;

function Enviar() {
  const { pending } = useFormStatus();
  return <button className="btn" disabled={pending}>{pending ? 'Lendo PDFs…' : 'Ler e conciliar'}</button>;
}

export function Conciliacao() {
  const [estado, ler] = useFormState(lerPdfs, { linhas: [] as LinhaConciliacao[] });
  const L = estado.linhas;
  const n = (k: string) => L.filter((l) => l.resultado === k).length;
  const problemas = n('divergente') + n('nao_encontrado') + n('duplicado');
  return (
    <>
      <form action={ler} className="card" style={{ marginBottom: 12 }}>
        <h3>📎 Enviar boletos e conciliar</h3>
        <p className="mut">Selecione os PDFs dos boletos enviados (vários de uma vez). O sistema lê pagador, CPF/CNPJ, valor, vencimento e nosso número,
          confere com o cadastro e conclui as tarefas <b>ENVIAR BOLETOS</b> dos boletos confirmados.</p>
        <input type="file" name="pdfs" accept="application/pdf" multiple required className="drop" style={{ width: '100%' }} />
        <div style={{ marginTop: 12 }}><Enviar /></div>
        {estado.erro && <div className="flash erro" style={{ marginTop: 10 }}>{estado.erro}</div>}
      </form>

      {L.length > 0 && (
        <form action={aplicarConciliacao} className="card">
          <input type="hidden" name="dados" value={JSON.stringify(L)} />
          <input type="hidden" name="back" value="/financeiro" />
          <h3>Resultado da conciliação</h3>
          <div className="kpis" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
            <div className="card kpi"><div className="l">PDFs lidos</div><div className="v">{L.length}</div></div>
            <div className="card kpi"><div className="l">✔ Conferem</div><div className="v" style={{ color: 'var(--ok)' }}>{n('confere')}</div></div>
            <div className="card kpi"><div className="l">⚠ Com divergência</div><div className="v" style={{ color: 'var(--warn)' }}>{n('divergente')}</div></div>
            <div className="card kpi"><div className="l">✖ Não conciliados</div><div className="v" style={{ color: 'var(--bad)' }}>{n('nao_encontrado') + n('duplicado')}</div></div>
          </div>
          {problemas > 0 && (
            <div className="alerta breve" style={{ cursor: 'default' }}><span className="ic">⚠</span>
              <span>Atenção: <b>{problemas} boleto(s)</b> com dados divergentes ou não localizados. Os divergentes só serão conciliados se você marcar.</span></div>
          )}
          <div className="tblwrap"><table className="rk">
            <thead><tr><th /><th>Arquivo / Pagador</th><th>Empresa no sistema</th><th>Valor</th><th>Vencimento</th><th>Resultado</th></tr></thead>
            <tbody>{L.map((l, i) => (
              <tr key={i} style={{ background: l.resultado === 'confere' ? undefined : l.resultado === 'divergente' ? '#fffbeb' : '#fef2f2' }}>
                <td><input type="checkbox" name="ok" value={i} defaultChecked={l.resultado === 'confere'} disabled={!l.boletoId} /></td>
                <td><b>{l.pagador || '—'}</b><div className="desc">{l.documento} · {l.arquivo}</div></td>
                <td>{l.clienteNome || '—'}</td><td style={{ whiteSpace: 'nowrap' }}>{l.valor != null ? brl(l.valor) : '—'}</td><td>{data(l.vencimento)}</td>
                <td><span className={ROT[l.resultado][0]}>{ROT[l.resultado][1]}</span>{l.mensagens.length > 0 && <ul>{l.mensagens.map((m, j) => <li key={j}>{m}</li>)}</ul>}</td>
              </tr>))}
            </tbody></table></div>
          <button className="btn" style={{ marginTop: 14 }}>Conciliar selecionados e concluir envios</button>
        </form>
      )}
    </>
  );
}
