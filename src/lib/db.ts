import 'server-only';
import { Pool, PoolClient, types } from 'pg';

// DATE como string 'YYYY-MM-DD' (evita deslocamento de fuso), NUMERIC e BIGINT como número
types.setTypeParser(1082, (v) => v);
types.setTypeParser(1700, (v) => parseFloat(v));
types.setTypeParser(20, (v) => parseInt(v, 10));

const globalForPool = globalThis as unknown as { __efPool?: Pool };

export const pool =
  globalForPool.__efPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    options: `-c timezone=${process.env.TZ || 'America/Sao_Paulo'}`,
  });
if (process.env.NODE_ENV !== 'production') globalForPool.__efPool = pool;

export async function q<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
  const r = await pool.query(sql, params as any[]);
  return r.rows as T[];
}

export async function q1<T = any>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  return (await q<T>(sql, params))[0];
}

/** Executa em transação com o usuário logado no contexto (auditoria e regras dos triggers). */
export async function tx<T>(ctx: { id: number; esc: number } | null, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    if (ctx) {
      await c.query("SELECT set_config('app.operador_id', $1, true), set_config('app.escritorio_id', $2, true)", [
        String(ctx.id),
        String(ctx.esc),
      ]);
    }
    const r = await fn(c);
    await c.query('COMMIT');
    return r;
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
}

/** Mensagem amigável a partir de erros do PostgreSQL (RAISE EXCEPTION dos triggers). */
export function msgErro(e: unknown): string {
  const err = e as { code?: string; message?: string };
  if (err?.code === 'P0001' && err.message) return err.message;
  if (err?.code === '23505') return 'Registro duplicado (já existe um cadastro com esses dados).';
  if (err?.code === '23503') return 'Registro vinculado a outro cadastro.';
  console.error(e);
  return 'Não foi possível concluir a operação.';
}
