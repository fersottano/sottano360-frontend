import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { request as httpRequest } from 'http';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export const maxDuration = 300; // 5 minutos — para Vercel/producción

// Usa http.request (Node.js core) en lugar de fetch() global para evitar
// el headersTimeout de 300s que tiene undici por defecto en Node.js 18+.
// El backend puede tardar >5 minutos en rangos amplios (múltiples bloques).
function callBackend(backendUrl: string, body: string): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      `${backendUrl}/api/datos`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => { text += chunk; });
        res.on('end', () => resolve({ status: res.statusCode ?? 200, text }));
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

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

  let result: { status: number; text: string };
  try {
    result = await callBackend(backendUrl!, JSON.stringify({
      usuario:  process.env.ADMIN_USER,
      password: process.env.ADMIN_PASSWORD,
      modulo,
      desde,
      hasta,
    }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error de red';
    console.error('[datos] Error conectando al backend:', msg);
    return NextResponse.json({ error: `No se pudo conectar al backend: ${msg}` }, { status: 502 });
  }

  console.log(`[datos] ← backend status=${result.status}`);

  if (!result.text) {
    console.error('[datos] Respuesta vacía del backend');
    return NextResponse.json({ error: 'Respuesta vacía del backend' }, { status: 502 });
  }

  let data: unknown;
  try {
    data = JSON.parse(result.text);
  } catch {
    console.error('[datos] Respuesta no es JSON:', result.text.substring(0, 200));
    return NextResponse.json({ error: 'Respuesta inválida del backend' }, { status: 502 });
  }

  return NextResponse.json(data, { status: result.status });
}
