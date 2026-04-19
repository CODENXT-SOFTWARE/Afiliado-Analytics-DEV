const SUPERFRETE_BASE_URL = "https://api.superfrete.com";

export type SuperFreteInput = {
  cepOrigem: string;
  cepDestino: string;
  pesoKg: number;
  alturaCm: number;
  larguraCm: number;
  comprimentoCm: number;
};

export type SuperFreteOption = {
  id: number;
  name: string;
  price: number;
  deliveryTime: number | null;
  error: string | null;
};

function onlyDigits(s: string): string {
  return (s || "").replace(/\D/g, "");
}

function parseMoney(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export async function cotarFrete(input: SuperFreteInput): Promise<SuperFreteOption[]> {
  const token = process.env.SUPER_FRETE_API;
  if (!token) {
    throw new Error("SUPER_FRETE_API não configurada");
  }

  const from = onlyDigits(input.cepOrigem);
  const to = onlyDigits(input.cepDestino);
  if (from.length !== 8 || to.length !== 8) {
    throw new Error("CEP inválido (precisa ter 8 dígitos)");
  }
  if (input.pesoKg <= 0 || input.alturaCm <= 0 || input.larguraCm <= 0 || input.comprimentoCm <= 0) {
    throw new Error("Peso e dimensões precisam ser maiores que zero");
  }

  const body = {
    from: { postal_code: from },
    to: { postal_code: to },
    services: "1,2,17",
    options: { own_hand: false, receipt: false, insurance_value: 0, use_insurance_value: false },
    package: {
      weight: input.pesoKg,
      height: input.alturaCm,
      width: input.larguraCm,
      length: input.comprimentoCm,
    },
  };

  const res = await fetch(`${SUPERFRETE_BASE_URL}/api/v0/calculator`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "Afiliado Analytics (contato@afiliadoanalytics.com.br)",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`SuperFrete retornou resposta inválida (${res.status})`);
  }

  if (!res.ok) {
    const msg =
      (json && typeof json === "object" && "message" in json && typeof (json as { message: unknown }).message === "string"
        ? (json as { message: string }).message
        : null) || `Erro SuperFrete (${res.status})`;
    throw new Error(msg);
  }

  if (!Array.isArray(json)) {
    throw new Error("SuperFrete retornou formato inesperado");
  }

  return json.map((item: Record<string, unknown>) => ({
    id: Number(item.id) || 0,
    name: String(item.name ?? ""),
    price: parseMoney(item.price),
    deliveryTime:
      typeof item.delivery_time === "number"
        ? item.delivery_time
        : typeof item.delivery_time === "string"
          ? Number(item.delivery_time) || null
          : null,
    error: typeof item.error === "string" ? item.error : null,
  }));
}
