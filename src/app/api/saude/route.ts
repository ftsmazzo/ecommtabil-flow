import { NextResponse } from 'next/server';
import { q1 } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Verificação de saúde (monitoramento / balanceador). */
export async function GET() {
  try {
    await q1('SELECT 1');
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
