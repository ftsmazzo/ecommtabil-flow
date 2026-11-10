import 'server-only';
import { q } from './db';
import type { Sessao } from './session';

export type Etapa = { id: number; nome: string; ok: boolean; por: string | null };

export type Tarefa = {
  id: number;
  titulo: string;
  descricao: string | null;
  valor: number | null;
  rotina_id: number | null;
  departamento: string;
  restrito: boolean;
  cliente: string | null;
  responsavel: string;
  criado_por_nome: string | null;
  prioridade: 'alta' | 'media' | 'baixa';
  status: string;
  prazo: string;
  dias: number;
  operador_id: number;
  exige_conferencia: boolean;
  conferida_por: number | null;
  conferida_por_nome: string | null;
  etapas: Etapa[];
};

export type FiltroTarefas = {
  id?: number;
  operador?: number;
  departamento?: number;
  titulo?: string;
  status?: string;
  busca?: string;
  atalho?: string;
  financeiro?: boolean;
};

/** Atalhos de dashboard / alertas / equipe. */
export const ATALHOS: Record<string, { rotulo: string }> = {
  hoje: { rotulo: 'Vencem hoje' },
  breve: { rotulo: 'Vencem em até 3 dias' },
  ate3: { rotulo: 'A vencer em 3 dias' },
  atr: { rotulo: 'Atrasadas' },
  and: { rotulo: 'Em andamento' },
  concl: { rotulo: 'Concluídas' },
  mes: { rotulo: 'No mês' },
  aconf: { rotulo: 'A conferir' },
  conf: { rotulo: 'Conferidas' },
  ffconf: { rotulo: 'Fechamento fiscal' },
};

export async function departamentos(s: Sessao, incluirRestritos = false) {
  return q<{ id: number; nome: string; restrito_gestor: boolean }>(
    `SELECT id, nome, restrito_gestor FROM departamentos
      WHERE escritorio_id = $1 AND ativo AND ($2 OR NOT restrito_gestor)
      ORDER BY nome`,
    [s.esc, incluirRestritos],
  );
}

export async function pessoas(s: Sessao) {
  return q<{ id: number; nome: string; perfil: 'gestor' | 'operador' }>(
    `SELECT id, nome, perfil FROM operadores
      WHERE escritorio_id = $1 AND ativo ORDER BY perfil DESC, nome`,
    [s.esc],
  );
}

export async function clientesOpcoes(s: Sessao) {
  return q<{ id: number; razao_social: string; cnpj: string | null; grupo: string | null }>(
    `SELECT c.id, c.razao_social, c.cnpj, g.nome AS grupo
       FROM clientes c LEFT JOIN grupos g ON g.id = c.grupo_id
      WHERE c.escritorio_id = $1 AND c.ativo
      ORDER BY c.razao_social`,
    [s.esc],
  );
}

export async function titulosDisponiveis(s: Sessao, operador?: number) {
  return q<{ titulo: string; abertas: number }>(
    `SELECT t.titulo,
            count(*) FILTER (WHERE t.status NOT IN ('concluida','cancelada'))::int AS abertas
       FROM tarefas t
       JOIN departamentos d ON d.id = t.departamento_id
      WHERE t.escritorio_id = $1 AND NOT d.restrito_gestor
        AND ($2::int IS NULL OR t.operador_id = $2)
      GROUP BY t.titulo
      ORDER BY abertas DESC, t.titulo`,
    [s.esc, operador ?? null],
  );
}

function sqlAtalho(atalho?: string): string {
  switch (atalho) {
    case 'hoje':
      return ` AND t.status IN ('pendente','em_andamento') AND t.prazo = CURRENT_DATE`;
    case 'breve':
      return ` AND t.status IN ('pendente','em_andamento') AND t.prazo BETWEEN CURRENT_DATE + 1 AND CURRENT_DATE + 3`;
    case 'ate3':
      return ` AND t.status IN ('pendente','em_andamento') AND t.prazo BETWEEN CURRENT_DATE AND CURRENT_DATE + 3`;
    case 'atr':
      return ` AND t.status = 'atrasada'`;
    case 'and':
      return ` AND t.status = 'em_andamento'`;
    case 'concl':
      return ` AND t.status = 'concluida'`;
    case 'mes':
      return ` AND date_trunc('month', t.prazo) = date_trunc('month', CURRENT_DATE)`;
    case 'aconf':
      return ` AND t.status = 'concluida' AND t.conferida_por IS NULL`;
    case 'conf':
      return ` AND t.conferida_por IS NOT NULL`;
    case 'ffconf':
      return ` AND t.titulo = 'FECHAMENTO FISCAL'`;
    default:
      return '';
  }
}

