import 'server-only';
import { q } from './db';
import type { Sessao } from './session';

export type Etapa = { id: number; nome: string; ok: boolean; por: string | null };
export type Tarefa = {
  id: number;
  titulo: string;
  descricao: string | null;
  prazo: string;
  competencia: string | null;
  status: string;
  prioridade: string;
  exige_conferencia: boolean;
  conferida_por: number | null;
  conferida_por_nome: string | null;
  valor: number | null;
  acao_financeira: string | null;
  rotina_id: number | null;
  operador_id: number;
  responsavel: string;
  criado_por_nome: string | null;
  departamento: string;
  restrito: boolean;
  cliente: string | null;
  dias: number;
  etapas: Etapa[];
};

/** Filtros de atalho usados pelos indicadores (KPIs) */
export const ATALHOS: Record<string, { rotulo: string; sql: string }> = {
  mes: { rotulo: 'Tarefas do mês', sql: "date_trunc('month', t.prazo) = date_trunc('month', CURRENT_DATE)" },
  concl: { rotulo: 'Concluídas no mês', sql: "t.status = 'concluida' AND date_trunc('month', t.prazo) = date_trunc('month', CURRENT_DATE)" },
  and: { rotulo: 'Em andamento', sql: "t.status = 'em_andamento'" },
  hoje: { rotulo: '⚠ Vencem hoje', sql: "t.status IN ('pendente','em_andamento') AND t.prazo = CURRENT_DATE" },
  breve: { rotulo: '⏰ Vencem em até 3 dias', sql: "t.status IN ('pendente','em_andamento') AND t.prazo BETWEEN CURRENT_DATE + 1 AND CURRENT_DATE + 3" },
  ate3: { rotulo: '⏰ A vencer (até 3 dias)', sql: "t.status IN ('pendente','em_andamento') AND t.prazo BETWEEN CURRENT_DATE AND CURRENT_DATE + 3" },
  atr: { rotulo: 'Atrasadas', sql: "t.status = 'atrasada'" },
  aconf: { rotulo: '🔎 A conferir', sql: "t.status = 'concluida' AND t.conferida_por IS NULL" },
  conf: { rotulo: '✔ Conferidas', sql: 't.conferida_por IS NOT NULL' },
  ffconf: { rotulo: '✔ Fechamento Fiscal conferido', sql: "t.titulo = 'FECHAMENTO FISCAL' AND t.conferida_por IS NOT NULL" },
};

export type Filtros = {
  id?: number;
  operador?: number;
  status?: string; // '' = em aberto | 'todas' | status
  departamento?: number;
  titulo?: string;
  busca?: string;
  atalho?: string;
  financeiro?: boolean; // true = somente departamentos restritos (módulo financeiro)
  limite?: number;
};

export async function listarTarefas(s: Sessao, f: Filtros = {}): Promise<Tarefa[]> {
  const p: unknown[] = [s.esc];
  const w: string[] = ['t.escritorio_id = $1'];
  const add = (cond: string, v: unknown) => {
    p.push(v);
    w.push(cond.replace('?', `$${p.length}`));
  };
  w.push(f.financeiro ? 'd.restrito_gestor' : 'NOT d.restrito_gestor');
  if (f.financeiro && s.perfil !== 'gestor') w.push('FALSE');
  if (f.id) add('t.id = ?', f.id);
  if (f.operador) add('t.operador_id = ?', f.operador);
  if (f.departamento) add('t.departamento_id = ?', f.departamento);
  if (f.titulo) add('t.titulo = ?', f.titulo);
  if (f.busca) {
    p.push(`%${f.busca}%`);
    const i = p.length;
    w.push(`(c.razao_social ILIKE $${i} OR t.titulo ILIKE $${i} OR c.cnpj ILIKE $${i})`);
  }
  if (f.atalho && ATALHOS[f.atalho]) w.push(ATALHOS[f.atalho].sql);
  else if (!f.status) w.push("t.status NOT IN ('concluida','cancelada')");
  else if (f.status !== 'todas') add('t.status = ?::status_tarefa', f.status);

  return q<Tarefa>(
    `SELECT t.id, t.titulo, t.descricao, t.prazo, t.competencia, t.status, t.prioridade, t.exige_conferencia,
            t.conferida_por, cf.nome AS conferida_por_nome, t.valor, t.acao_financeira, t.rotina_id, t.operador_id,
            o.nome AS responsavel, cp.nome AS criado_por_nome, d.nome AS departamento, d.restrito_gestor AS restrito,
            c.razao_social AS cliente, (t.prazo - CURRENT_DATE) AS dias,
            COALESCE((SELECT json_agg(json_build_object('id', e.id, 'nome', e.nome, 'ok', e.concluida, 'por', eo.nome) ORDER BY e.ordem)
                      FROM tarefa_etapas e LEFT JOIN operadores eo ON eo.id = e.concluida_por WHERE e.tarefa_id = t.id), '[]') AS etapas
       FROM tarefas t
       JOIN departamentos d ON d.id = t.departamento_id
       JOIN operadores o ON o.id = t.operador_id
       LEFT JOIN clientes c ON c.id = t.cliente_id
       LEFT JOIN operadores cp ON cp.id = t.criado_por
       LEFT JOIN operadores cf ON cf.id = t.conferida_por
      WHERE ${w.join(' AND ')}
      ORDER BY t.prazo, c.razao_social NULLS FIRST, t.id
      LIMIT ${Math.min(f.limite ?? 500, 2000)}`,
    p,
  );
}

export async function titulosDisponiveis(s: Sessao, operador?: number) {
  return q<{ titulo: string; abertas: number }>(
    `SELECT t.titulo, count(*) FILTER (WHERE t.status NOT IN ('concluida','cancelada')) AS abertas
       FROM tarefas t JOIN departamentos d ON d.id = t.departamento_id
      WHERE t.escritorio_id = $1 AND NOT d.restrito_gestor AND ($2::int IS NULL OR t.operador_id = $2)
      GROUP BY 1 ORDER BY 1`,
    [s.esc, operador ?? null],
  );
}

export async function departamentos(s: Sessao, incluirRestritos = false) {
  return q<{ id: number; nome: string; restrito_gestor: boolean }>(
    'SELECT id, nome, restrito_gestor FROM departamentos WHERE escritorio_id = $1 AND ativo AND ($2 OR NOT restrito_gestor) ORDER BY nome',
    [s.esc, incluirRestritos && s.perfil === 'gestor'],
  );
}

export async function pessoas(s: Sessao) {
  return q<{ id: number; nome: string; perfil: string }>(
    'SELECT id, nome, perfil FROM operadores WHERE escritorio_id = $1 AND ativo ORDER BY perfil, nome',
    [s.esc],
  );
}

export async function clientesOpcoes(s: Sessao) {
  return q<{ id: number; razao_social: string; cnpj: string | null; grupo: string | null }>(
    `SELECT c.id, c.razao_social, c.cnpj, g.nome AS grupo FROM clientes c LEFT JOIN grupos g ON g.id = c.grupo_id
      WHERE c.escritorio_id = $1 AND c.ativo ORDER BY c.razao_social`,
    [s.esc],
  );
}
