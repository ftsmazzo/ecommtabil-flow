import Link from 'next/link';
import { exigirGestor } from '@/lib/auth';
import { q } from '@/lib/db';
import { fmtDataHora, STATUS } from '@/lib/format';

export const metadata = { title: 'EcommFlow · Histórico' };

export default async function Historico() {
  const s = await exigirGestor();
  const H = await q<{ registrado_em: string; quem: string | null; acao: string; detalhe: string | null; status_anterior: string | null; status_novo: string | null; tarefa_id: number; titulo: string; cliente: string | null }>(
    `SELECT h.registrado_em, o.nome AS quem, h.acao, h.detalhe, h.status_anterior, h.status_novo, t.id AS tarefa_id, t.titulo, c.razao_social AS cliente
       FROM historico_tarefas h JOIN tarefas t ON t.id = h.tarefa_id JOIN departamentos d ON d.id = t.departamento_id
       LEFT JOIN operadores o ON o.id = h.operador_id LEFT JOIN clientes c ON c.id = t.cliente_id
      WHERE t.escritorio_id = $1 AND h.operador_id IS NOT NULL
      ORDER BY h.registrado_em DESC, h.id DESC LIMIT 300`, [s.esc]);
  return (
    <>
      <h2 style={{ margin: '0 0 14px' }}>Histórico</h2>
      <p className="mut">Últimas 300 ações feitas por usuários (ações automáticas do sistema não aparecem aqui).</p>
      <div className="card tblwrap"><table>
        <thead><tr><th>Quando</th><th>Quem</th><th>Ação</th><th>Tarefa</th><th>Cliente</th></tr></thead>
        <tbody>{H.length ? H.map((h, i) => (
          <tr key={i}><td className="desc" style={{ whiteSpace: 'nowrap' }}>{fmtDataHora(h.registrado_em)}</td><td>{h.quem}</td>
            <td>{h.acao === 'status' ? `${STATUS[h.status_anterior || ''] ?? ''} → ${STATUS[h.status_novo || '']}` : h.acao === 'criada' ? 'Criou a tarefa' : `${h.acao}${h.detalhe ? `: ${h.detalhe}` : ''}`}</td>
            <td><Link href={`/tarefas/${h.tarefa_id}`}>{h.titulo}</Link></td><td>{h.cliente || '—'}</td></tr>
        )) : <tr><td colSpan={5} className="mut">Nenhuma ação registrada ainda.</td></tr>}</tbody>
      </table></div>
    </>
  );
}
