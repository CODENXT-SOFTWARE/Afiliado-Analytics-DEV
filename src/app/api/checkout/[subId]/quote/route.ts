import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { cotarFrete, type SuperFreteOption } from "@/lib/frete/superfrete";

export const dynamic = "force-dynamic";

type ProductRow = {
  user_id: string;
  allow_shipping: boolean | null;
  shipping_cost: number | string | null;
  peso_g: number | string | null;
  altura_cm: number | string | null;
  largura_cm: number | string | null;
  comprimento_cm: number | string | null;
};

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function POST(req: Request, ctx: { params: Promise<{ subId: string }> }) {
  try {
    const { subId } = await ctx.params;
    if (!subId) return NextResponse.json({ error: "subId obrigatório" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const cepDestino = String(body?.cepDestino ?? "").trim();
    if (!cepDestino) return NextResponse.json({ error: "CEP obrigatório" }, { status: 400 });

    const supabase = createAdminClient();
    const { data: produto, error } = await supabase
      .from("produtos_infoprodutor")
      .select("user_id, allow_shipping, shipping_cost, peso_g, altura_cm, largura_cm, comprimento_cm")
      .eq("stripe_subid", subId)
      .eq("provider", "stripe")
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!produto) return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });

    const row = produto as ProductRow;
    if (!row.allow_shipping) {
      return NextResponse.json({ error: "Produto não aceita envio" }, { status: 400 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("shipping_sender_cep")
      .eq("id", row.user_id)
      .maybeSingle();
    const cepOrigem = (profile as { shipping_sender_cep?: string | null } | null)?.shipping_sender_cep ?? "";
    if (!cepOrigem) {
      return NextResponse.json(
        { error: "Vendedor não configurou CEP de origem" },
        { status: 503 },
      );
    }

    const pesoG = num(row.peso_g);
    const alturaCm = num(row.altura_cm);
    const larguraCm = num(row.largura_cm);
    const comprimentoCm = num(row.comprimento_cm);
    const shippingCostFallback = num(row.shipping_cost) ?? 0;

    // Se não tem dimensões cadastradas, pula SuperFrete e retorna só o fixo
    if (!pesoG || !alturaCm || !larguraCm || !comprimentoCm) {
      return NextResponse.json({
        options: [
          {
            id: 0,
            name: "Frete",
            price: shippingCostFallback,
            deliveryTime: null,
            source: "fallback" as const,
          },
        ],
        fallback: true,
      });
    }

    try {
      const raw: SuperFreteOption[] = await cotarFrete({
        cepOrigem,
        cepDestino,
        pesoKg: pesoG / 1000,
        alturaCm,
        larguraCm,
        comprimentoCm,
      });
      const options = raw
        .filter((o) => !o.error && o.price > 0)
        .map((o) => ({
          id: o.id,
          name: o.name,
          price: o.price,
          deliveryTime: o.deliveryTime,
          source: "superfrete" as const,
        }));

      if (options.length === 0) {
        // SuperFrete devolveu sem opções utilizáveis — fallback
        return NextResponse.json({
          options: [
            {
              id: 0,
              name: "Frete",
              price: shippingCostFallback,
              deliveryTime: null,
              source: "fallback" as const,
            },
          ],
          fallback: true,
        });
      }

      return NextResponse.json({ options, fallback: false });
    } catch {
      // API SuperFrete fora do ar — fallback
      return NextResponse.json({
        options: [
          {
            id: 0,
            name: "Frete",
            price: shippingCostFallback,
            deliveryTime: null,
            source: "fallback" as const,
          },
        ],
        fallback: true,
      });
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}
