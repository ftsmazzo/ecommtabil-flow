import { NextRequest, NextResponse } from 'next/server';
import { COOKIE, verificar } from '@/lib/session';

const PUBLICAS = ['/login', '/api/cron', '/api/saude'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLICAS.some((p) => pathname.startsWith(p))) return NextResponse.next();
  const s = await verificar(req.cookies.get(COOKIE)?.value);
  if (!s) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }
  if ((pathname.startsWith('/financeiro') || pathname.startsWith('/equipe') || pathname.startsWith('/cadastros') ||
       pathname.startsWith('/rotinas') || pathname.startsWith('/historico') || pathname === '/tarefas') && s.perfil !== 'gestor') {
    const url = req.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg).*)'] };
