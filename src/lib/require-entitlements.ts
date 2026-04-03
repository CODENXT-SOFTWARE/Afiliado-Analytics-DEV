/**
 * Gate helpers para API routes.
 * Retornam NextResponse 403 se a feature não está liberada para o plano do user.
 */

import { NextResponse } from "next/server";
import { createClient } from "../../utils/supabase/server";
import { getEntitlementsForUser } from "./plan-server";

type GateResult = { allowed: true; userId: string } | { allowed: false; response: NextResponse };

async function gateFeature(
  featureKey: "ati" | "criarCampanhaMeta" | "geradorCriativos" | "espelhamentogrupos" | "especialistagenerate"
): Promise<GateResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { allowed: false, response: NextResponse.json({ error: "Não autorizado" }, { status: 401 }) };
  }
  const ent = await getEntitlementsForUser(supabase, user.id);
  if (!ent[featureKey]) {
    return {
      allowed: false,
      response: NextResponse.json(
        { error: "Recurso disponível apenas no Plano Pro. Faça upgrade para acessar." },
        { status: 403 }
      ),
    };
  }
  return { allowed: true, userId: user.id };
}

export async function gateAti(): Promise<GateResult> {
  return gateFeature("ati");
}

export async function gateCriarCampanhaMeta(): Promise<GateResult> {
  return gateFeature("criarCampanhaMeta");
}

export async function gateGeradorCriativos(): Promise<GateResult> {
  return gateFeature("geradorCriativos");
}

export async function gateEspelhamentoGrupos(): Promise<GateResult> {
  return gateFeature("espelhamentogrupos");
}

export async function gateEspecialistaGenerate(): Promise<GateResult> {
  return gateFeature("especialistagenerate");
}