export async function listarTarefas(s: Sessao, f: FiltroTarefas = {}): Promise<Tarefa[]> {
  const status = f.status || '';
  const abertoPadrao = !status || status === '';
  const params: unknown[] = [s.esc];
  const add = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };

  let where = `t.escritorio_id = $1`;
  if (f.financeiro) where += ` AND d.restrito_gestor`;
  else where += ` AND NOT d.restrito_gestor`;

  if (f.id != null) where += ` AND t.id = ${add(f.id)}`;
  if (f.operador != null) where += ` AND t.operador_id = ${add(f.operador)}`;
  if (f.departamento != null) where += ` AND t.departamento_id = ${add(f.departamento)}`;
  if (f.titulo) where += ` AND t.titulo = ${add(f.titulo)}`;
  if (f.busca) {
    const b = add(`%${f.busca}%`);
    const digits = add(`%${f.busca.replace(/\D/g, '')}%`);
    where += ` AND (t.titulo ILIKE ${b} OR c.razao_social ILIKE ${b} OR regexp_replace(COALESCE(c.cnpj,''), '\\D', '', 'g') LIKE ${digits})`;
  }

  if (f.atalho) {
    where += sqlAtalho(f.atalho);
  } else if (abertoPadrao) {
    where += ` AND t.status NOT IN ('concluida','cancelada')`;
  } else if (status !== 'todas') {
    where += ` AND t.status = ${add(status)}`;
  }

  const rows = await q<{
    id: number;
    titulo: string;
    descricao: string | null;
    valor: number | null;
    rotina_id: number | null;
    departamento: string;
    restrito: boolean;
    cliente: string | null;
    responsavel: string;
    criado_por_nome: string | null;
    prioridade: Tarefa['prioridade'];
    status: string;
    prazo: string;
    dias: number;
    operador_id: number;
    exige_conferencia: boolean;
    conferida_por: number | null;
    conferida_por_nome: string | null;
  }>(
    `SELECT t.id, t.titulo, t.descricao, t.valor::float8 AS valor, t.rotina_id,
            d.nome AS departamento, d.restrito_gestor AS restrito,
            c.razao_social AS cliente, o.nome AS responsavel, cp.nome AS criado_por_nome,
            t.prioridade, t.status::text AS status, t.prazo::text AS prazo,
            (t.prazo - CURRENT_DATE) AS dias, t.operador_id, t.exige_conferencia,
            t.conferida_por, cf.nome AS conferida_por_nome
       FROM tarefas t
       JOIN departamentos d ON d.id = t.departamento_id
       JOIN operadores o ON o.id = t.operador_id
       LEFT JOIN clientes c ON c.id = t.cliente_id
       LEFT JOIN operadores cp ON cp.id = t.criado_por
       LEFT JOIN operadores cf ON cf.id = t.conferida_por
      WHERE ${where}
      ORDER BY
        CASE WHEN t.status IN ('pendente','em_andamento','atrasada') THEN 0 ELSE 1 END,
        t.prazo ASC, t.id DESC
      LIMIT 500`,
    params,
  );

  if (!rows.length) return [];

  const ids = rows.map((r) => r.id);
  const etapas = await q<{ id: number; tarefa_id: number; nome: string; ok: boolean; por: string | null }>(
    `SELECT e.id, e.tarefa_id, e.nome, e.concluida AS ok, o.nome AS por
       FROM tarefa_etapas e
       LEFT JOIN operadores o ON o.id = e.concluida_por
      WHERE e.tarefa_id = ANY($1::int[])
      ORDER BY e.ordem`,
    [ids],
  );
  const porTarefa = new Map<number, Etapa[]>();
  for (const e of etapas) {
    const list = porTarefa.get(e.tarefa_id) || [];
    list.push({ id: e.id, nome: e.nome, ok: e.ok, por: e.por });
    porTarefa.set(e.tarefa_id, list);
  }

  return rows.map((r) => ({ ...r, etapas: porTarefa.get(r.id) || [] }));
}
