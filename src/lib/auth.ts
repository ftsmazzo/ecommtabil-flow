import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { q1 } from './db';
import { COOKIE, Sessao, verificar } from './session';

export async function sessao(): Promise<Sessao | null> {
  return verificar(cookies().get(COOKIE)?.value);
}

/** Exige usuário logado e ativo (revalida no banco a cada requisição). */
export async function exigirUsuario(): Promise<Sessao> {
  const s = await sessao();
  if (!s) redirect('/login');
  const u = await q1<{ ativo: boolean; perfil: Sessao['perfil'] }>(
    'SELECT o.ativo AND e.ativo AS ativo, o.perfil FROM operadores o JOIN escritorios e ON e.id = o.escritorio_id WHERE o.id = $1',
    [s.id],
  );
  if (!u?.ativo) redirect('/login?expirado=1');
  return { ...s, perfil: u.perfil };
}

export async function exigirGestor(): Promise<Sessao> {
  const s = await exigirUsuario();
  if (s.perfil !== 'gestor') redirect('/dashboard');
  return s;
}

export const ehGestor = (s: Sessao) => s.perfil === 'gestor';
