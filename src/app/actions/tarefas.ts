'use server';
import { exigirGestor, exigirUsuario } from '@/lib/auth';
import { ErroNegocio, bool, executar, num, txt } from '@/lib/acao';
import { q1, tx } from '@/lib/db';
import type { Sessao } from '@/lib/session';

/** Carrega a tarefa garantindo escritório e permissão do usuário. */
async function tarefaPermitida(s: Sessao, id: number | null) {
  if (!id) throw new ErroNegocio('Tarefa inválida.');
  const t = await q1<{ id: number; operador_id: number; status: string; restrito: boolean }>(
    `SELECT t.id, t.operador_id, t.status, d.restrito_gestor AS restrito
       FROM tarefas t JOIN departamentos d ON d.id = t.departamento_id
      WHERE t.id = $1 AND t.escritorio_id = $2`,
    [id, s.esc],
  );
  if (!t) throw new ErroNegocio('Tarefa não encontrada.');
  if (t.restrito && s.perfil !== 'gestor') throw new ErroNegocio('Acesso restrito a gestores.');
  if (s.perfil !== 'gestor' && t.operador_id !== s.id) throw new ErroNegocio('Você só pode alterar as suas tarefas.');
  return t;
}

export async function mudarStatus(fd: FormData) {
  const s = await exigirUsuario();
  const novo = txt(fd, 'status');
  const rotulo: Record<string, string> = { em_andamento: 'Tarefa iniciada.', concluida: 'Tarefa concluída.', pendente: 'Tarefa reaberta.' };
  await executar(fd, async () => {
    if (!rotulo[novo]) throw new ErroNegocio('Ação inválida.');
    const t = await tarefaPermitida(s, num(fd, 'id'));
    if (novo === 'pendente' && t.status !== 'concluida') throw new ErroNegocio('Só é possível reabrir tarefas concluídas.');
    await tx(s, (c) => c.query('UPDATE tarefas SET status = $1::status_tarefa WHERE id = $2', [novo, t.id]));
  }, rotulo[novo] || '');
}

export async function marcarEtapa(fd: FormData) {
  const s = await exigirUsuario();
  await executar(fd, async () => {
    const e = await q1<{ tarefa_id: number }>('SELECT tarefa_id FROM tarefa_etapas WHERE id = $1', [num(fd, 'etapa')]);
    const t = await tarefaPermitida(s, e?.tarefa_id ?? null);
    if (t.status === 'concluida') throw new ErroNegocio('Reabra a tarefa para alterar as etapas.');
    await tx(s, (c) => c.query('UPDATE tarefa_etapas SET concluida = NOT concluida WHERE id = $1', [num(fd, 'etapa')]));
  }, 'Etapa atualizada.');
}

export async function conferir(fd: FormData) {
  const s = await exigirGestor();
  await executar(fd, async () => {
    const t = await tarefaPermitida(s, num(fd, 'id'));
    if (t.status !== 'concluida') throw new ErroNegocio('Só é possível conferir tarefas concluídas.');
    await tx(s, (c) => c.query('UPDATE tarefas SET conferida_por = $1, conferida_em = now() WHERE id = $2 AND conferida_por IS NULL', [s.id, t.id]));
  }, 'Tarefa conferida.');
}

export async function transferir(fd: FormData) {
  const s = await exigirUsuario();
  await executar(fd, async () => {
    const t = await tarefaPermitida(s, num(fd, 'id'));
    const para = num(fd, 'para');
    if (!para || para === t.operador_id) throw new ErroNegocio('Escolha um novo responsável.');
    const motivo = txt(fd, 'motivo');
    await tx(s, async (c) => {
      await c.query('UPDATE tarefas SET operador_id = $1 WHERE id = $2', [para, t.id]);
      if (motivo) await c.query("INSERT INTO historico_tarefas (tarefa_id, operador_id, acao, detalhe) VALUES ($1, $2, 'motivo', $3)", [t.id, s.id, motivo]);
    });
  }, 'Tarefa transferida.');
}

const PERIODOS = ['mensal', 'semanal', 'diaria', 'trimestral', 'anual'];

