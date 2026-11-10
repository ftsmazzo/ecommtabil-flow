import { SignJWT, jwtVerify } from 'jose';

export const COOKIE = 'ef_sess';
export const DURACAO_HORAS = 12;

export type Sessao = {
  id: number;
  nome: string;
  perfil: 'gestor' | 'operador';
  esc: number;
  escNome: string;
};

function chave() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('SESSION_SECRET ausente ou curto (mínimo 32 caracteres).');
  return new TextEncoder().encode(s);
}

export async function assinar(s: Sessao): Promise<string> {
  return new SignJWT({ ...s })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${DURACAO_HORAS}h`)
    .sign(chave());
}

export async function verificar(token?: string): Promise<Sessao | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, chave());
    return { id: payload.id as number, nome: payload.nome as string, perfil: payload.perfil as Sessao['perfil'], esc: payload.esc as number, escNome: payload.escNome as string };
  } catch {
    return null;
  }
}
