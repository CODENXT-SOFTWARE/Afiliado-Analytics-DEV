"use client";

import { useState } from "react";
import { Calculator, Loader2, Truck, ChevronDown, ChevronUp } from "lucide-react";

type Option = {
  id: number;
  name: string;
  price: number;
  deliveryTime: number | null;
  error: string | null;
};

function formatBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function maskCep(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

export default function FreteCalculator({
  onPick,
  disabled,
}: {
  onPick: (valor: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [cepOrigem, setCepOrigem] = useState("");
  const [cepDestino, setCepDestino] = useState("");
  const [pesoKg, setPesoKg] = useState("0,3");
  const [alturaCm, setAlturaCm] = useState("5");
  const [larguraCm, setLarguraCm] = useState("15");
  const [comprimentoCm, setComprimentoCm] = useState("20");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<Option[] | null>(null);

  const canCalc =
    cepOrigem.replace(/\D/g, "").length === 8 &&
    cepDestino.replace(/\D/g, "").length === 8 &&
    parseFloat(pesoKg.replace(",", ".")) > 0;

  async function calcular() {
    setLoading(true);
    setError(null);
    setOptions(null);
    try {
      const res = await fetch("/api/frete/cotacao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cepOrigem,
          cepDestino,
          pesoKg: parseFloat(pesoKg.replace(",", ".")),
          alturaCm: parseFloat(alturaCm.replace(",", ".")),
          larguraCm: parseFloat(larguraCm.replace(",", ".")),
          comprimentoCm: parseFloat(comprimentoCm.replace(",", ".")),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao cotar frete");
      setOptions(json.options as Option[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  function usar(price: number) {
    onPick(price.toFixed(2).replace(".", ","));
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-[#a8a2ff] hover:text-[#c7c2ff] disabled:opacity-40"
      >
        <Calculator className="w-3 h-3" />
        Calcular via SuperFrete
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {open ? (
        <div className="mt-2 p-3 rounded-xl border border-[#3e3e46] bg-[#1c1c1f] space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[9px] font-bold text-[#9a9aa2] uppercase tracking-wider mb-1">
                CEP origem
              </label>
              <input
                type="text"
                value={cepOrigem}
                onChange={(e) => setCepOrigem(maskCep(e.target.value))}
                placeholder="00000-000"
                className="w-full bg-[#222228] border border-[#3e3e46] rounded-lg px-2 py-1.5 text-[11px] text-[#f0f0f2] placeholder:text-[#686868] focus:border-[#635bff] outline-none"
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold text-[#9a9aa2] uppercase tracking-wider mb-1">
                CEP destino (teste)
              </label>
              <input
                type="text"
                value={cepDestino}
                onChange={(e) => setCepDestino(maskCep(e.target.value))}
                placeholder="00000-000"
                className="w-full bg-[#222228] border border-[#3e3e46] rounded-lg px-2 py-1.5 text-[11px] text-[#f0f0f2] placeholder:text-[#686868] focus:border-[#635bff] outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className="block text-[9px] font-bold text-[#9a9aa2] uppercase tracking-wider mb-1">
                Peso (kg)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={pesoKg}
                onChange={(e) => setPesoKg(e.target.value)}
                className="w-full bg-[#222228] border border-[#3e3e46] rounded-lg px-2 py-1.5 text-[11px] text-[#f0f0f2] focus:border-[#635bff] outline-none"
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold text-[#9a9aa2] uppercase tracking-wider mb-1">
                Altura (cm)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={alturaCm}
                onChange={(e) => setAlturaCm(e.target.value)}
                className="w-full bg-[#222228] border border-[#3e3e46] rounded-lg px-2 py-1.5 text-[11px] text-[#f0f0f2] focus:border-[#635bff] outline-none"
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold text-[#9a9aa2] uppercase tracking-wider mb-1">
                Largura (cm)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={larguraCm}
                onChange={(e) => setLarguraCm(e.target.value)}
                className="w-full bg-[#222228] border border-[#3e3e46] rounded-lg px-2 py-1.5 text-[11px] text-[#f0f0f2] focus:border-[#635bff] outline-none"
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold text-[#9a9aa2] uppercase tracking-wider mb-1">
                Compr. (cm)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={comprimentoCm}
                onChange={(e) => setComprimentoCm(e.target.value)}
                className="w-full bg-[#222228] border border-[#3e3e46] rounded-lg px-2 py-1.5 text-[11px] text-[#f0f0f2] focus:border-[#635bff] outline-none"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={calcular}
            disabled={!canCalc || loading}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#635bff] text-white text-[11px] font-bold hover:bg-[#5048e5] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calculator className="w-3.5 h-3.5" />}
            {loading ? "Calculando..." : "Calcular"}
          </button>

          {error ? (
            <p className="text-[10px] text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-2 py-1.5">
              {error}
            </p>
          ) : null}

          {options && options.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-[9px] font-bold text-[#9a9aa2] uppercase tracking-wider">Opções</p>
              {options.map((opt) => (
                <div
                  key={opt.id}
                  className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border ${
                    opt.error ? "border-[#3e3e46] bg-[#222228]/50 opacity-60" : "border-[#3e3e46] bg-[#222228]"
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Truck className="w-3 h-3 text-[#a8a2ff] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-[#f0f0f2] truncate">{opt.name}</p>
                      {opt.error ? (
                        <p className="text-[9px] text-amber-300 truncate">{opt.error}</p>
                      ) : opt.deliveryTime ? (
                        <p className="text-[9px] text-[#7a7a80]">{opt.deliveryTime} dia{opt.deliveryTime === 1 ? "" : "s"} úteis</p>
                      ) : null}
                    </div>
                  </div>
                  {!opt.error ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-mono font-bold text-emerald-400 tabular-nums">
                        {formatBRL(opt.price)}
                      </span>
                      <button
                        type="button"
                        onClick={() => usar(opt.price)}
                        className="px-2 py-0.5 rounded-md bg-[#635bff]/20 border border-[#635bff]/40 text-[10px] font-bold text-[#a8a2ff] hover:bg-[#635bff]/30"
                      >
                        Usar
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
