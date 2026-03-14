/**
 * Gera legenda de venda para Stories (Instagram) usando Grok (xAI).
 * Use a variável de ambiente GROK_API_KEY ou XAI_API_KEY no .env.local.
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const GROK_API = "https://api.x.ai/v1/chat/completions";
const MODEL = "grok-4.20-beta-latest-non-reasoning";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GROK_API_KEY || process.env.XAI_API_KEY;
    if (!apiKey?.trim()) {
      return NextResponse.json(
        { error: "Chave da API Grok não configurada. Adicione GROK_API_KEY no .env.local" },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const productName = String(body?.productName ?? "").trim();
    if (!productName) {
      return NextResponse.json({ error: "productName é obrigatório" }, { status: 400 });
    }

    const systemPrompt = `Você é um copywriter de e-commerce e afiliados. Gere legendas de venda para Stories do Instagram em português do Brasil.
Regras:
- Legenda GRANDE e convincente, que gere desejo de compra.
- Tom direto, urgência e benefícios do produto.
- Inclua ao final várias #hashtags relevantes ao produto e ao público (moda, ofertas, promoção, etc.).
- Não invente preço nem link; foque em convencer o lead a tocar no link do Story.
- Uma única resposta: só a legenda com as hashtags, sem título extra.
- LIMITE OBRIGATÓRIO: a legenda (texto + hashtags) NÃO pode ultrapassar 300 caracteres. Conte e respeite esse limite.`;

    const userPrompt = `Gere uma legenda de venda para Stories do Instagram para este produto: "${productName}". Inclua hashtags apelativas no final. Máximo 300 caracteres no total.`;

    const res = await fetch(GROK_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 500,
        temperature: 0.8,
      }),
    });

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      error?: { message?: string };
    };

    if (!res.ok) {
      const msg = data?.error?.message ?? `Grok API error (${res.status})`;
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    let caption = data?.choices?.[0]?.message?.content?.trim() ?? "";
    if (!caption) return NextResponse.json({ error: "Resposta vazia da IA" }, { status: 500 });
    if (caption.length > 300) caption = caption.slice(0, 300).trim();

    return NextResponse.json({ caption });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao gerar legenda" },
      { status: 500 }
    );
  }
}
