import { NextResponse } from "next/server";
import { gateEspecialistaGenerate } from "@/lib/require-entitlements";
import { veoFetchPredictOperation } from "@/lib/vertex/veo-long-running";

export const maxDuration = 60;

export async function POST(req: Request) {
  const gate = await gateEspecialistaGenerate();
  if (!gate.allowed) return gate.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const op =
    body && typeof body === "object" && typeof (body as { operationName?: string }).operationName === "string"
      ? (body as { operationName: string }).operationName.trim()
      : "";

  if (!op || !op.includes("/operations/")) {
    return NextResponse.json({ error: "operationName inválido" }, { status: 400 });
  }

  try {
    const result = await veoFetchPredictOperation(op);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao consultar operação Veo";
    console.error("expert-generator/veo-poll", e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
