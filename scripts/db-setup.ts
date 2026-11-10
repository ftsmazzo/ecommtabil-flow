/**
 * Instala o banco do EcommFlow (estrutura + dados do escritório da pasta banco/dados).
 *   npm run db:setup
 *   npm run db:setup -- --somente-estrutura
 * Requer DATABASE_URL no .env (ou no ambiente). Use em banco vazio.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';

process.loadEnvFile?.('.env');

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const rodar = async (arq: string) => {
    process.stdout.write(`→ ${arq} ... `);
    await c.query(readFileSync(arq, 'utf8'));
    console.log('ok');
  };
  const existe = await c.query("SELECT to_regclass('public.tarefas') IS NOT NULL AS e");
  if (existe.rows[0].e) {
    console.log('O banco já possui a estrutura do EcommFlow. Nada foi alterado (use um banco vazio).');
    return c.end();
  }
  await rodar('banco/01_estrutura.sql');
  if (!process.argv.includes('--somente-estrutura')) {
    for (const f of readdirSync('banco/dados').filter((x) => x.endsWith('.sql')).sort()) await rodar(join('banco/dados', f));
    console.log('\nPronto. Defina a senha de cada usuário com:  npm run senha -- <usuario>');
  }
  await c.end();
}
main().catch((e) => { console.error('\nERRO:', e.message); process.exit(1); });
