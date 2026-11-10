import 'server-only';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { isRedirectError } from 'next/dist/client/components/redirect';
import { msgErro } from './db';

export class ErroNegocio extends Error {}

export function voltar(fd: FormData, padrao = '/dashboard') {
  const b = String(fd.get('back') || '');
  return b.startsWith('/') && !b.startsWith('//') ? b : padrao;
}

/** Executa uma ação de formulário: trata erros, mostra aviso e volta para a tela de origem. */
export async function executar(fd: FormData, fn: () => Promise<string | void>, okMsg: string, padrao = '/dashboard') {
  let msg = okMsg;
  let tipo: 'ok' | 'erro' = 'ok';
  let destino = voltar(fd, padrao);
  try {
    const r = await fn();
    if (typeof r === 'string' && r.startsWith('/')) destino = r;
  } catch (e) {
    if (isRedirectError(e)) throw e;
    tipo = 'erro';
    msg = e instanceof ErroNegocio ? e.message : msgErro(e);
  }
  revalidatePath('/', 'layout');
  // A mensagem de retorno vai na URL (lida e removida pelo componente <Flash/>)
  const m = encodeURIComponent(JSON.stringify({ tipo, msg }));
  redirect(`${destino}${destino.includes('?') ? '&' : '?'}m=${m}`);
}

export const txt = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
export const num = (fd: FormData, k: string) => {
  const v = parseInt(txt(fd, k), 10);
  return Number.isFinite(v) ? v : null;
};
export const bool = (fd: FormData, k: string) => fd.get(k) === 'on' || fd.get(k) === 'true';
