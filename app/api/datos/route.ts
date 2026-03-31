import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { modulo, desde, hasta } = await req.json();
  if (!modulo || !desde || !hasta)
    return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });

  const backendUrl = process.env.BACKEND_URL;
  const res = await fetch(`${backendUrl}/api/datos`, {
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

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
