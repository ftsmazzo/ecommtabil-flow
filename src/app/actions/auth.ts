'use server';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { q1, tx } from '@/lib/db';
import { assinar, COOKIE, DURACAO_HORAS } from '@/lib/session';

// Proteção simples contra força bruta (por IP + usuário). Em vários servidores, usar Redis.
const tentativas = new Map<string, { n: number; ate: number }>();
const MAX = 5;
const JANELA_MS = 15 * 60 * 1000;

export async function entrar(_prev: { erro?: string } | undefined, fd: FormData): Promise<{ erro?: string }> {
  const usuario = String(fd.get('usuario') || '').trim();
  const senha = String(fd.get('senha') || '');
  if (!usuario || !senha) return { erro: 'Informe usuário e senha.' };

  const ip = headers().get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  const chave = `${ip}|${usuario.toLowerCase()}`;
  const t = tentativas.get(chave);
  if (t && t.n >= MAX && t.ate > Date.now()) return { erro: 'Muitas tentativas. Aguarde 15 minutos e tente novamente.' };

  const u = await q1<{ id: number; nome: string; perfil: 'gestor' | 'operador'; escritorio_id: number; escritorio: string }>(
    'SELECT * FROM autenticar($1, $2)',
    [usuario, senha],
  );
  if (!u) {
    const atual = t && t.ate > Date.now() ? t : { n: 0, ate: Date.now() + JANELA_MS };
    tentativas.set(chave, { n: atual.n + 1, ate: atual.ate });
    return { erro: 'Usuário ou senha inválidos.' };
  }
  tentativas.delete(chave);
  await tx(null, (c) => c.query('UPDATE operadores SET ultimo_acesso = now() WHERE id = $1', [u.id]));

  const token = await assinar({ id: u.id, nome: u.nome, perfil: u.perfil, esc: u.escritorio_id, escNome: u.escritorio });
  cookies().set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: DURACAO_HORAS * 3600,
  });
  redirect('/dashboard');
}

export async function sair() {
  cookies().delete(COOKIE);
  redirect('/login');
}
