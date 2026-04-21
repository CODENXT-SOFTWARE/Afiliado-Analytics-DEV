"use client";

import { useEffect, useState } from "react";
import { MapPin, Loader2, Trash2, MessageCircle } from "lucide-react";
import Toolist from "@/app/components/ui/Toolist";
import WhatsAppInputBR, {
  stripBRPrefix,
  toBRWhatsappWithPrefix,
} from "@/app/components/ui/WhatsAppInputBR";

type ShippingProfile = {
  shipping_sender_name: string;
  shipping_sender_document: string;
  shipping_sender_phone: string;
  shipping_sender_whatsapp: string;
  shipping_sender_cep: string;
  shipping_sender_street: string;
  shipping_sender_number: string;
  shipping_sender_complement: string;
  shipping_sender_neighborhood: string;
  shipping_sender_city: string;
  shipping_sender_uf: string;
};

const EMPTY: ShippingProfile = {
  shipping_sender_name: "",
  shipping_sender_document: "",
  shipping_sender_phone: "",
  shipping_sender_whatsapp: "",
  shipping_sender_cep: "",
  shipping_sender_street: "",
  shipping_sender_number: "",
  shipping_sender_complement: "",
  shipping_sender_neighborhood: "",
  shipping_sender_city: "",
  shipping_sender_uf: "",
};

function digits(v: string): string {
  return v.replace(/\D/g, "");
}

