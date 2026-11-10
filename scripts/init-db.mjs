/**
 * Aplica estrutura + bootstrap se a tabela tarefas ainda não existir.
 * Usado no entrypoint Docker (produção EasyPanel).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL ausente');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

const exists = await client.query("SELECT to_regclass('public.tarefas') IS NOT NULL AS e");
if (exists.rows[0].e) {
  console.log('DB já inicializado.');
} else {
  const run = async (path) => {
    process.stdout.write(`→ ${path} ... `);
    await client.query(readFileSync(path, 'utf8'));
    console.log('ok');
  };
  await run('banco/01_estrutura.sql');
  for (const f of readdirSync('banco/dados').filter((x) => x.endsWith('.sql')).sort()) {
    await run(join('banco/dados', f));
  }
  console.log('Estrutura + bootstrap aplicados.');
}

const senha = process.env.BOOTSTRAP_ADMIN_PASSWORD;
if (senha && senha.length >= 8) {
  const r = await client.query('SELECT definir_senha($1, $2) AS ok', ['admin', senha]);
  if (r.rows[0]?.ok) console.log('Senha do admin (re)definida via BOOTSTRAP_ADMIN_PASSWORD.');
  else console.warn('admin não encontrado para definir senha.');
}

await client.end();
