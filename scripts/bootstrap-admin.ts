/**
 * Define a senha do usuário bootstrap `admin`.
 *   BOOTSTRAP_ADMIN_PASSWORD=... npm run bootstrap:admin
 *   ou: npm run bootstrap:admin -- MinhaSenha123
 */
import { Client } from 'pg';

process.loadEnvFile?.('.env');

async function main() {
  const senha = process.argv[2] || process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!senha || senha.length < 8 || !/[A-Za-z]/.test(senha) || !/\d/.test(senha)) {
    console.error('Informe senha com ≥8 caracteres, letras e números (arg ou BOOTSTRAP_ADMIN_PASSWORD).');
    process.exit(1);
  }
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const r = await c.query('SELECT definir_senha($1, $2) AS ok', ['admin', senha]);
  if (!r.rows[0]?.ok) {
    console.error('Usuário admin não encontrado. Rode npm run db:setup antes.');
    process.exit(1);
  }
  console.log('Senha do admin definida. Faça login com usuário: admin');
  await c.end();
}
main().catch((e) => { console.error(e.message); process.exit(1); });