export async function criarTarefa(fd: FormData) {
  const s = await exigirUsuario();
  await executar(fd, async () => {
    const titulo = txt(fd, 'titulo').toUpperCase();
    const dep = num(fd, 'departamento');
    const resp = num(fd, 'responsavel');
    if (!titulo || !dep || !resp) throw new ErroNegocio('Preencha título, departamento e responsável.');
    const d = await q1<{ restrito_gestor: boolean }>('SELECT restrito_gestor FROM departamentos WHERE id = $1 AND escritorio_id = $2', [dep, s.esc]);
    if (!d) throw new ErroNegocio('Departamento inválido.');
    if (d.restrito_gestor && s.perfil !== 'gestor') throw new ErroNegocio('Departamento restrito a gestores.');
    const cliente = num(fd, 'cliente');
    const prioridade = ['alta', 'media', 'baixa'].includes(txt(fd, 'prioridade')) ? txt(fd, 'prioridade') : 'media';
    const etapas = txt(fd, 'etapas').split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 20);
    const conf = bool(fd, 'exige_conferencia');
    const desc = txt(fd, 'descricao') || null;

    if (txt(fd, 'tipo') === 'recorrente') {
      const per = txt(fd, 'periodicidade');
      if (!PERIODOS.includes(per)) throw new ErroNegocio('Periodicidade inválida.');
      const dia = num(fd, 'dia_mes');
      const sem = num(fd, 'dia_semana');
      const mes = num(fd, 'mes_ano');
      if (['mensal', 'trimestral', 'anual'].includes(per) && !(dia && dia >= 1 && dia <= 31)) throw new ErroNegocio('Informe o dia do mês (1 a 31).');
      if (per === 'semanal' && sem === null) throw new ErroNegocio('Informe o dia da semana.');
      if (['trimestral', 'anual'].includes(per) && !mes) throw new ErroNegocio('Informe o mês.');
      await tx(s, async (c) => {
        const r = await c.query(
          `INSERT INTO rotinas (escritorio_id, titulo, departamento_id, descricao, cliente_id, operador_id, periodicidade,
                                dia_mes, dia_semana, mes_ano, prioridade, exige_conferencia, criado_por)
           VALUES ($1,$2,$3,$4,$5,$6,$7::periodicidade,$8,$9,$10,$11,$12,$13) RETURNING id`,
          [s.esc, titulo, dep, desc, cliente, resp, per, dia, sem, mes, prioridade, conf, s.id],
        );
        const id = r.rows[0].id;
        for (const [i, n] of etapas.entries()) await c.query('INSERT INTO rotina_etapas (rotina_id, ordem, nome) VALUES ($1,$2,$3)', [id, i + 1, n]);
        await c.query('SELECT gerar_tarefa_rotina($1, CURRENT_DATE, TRUE)', [id]);
      });
    } else {
      const prazo = txt(fd, 'prazo');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(prazo)) throw new ErroNegocio('Informe o prazo.');
      await tx(s, async (c) => {
        const r = await c.query(
          `INSERT INTO tarefas (escritorio_id, titulo, departamento_id, descricao, cliente_id, operador_id, prazo, prioridade, exige_conferencia)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
          [s.esc, titulo, dep, desc, cliente, resp, prazo, prioridade, conf],
        );
        for (const [i, n] of etapas.entries()) await c.query('INSERT INTO tarefa_etapas (tarefa_id, ordem, nome) VALUES ($1,$2,$3)', [r.rows[0].id, i + 1, n]);
      });
    }
  }, 'Tarefa criada.', '/minhas');
}

export async function salvarRotina(fd: FormData) {
  const s = await exigirGestor();
  await executar(fd, async () => {
    const id = num(fd, 'id');
    const r = await q1('SELECT id FROM rotinas WHERE id = $1 AND escritorio_id = $2', [id, s.esc]);
    if (!r) throw new ErroNegocio('Rotina não encontrada.');
    const etapas = txt(fd, 'etapas').split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 20);
    await tx(s, async (c) => {
      await c.query(
        `UPDATE rotinas SET titulo = $2, departamento_id = $3, operador_id = $4, dia_mes = $5, prioridade = $6,
                exige_conferencia = $7, descricao = $8, ativa = $9 WHERE id = $1`,
        [id, txt(fd, 'titulo').toUpperCase(), num(fd, 'departamento'), num(fd, 'responsavel'), num(fd, 'dia_mes'),
         txt(fd, 'prioridade') || 'media', bool(fd, 'exige_conferencia'), txt(fd, 'descricao') || null, bool(fd, 'ativa')],
      );
      await c.query('DELETE FROM rotina_etapas WHERE rotina_id = $1', [id]);
      for (const [i, n] of etapas.entries()) await c.query('INSERT INTO rotina_etapas (rotina_id, ordem, nome) VALUES ($1,$2,$3)', [id, i + 1, n]);
      if (bool(fd, 'aplicar')) {
        await c.query(
          `UPDATE tarefas t SET titulo = r.titulo, departamento_id = r.departamento_id, operador_id = COALESCE(r.operador_id, t.operador_id),
                  prioridade = r.prioridade, exige_conferencia = r.exige_conferencia, descricao = r.descricao
             FROM rotinas r WHERE r.id = $1 AND t.rotina_id = r.id AND t.status NOT IN ('concluida','cancelada')`,
          [id],
        );
      }
    });
  }, 'Rotina atualizada.', '/rotinas');
}

export async function alternarRotina(fd: FormData) {
  const s = await exigirGestor();
  await executar(fd, async () => {
    await tx(s, (c) => c.query('UPDATE rotinas SET ativa = NOT ativa WHERE id = $1 AND escritorio_id = $2', [num(fd, 'id'), s.esc]));
  }, 'Rotina atualizada.', '/rotinas');
}
