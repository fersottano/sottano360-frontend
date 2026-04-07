import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export const maxDuration = 300; // 5 minutos — rangos amplios requieren múltiples bloques

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  let body: { modulo?: string; desde?: string; hasta?: string };
  try {
    body = await req.json();
  } catch {
    console.error('[datos] Body inválido o vacío');
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
  }

  const { modulo, desde, hasta } = body;
  if (!modulo || !desde || !hasta) {
    console.error('[datos] Faltan parámetros:', { modulo, desde, hasta });
    return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
  }

  const backendUrl = process.env.BACKEND_URL;
  console.log(`[datos] → backend ${backendUrl} modulo=${modulo} desde=${desde} hasta=${hasta}`);

  let res: Response;
  try {
    res = await fetch(`${backendUrl}/api/datos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usuario:  process.env.ADMIN_USER,
        password: process.env.ADMIN_PASSWORD,
        modulo,
        desde,
        hasta,
      }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error de red';
    console.error('[datos] Error conectando al backend:', msg);
    return NextResponse.json({ error: `No se pudo conectar al backend: ${msg}` }, { status: 502 });
  }

  console.log(`[datos] ← backend status=${res.status}`);

  const text = await res.text();
  if (!text) {
    console.error('[datos] Respuesta vacía del backend');
    return NextResponse.json({ error: 'Respuesta vacía del backend' }, { status: 502 });
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    console.error('[datos] Respuesta no es JSON:', text.substring(0, 200));
    return NextResponse.json({ error: 'Respuesta inválida del backend' }, { status: 502 });
  }

  return NextResponse.json(data, { status: res.status });
}
