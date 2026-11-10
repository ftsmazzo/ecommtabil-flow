/**
 * Define/redefine a senha de um usuário (a senha é gravada apenas como hash bcrypt).
 *   npm run senha -- Junior            (pede a senha no terminal, sem exibir)
 */
import { Client } from 'pg';
import { createInterface } from 'node:readline';

process.loadEnvFile?.('.env');

function perguntarOculto(msg: string): Promise<string> {
  return new Promise((ok) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    (rl as any)._writeToOutput = (s: string) => { if (s.includes(msg)) (rl as any).output.write(s); };
    rl.question(msg, (r) => { rl.close(); process.stdout.write('\n'); ok(r); });
  });
}

async function main() {
  const usuario = process.argv[2];
  if (!usuario) throw new Error('Uso: npm run senha -- <usuario>');
  const senha = await perguntarOculto(`Nova senha para ${usuario}: `);
  if (senha.length < 8 || !/\d/.test(senha) || !/[A-Za-z]/.test(senha)) throw new Error('A senha deve ter pelo menos 8 caracteres, com letras e números.');
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const r = await c.query('SELECT definir_senha($1, $2) AS ok', [usuario, senha]);
  await c.end();
  console.log(r.rows[0]?.ok ? `Senha de ${usuario} definida.` : `Usuário ${usuario} não encontrado.`);
}
main().catch((e) => { console.error('ERRO:', e.message); process.exit(1); });
