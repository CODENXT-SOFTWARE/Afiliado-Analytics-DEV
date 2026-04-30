/**
 * Retorna a chave VAPID pública pra o browser inscrever no PushManager. Sem
 * isso o cliente não consegue gerar uma subscription válida.
 *
 * Não é segredo — é embutida na URL do push e usada pra validar a origem do
 * publisher. A chave PRIVADA (que assina) fica só no servidor.
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  if (!publicKey) {
    return NextResponse.json(
      { error: "VAPID_PUBLIC_KEY não configurada no servidor." },
      { status: 500 },
    );
  }
  return NextResponse.json({ publicKey });
}
