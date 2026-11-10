/** Executa a rotina diária direto no banco (alternativa ao endpoint /api/cron/diario). */
import { Client } from 'pg';

process.loadEnvFile?.('.env');

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const r = await c.query('SELECT gerar_tarefas() AS criadas, marcar_atrasadas() AS atrasadas');
  console.log(new Date().toISOString(), r.rows[0]);
  await c.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
