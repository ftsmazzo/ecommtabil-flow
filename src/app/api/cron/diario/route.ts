import { NextRequest, NextResponse } from 'next/server';
import { q1 } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Rotina diária: gera as tarefas das rotinas (janela de antecedência) e marca as atrasadas.
 * Chamar 1x por dia (crontab da VPS):  curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://SEU-DOMINIO/api/cron/diario
 */
export async function GET(req: NextRequest) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || req.headers.get('authorization') !== `Bearer ${segredo}`) {
    return NextResponse.json({ erro: 'não autorizado' }, { status: 401 });
  }
  const r = await q1<{ criadas: number; atrasadas: number }>('SELECT gerar_tarefas() AS criadas, marcar_atrasadas() AS atrasadas');
  return NextResponse.json({ ok: true, ...r, em: new Date().toISOString() });
}