/** Mascara CEP brasileiro: só dígitos (máx 8), formatado como XXXXX-XXX. */
function maskCep(v: string): string {
  const d = digits(v).slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

export default function ShippingProfileCard() {
  const [form, setForm] = useState<ShippingProfile>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/settings/shipping-profile");
        const json = await res.json();
        if (res.ok) {
          // Remove prefixo "55" do WhatsApp salvo pra exibir só o número nacional no input.
          const loadedWhatsapp = typeof json.shipping_sender_whatsapp === "string"
            ? stripBRPrefix(json.shipping_sender_whatsapp)
            : "";
          setForm({ ...EMPTY, ...json, shipping_sender_whatsapp: loadedWhatsapp });
        }
      } catch {
        /* silêncio — perfil vazio */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const set = <K extends keyof ShippingProfile>(k: K, v: string) => {
    setForm((prev) => ({ ...prev, [k]: v }));
    setOk(false);
  };

  const onBlurCep = async () => {
    const cep = digits(form.shipping_sender_cep);
    if (cep.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      if (!res.ok) return;
      const j = await res.json();
      if (j?.erro) return;
      setForm((prev) => ({
        ...prev,
        shipping_sender_street: prev.shipping_sender_street || j.logradouro || "",
        shipping_sender_neighborhood: prev.shipping_sender_neighborhood || j.bairro || "",
        shipping_sender_city: prev.shipping_sender_city || j.localidade || "",
        shipping_sender_uf: prev.shipping_sender_uf || (j.uf || "").toUpperCase(),
      }));
    } catch {
      /* ignore — usuário digita manual */
    } finally {
      setCepLoading(false);
    }
  };

  const onSave = async () => {
    setSaving(true);
    setError(null);
    setOk(false);
    const cepDigits = digits(form.shipping_sender_cep);
    if (cepDigits && cepDigits.length !== 8) {
      setError("CEP precisa ter 8 dígitos (formato brasileiro: 00000-000).");
      setSaving(false);
      return;
    }
    try {
      // WhatsApp salvo no Supabase no formato "55" + DDD + número (sem + nem máscara).
      // Backend/n8n recebe 5579999062401, ex. Se o usuário esvaziou o campo, envia vazio.
      const whatsappDigits = form.shipping_sender_whatsapp.trim()
        ? toBRWhatsappWithPrefix(form.shipping_sender_whatsapp)
        : "";
      const res = await fetch("/api/settings/shipping-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          shipping_sender_cep: cepDigits,
          shipping_sender_whatsapp: whatsappDigits,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao salvar");
      setOk(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  };

  const onRemove = async () => {
    setRemoving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/shipping-profile", { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao remover");
      setForm(EMPTY);
      setConfirmRemove(false);
      setOk(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setRemoving(false);
    }
  };

  if (loading) {
    return (
      <section className="bg-dark-card border border-dark-border rounded-lg p-8 flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-shopee-orange" />
      </section>
    );
  }

  const hasAny = Object.values(form).some((v) => v && v.trim());

  const inputCls =
    "w-full rounded-md border border-dark-border bg-dark-bg py-2 px-3 text-text-primary placeholder-text-secondary/60 focus:border-shopee-orange focus:outline-none focus:ring-1 focus:ring-shopee-orange sm:text-sm";
  const labelCls = "text-sm font-semibold text-text-secondary";

  return (
    <section className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
      <div className="bg-dark-bg/40 border-b border-dark-border px-5 py-4">
        <h2 className="text-base sm:text-lg font-semibold text-text-primary font-heading">
          Endereço do remetente
        </h2>
        <p className="text-xs text-text-secondary mt-1">
          Usado na etiqueta de envio dos pedidos.
        </p>
      </div>

      <div className="px-5 py-5 space-y-4">
        {hasAny && !confirmRemove ? (
          <button
            type="button"
            onClick={() => setConfirmRemove(true)}
            className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-red-400 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Limpar endereço
          </button>
        ) : null}

        {confirmRemove ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-red-500/30 bg-red-500/5 p-3">
            <p className="text-xs text-text-secondary flex-1 min-w-[200px]">Apagar o endereço do remetente?</p>
            <button
              type="button"
              onClick={() => setConfirmRemove(false)}
              className="rounded-md px-3 py-1.5 text-xs font-semibold text-text-secondary hover:bg-dark-bg"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void onRemove()}
              disabled={removing}
              className="rounded-md px-3 py-1.5 text-xs font-semibold bg-red-500/20 text-red-300 hover:bg-red-500/30 disabled:opacity-60"
            >
              {removing ? "Apagando…" : "Apagar"}
            </button>
          </div>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Nome / Razão social</label>
            <input
              value={form.shipping_sender_name}
              onChange={(e) => set("shipping_sender_name", e.target.value)}
              placeholder="João da Silva"
              className={`mt-1 ${inputCls}`}
            />
          </div>
          <div>
            <label className={labelCls}>CPF / CNPJ (opcional)</label>
            <input
              value={form.shipping_sender_document}
              onChange={(e) => set("shipping_sender_document", e.target.value)}
              placeholder="000.000.000-00"
              className={`mt-1 ${inputCls}`}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>
              <MapPin className="inline h-3.5 w-3.5 mr-1 text-shopee-orange" />
              CEP
            </label>
            <div className="relative">
              <input
                value={form.shipping_sender_cep}
                onChange={(e) => set("shipping_sender_cep", maskCep(e.target.value))}
                onBlur={() => void onBlurCep()}
                inputMode="numeric"
                maxLength={9}
                placeholder="00000-000"
                className={`mt-1 ${inputCls} pr-8`}
              />
              {cepLoading ? (
                <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-shopee-orange" />
              ) : null}
            </div>
            <p className="text-[10px] text-text-secondary mt-1">Preenchimento automático via ViaCEP.</p>
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Telefone</label>
            <input
              value={form.shipping_sender_phone}
              onChange={(e) => set("shipping_sender_phone", e.target.value)}
              placeholder="(11) 99999-0000"
              className={`mt-1 ${inputCls}`}
            />
          </div>
        </div>

        <div>
          <label className={`${labelCls} flex items-center gap-1.5`}>
            <MessageCircle className="inline h-3.5 w-3.5 text-emerald-400" />
            <span>WhatsApp da loja</span>
            <Toolist
              variant="floating"
              wide
              text="Aparece no checkout Stripe como link clicável e na tela de confirmação após o pagamento. Ao salvar, todos os seus Payment Links são atualizados automaticamente na Stripe."
            />
          </label>
          <div className="mt-1">
            <WhatsAppInputBR
              value={form.shipping_sender_whatsapp}
              onChange={(v) => set("shipping_sender_whatsapp", v)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_100px_120px] gap-3">
          <div>
            <label className={labelCls}>Rua / Logradouro</label>
            <input
              value={form.shipping_sender_street}
              onChange={(e) => set("shipping_sender_street", e.target.value)}
              placeholder="Rua Exemplo"
              className={`mt-1 ${inputCls}`}
            />
          </div>
          <div>
            <label className={labelCls}>Número</label>
            <input
              value={form.shipping_sender_number}
              onChange={(e) => set("shipping_sender_number", e.target.value)}
              placeholder="123"
              className={`mt-1 ${inputCls}`}
            />
          </div>
          <div>
            <label className={labelCls}>Complemento</label>
            <input
              value={form.shipping_sender_complement}
              onChange={(e) => set("shipping_sender_complement", e.target.value)}
              placeholder="Apto 4"
              className={`mt-1 ${inputCls}`}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_80px] gap-3">
          <div>
            <label className={labelCls}>Bairro</label>
            <input
              value={form.shipping_sender_neighborhood}
              onChange={(e) => set("shipping_sender_neighborhood", e.target.value)}
              placeholder="Centro"
              className={`mt-1 ${inputCls}`}
            />
          </div>
          <div>
            <label className={labelCls}>Cidade</label>
            <input
              value={form.shipping_sender_city}
              onChange={(e) => set("shipping_sender_city", e.target.value)}
              placeholder="São Paulo"
              className={`mt-1 ${inputCls}`}
            />
          </div>
          <div>
            <label className={labelCls}>UF</label>
            <input
              value={form.shipping_sender_uf}
              onChange={(e) => set("shipping_sender_uf", e.target.value.toUpperCase().slice(0, 2))}
              placeholder="SP"
              maxLength={2}
              className={`mt-1 ${inputCls} uppercase`}
            />
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap pt-2">
          <button
            type="button"
            onClick={() => void onSave()}
            disabled={saving}
            className="inline-flex items-center justify-center rounded-md px-5 py-2 text-sm font-semibold text-white bg-shopee-orange hover:opacity-90 disabled:opacity-60 transition-opacity"
          >
            {saving ? "Salvando…" : "Salvar endereço"}
          </button>
          {ok && <span className="text-sm text-green-400">Endereço salvo.</span>}
          {error && <span className="text-sm text-red-400">{error}</span>}
        </div>
      </div>
    </section>
  );
}
