"use client";

import { useEffect, useRef, useState } from "react";
import PreviewViewportShim from "@/app/components/ui/PreviewViewportShim";
import {
  Loader2,
  Upload,
  Trash2,
  Moon,
  Sun,
  Save,
  CheckCircle2,
  Package,
  Truck,
  Store,
  CreditCard,
  Monitor,
  Smartphone,
  ChevronLeft,
  ChevronRight,
  Palette,
  Sparkles,
  ShieldCheck,
  Clock,
  Flame,
  Eye,
  ShoppingBag,
  ShoppingCart,
} from "lucide-react";
import Toolist from "@/app/components/ui/Toolist";

type Mode = "dark" | "light";
type FooterSize = "full" | "medium" | "small";

type State = {
  mode: Mode;
  headerImageUrl: string | null;
  footerImageUrl: string | null;
  footerImageSize: FooterSize;
  methodCard: boolean;
  methodPix: boolean;
  methodBoleto: boolean;

  // Botão Pagar
  payButtonColor: string;
  payButtonLightSweep: boolean;

  // Gatilhos
  triggerSaleNotifications: boolean;
  triggerCountdown: boolean;
  countdownMinutes: number;
  countdownMessage: string;
  countdownExpiredMessage: string;
  triggerStock: boolean;
  stockInitial: number;
  triggerViewers: boolean;
  viewersMin: number;
  viewersMax: number;
  triggerGuarantee: boolean;
  guaranteeText: string;
};

type ImageSlot = "header" | "footer";

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"]);
const MAX_BYTES = 5 * 1024 * 1024;

const INITIAL: State = {
  mode: "dark",
  headerImageUrl: null,
  footerImageUrl: null,
  footerImageSize: "full",
  methodCard: true,
  methodPix: true,
  methodBoleto: true,
  payButtonColor: "#635bff",
  payButtonLightSweep: false,
  triggerSaleNotifications: false,
  triggerCountdown: false,
  countdownMinutes: 15,
  countdownMessage: "Não feche esta página!",
  countdownExpiredMessage: "Última chance — compre agora!",
  triggerStock: false,
  stockInitial: 12,
  triggerViewers: false,
  viewersMin: 50,
  viewersMax: 200,
  triggerGuarantee: false,
  guaranteeText: "Garantia de 7 dias. Se não gostar, devolvemos seu dinheiro.",
};

type StepId = 1 | 2 | 3 | 4;
const STEPS: { id: StepId; title: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 1, title: "Identidade", icon: Palette },
  { id: 2, title: "Pagamento", icon: CreditCard },
  { id: 3, title: "Gatilhos", icon: Sparkles },
  { id: 4, title: "Garantia", icon: ShieldCheck },
];

export default function CustomCheckoutTab() {
  const [state, setState] = useState<State>(INITIAL);
  const [initialState, setInitialState] = useState<State>(INITIAL);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingSlot, setUploadingSlot] = useState<ImageSlot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [step, setStep] = useState<StepId>(1);
  const headerInputRef = useRef<HTMLInputElement>(null);
  const footerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/settings/custom-checkout");
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "Erro ao carregar");
        const rawSize = json.footerImageSize;
        const footerImageSize: FooterSize =
          rawSize === "medium" || rawSize === "small" ? rawSize : "full";
        const loaded: State = {
          mode: json.mode === "light" ? "light" : "dark",
          headerImageUrl: json.headerImageUrl ?? null,
          footerImageUrl: json.footerImageUrl ?? null,
          footerImageSize,
          methodCard: json.methodCard !== false,
          methodPix: json.methodPix !== false,
          methodBoleto: json.methodBoleto !== false,
          payButtonColor: json.payButtonColor ?? "#635bff",
          payButtonLightSweep: Boolean(json.payButtonLightSweep),
          triggerSaleNotifications: Boolean(json.triggerSaleNotifications),
          triggerCountdown: Boolean(json.triggerCountdown),
          countdownMinutes: Number(json.countdownMinutes ?? 15),
          countdownMessage: json.countdownMessage ?? "Não feche esta página!",
          countdownExpiredMessage:
            json.countdownExpiredMessage ?? "Última chance — compre agora!",
          triggerStock: Boolean(json.triggerStock),
          stockInitial: Number(json.stockInitial ?? 12),
          triggerViewers: Boolean(json.triggerViewers),
          viewersMin: Number(json.viewersMin ?? 50),
          viewersMax: Number(json.viewersMax ?? 200),
          triggerGuarantee: Boolean(json.triggerGuarantee),
          guaranteeText:
            json.guaranteeText ?? "Garantia de 7 dias. Se não gostar, devolvemos seu dinheiro.",
        };
        setState(loaded);
        setInitialState(loaded);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const dirty = (() => {
    const keys = Object.keys(state) as (keyof State)[];
    return keys.some((k) => state[k] !== initialState[k]);
  })();

  async function handleFile(slot: ImageSlot, file: File | null) {
    if (!file) return;
    setError(null);
    setOk(false);
    if (!ALLOWED_TYPES.has(file.type)) {
      setError("Formato inválido. Use PNG, JPEG, WebP ou GIF.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Imagem muito grande (máx 5MB).");
      return;
    }
    setUploadingSlot(slot);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/infoprodutor/produtos/upload", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Falha no upload");
      const url = json.url as string;
      setState((prev) =>
        slot === "header" ? { ...prev, headerImageUrl: url } : { ...prev, footerImageUrl: url },
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro no upload");
    } finally {
      setUploadingSlot(null);
      if (slot === "header" && headerInputRef.current) headerInputRef.current.value = "";
      if (slot === "footer" && footerInputRef.current) footerInputRef.current.value = "";
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setOk(false);
    try {
      const res = await fetch("/api/settings/custom-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao salvar");
      setInitialState(state);
      setOk(true);
      setTimeout(() => setOk(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-[#2c2c32] bg-[#27272a] p-10 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#635bff]" />
      </div>
    );
  }

  return (
    <div className="space-y-5 mt-4">
      <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-5">
        {/* ═══════════════ EDITOR ═══════════════ */}
        <div className="rounded-xl border border-[#2c2c32] bg-[#27272a] p-5 space-y-5 h-fit">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#635bff]/15 border border-[#635bff]/25 flex items-center justify-center">
              <CreditCard className="w-4 h-4 text-[#a8a2ff]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#f0f0f2]">Personalizar checkout</h2>
              <p className="text-[10px] text-[#9a9aa2]">Aplicado em todos seus produtos InfoP</p>
            </div>
          </div>

          {/* Stepper */}
          <div className="flex items-center gap-0">
            {STEPS.map((s, idx) => {
              const done = s.id < step;
              const current = s.id === step;
              return (
                <div key={s.id} className="flex items-center flex-1 last:flex-none">
                  <button
                    type="button"
                    onClick={() => setStep(s.id)}
                    className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 transition-all cursor-pointer"
                  >
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold transition-all ${
                        current
                          ? "bg-[#e24c30] text-white shadow-[0_0_12px_rgba(238,77,45,0.4)]"
                          : done
                            ? "bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400"
                            : "bg-[#1a1a1e] border-2 border-[#3e3e46] text-[#9a9aa2]"
                      }`}
                    >
                      {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : s.id}
                    </div>
                    <span
                      className={`hidden sm:block text-[11px] font-medium whitespace-nowrap ${
                        current
                          ? "text-[#f0f0f2] font-semibold"
                          : done
                            ? "text-emerald-400"
                            : "text-[#9a9aa2]"
                      }`}
                    >
                      {s.title}
                    </span>
                  </button>
                  {idx < STEPS.length - 1 && (
                    <div
                      className={`flex-1 h-px mx-2 transition-colors ${
                        done ? "bg-emerald-500/40" : "bg-[#3e3e46]"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Conteúdo do passo */}
          {step === 1 ? (
            <StepIdentidade
              state={state}
              setState={setState}
              uploadingSlot={uploadingSlot}
              headerInputRef={headerInputRef}
              footerInputRef={footerInputRef}
              onFile={handleFile}
            />
          ) : step === 2 ? (
            <StepPagamento state={state} setState={setState} />
          ) : step === 3 ? (
            <StepGatilhos state={state} setState={setState} />
          ) : (
            <StepGarantia state={state} setState={setState} />
          )}

          {error ? (
            <p className="text-[11px] text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              {error}
            </p>
          ) : null}

          {/* Ações: Voltar / Avançar / Salvar */}
          <div className="flex items-center justify-between pt-2 border-t border-[#2c2c32]">
            <button
              type="button"
              onClick={() => setStep((s) => (s > 1 ? ((s - 1) as StepId) : s))}
              disabled={step === 1}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-[11px] font-semibold text-[#c8c8ce] hover:text-[#f0f0f2] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Voltar
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={!dirty || saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#635bff] text-white text-[12px] font-bold hover:bg-[#5048e5] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {saving ? "Salvando..." : "Salvar"}
              </button>
              {ok ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Salvo!
                </span>
              ) : null}
              {step < 4 ? (
                <button
                  type="button"
                  onClick={() => setStep((s) => ((s + 1) as StepId))}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-[11px] font-semibold text-[#c8c8ce] hover:text-[#f0f0f2] transition-colors"
                >
                  Avançar
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {/* ═══════════════ PREVIEW ═══════════════ */}
        <div className="self-start rounded-lg border border-dark-border overflow-hidden bg-dark-card">
          <div className="px-4 py-3 border-b border-dark-border flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-text-primary">Preview do checkout</div>
            <div className="flex items-center gap-2">
              <div
                className="inline-flex rounded-lg border border-dark-border bg-dark-bg/80 p-0.5"
                role="group"
                aria-label="Dispositivo do preview"
              >
                <button
                  type="button"
                  onClick={() => setPreviewDevice("mobile")}
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                    previewDevice === "mobile"
                      ? "bg-shopee-orange text-white shadow-sm"
                      : "text-text-secondary hover:text-text-primary hover:bg-dark-card"
                  }`}
                  title="Ver no celular"
                >
                  <Smartphone className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice("desktop")}
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                    previewDevice === "desktop"
                      ? "bg-shopee-orange text-white shadow-sm"
                      : "text-text-secondary hover:text-text-primary hover:bg-dark-card"
                  }`}
                  title="Ver no PC"
                >
                  <Monitor className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <span className="text-xs text-text-secondary hidden sm:inline">Tempo real</span>
            </div>
          </div>
          <div className="relative flex h-[min(78vh,820px)] max-h-[min(78vh,820px)] flex-col overflow-hidden bg-black/30">
            <div className="flex min-h-0 flex-1 items-center justify-center p-3 sm:p-4">
              {previewDevice === "mobile" ? (
                <div className="flex justify-center">
                  <div
                    className="relative mx-auto shadow-2xl"
                    style={{ width: 320, height: 640, background: "#0a0a0b", borderRadius: 42, padding: 8 }}
                  >
                    <span aria-hidden className="absolute bg-[#1a1a1e]" style={{ left: -2, top: 110, width: 3, height: 30, borderRadius: 2 }} />
                    <span aria-hidden className="absolute bg-[#1a1a1e]" style={{ right: -2, top: 140, width: 3, height: 60, borderRadius: 2 }} />
                    <div
                      className="relative w-full h-full overflow-hidden"
                      style={{ borderRadius: 34, background: state.mode === "light" ? "#f5f5f7" : "#18181b" }}
                    >
                      <div
                        aria-hidden
                        className="absolute left-1/2 -translate-x-1/2 z-[10] bg-black"
                        style={{ top: 8, width: 96, height: 22, borderRadius: 14 }}
                      />
                      <PreviewViewportShim referenceWidth={390}>
                        <CheckoutPreview state={state} device={previewDevice} />
                      </PreviewViewportShim>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex justify-center">
                  <div className="isolate relative mx-auto inline-block max-w-[min(900px,100%)] leading-none">
                    <div
                      className="absolute z-[1] overflow-hidden rounded-md"
                      style={{ top: "5%", left: "14%", right: "14%", bottom: "31%" }}
                    >
                      <PreviewViewportShim referenceWidth={1200} enabled={false}>
                        <CheckoutPreview state={state} device={previewDevice} />
                      </PreviewViewportShim>
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/pc.png"
                      alt=""
                      width={2330}
                      height={1464}
                      className="relative z-[50] block h-auto w-auto max-w-full select-none object-contain mix-blend-multiply pointer-events-none"
                      draggable={false}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// STEP 1 — Identidade (tema, banner, rodapé)
// ══════════════════════════════════════════════════════════════

function StepIdentidade({
  state,
  setState,
  uploadingSlot,
  headerInputRef,
  footerInputRef,
  onFile,
}: {
  state: State;
  setState: React.Dispatch<React.SetStateAction<State>>;
  uploadingSlot: ImageSlot | null;
  headerInputRef: React.RefObject<HTMLInputElement | null>;
  footerInputRef: React.RefObject<HTMLInputElement | null>;
  onFile: (slot: ImageSlot, file: File | null) => void;
}) {
  return (
    <div className="space-y-5">
      {/* Tema */}
      <div className="space-y-2">
        <label className="block text-[9px] font-bold text-[#d8d8d8] uppercase tracking-widest">Tema</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setState((p) => ({ ...p, mode: "dark" }))}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-colors ${
              state.mode === "dark"
                ? "border-[#635bff] bg-[#635bff]/10 text-[#f0f0f2]"
                : "border-[#3e3e46] bg-[#222228] text-[#c8c8ce] hover:border-[#635bff]/50"
            }`}
          >
            <Moon className="w-4 h-4" />
            <span className="text-[12px] font-semibold">Escuro</span>
            {state.mode === "dark" ? <CheckCircle2 className="w-3.5 h-3.5 ml-auto text-[#a8a2ff]" /> : null}
          </button>
          <button
            type="button"
            onClick={() => setState((p) => ({ ...p, mode: "light" }))}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-colors ${
              state.mode === "light"
                ? "border-[#635bff] bg-[#635bff]/10 text-[#f0f0f2]"
                : "border-[#3e3e46] bg-[#222228] text-[#c8c8ce] hover:border-[#635bff]/50"
            }`}
          >
            <Sun className="w-4 h-4" />
            <span className="text-[12px] font-semibold">Claro</span>
            {state.mode === "light" ? <CheckCircle2 className="w-3.5 h-3.5 ml-auto text-[#a8a2ff]" /> : null}
          </button>
        </div>
      </div>

      <ImageUploadSlot
        label="Imagem do topo (banner)"
        hint="Aparece no topo do checkout — use pra oferta, propaganda ou identidade visual. Recomendado: 1200×300px."
        value={state.headerImageUrl}
        uploading={uploadingSlot === "header"}
        inputRef={headerInputRef}
        onFile={(f) => onFile("header", f)}
        onRemove={() => setState((p) => ({ ...p, headerImageUrl: null }))}
      />

      <ImageUploadSlot
        label="Imagem abaixo do botão pagar (rodapé)"
        hint="Aparece abaixo do botão de pagamento — ideal pra selos de segurança, garantia ou avisos extras."
        value={state.footerImageUrl}
        uploading={uploadingSlot === "footer"}
        inputRef={footerInputRef}
        onFile={(f) => onFile("footer", f)}
        onRemove={() => setState((p) => ({ ...p, footerImageUrl: null }))}
      />

      {state.footerImageUrl ? (
        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-[9px] font-bold text-[#d8d8d8] uppercase tracking-widest">
            <span>Tamanho da imagem do rodapé (desktop)</span>
            <Toolist
              variant="floating"
              wide
              text="No mobile a imagem sempre ocupa 100% pra não ficar minúscula."
            />
          </label>
          <div className="grid grid-cols-3 gap-2">
            {([
              { value: "small", label: "Pequena" },
              { value: "medium", label: "Média" },
              { value: "full", label: "Grande" },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setState((p) => ({ ...p, footerImageSize: opt.value }))}
                className={`px-3 py-2 rounded-lg border text-[12px] font-semibold transition-colors ${
                  state.footerImageSize === opt.value
                    ? "border-[#635bff] bg-[#635bff]/10 text-[#f0f0f2]"
                    : "border-[#3e3e46] bg-[#222228] text-[#c8c8ce] hover:border-[#635bff]/50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// STEP 2 — Pagamento (métodos + botão)
// ══════════════════════════════════════════════════════════════

function StepPagamento({
  state,
  setState,
}: {
  state: State;
  setState: React.Dispatch<React.SetStateAction<State>>;
}) {
  return (
    <div className="space-y-5">
      {/* Métodos de pagamento */}
      <div className="space-y-2">
        <label className="flex items-center gap-1.5 text-[9px] font-bold text-[#d8d8d8] uppercase tracking-widest">
          <span>Meios de pagamento aceitos</span>
          <Toolist
            variant="floating"
            wide
            text="Só os marcados aqui aparecem no checkout do comprador. PIX e Boleto também precisam estar ativados no painel da Stripe."
          />
        </label>
        <div className="space-y-1.5">
          {(
            [
              { key: "methodCard", label: "Cartão de crédito / débito", hint: "Visa, Mastercard, Elo, Amex...", requiresStripeActivation: false },
              { key: "methodPix", label: "PIX", hint: "QR code instantâneo.", requiresStripeActivation: true },
              { key: "methodBoleto", label: "Boleto", hint: "Vencimento 3 dias úteis. Compensação demora 1–3 dias após o pagamento.", requiresStripeActivation: true },
            ] as const
          ).map((m) => {
            const checked = state[m.key];
            return (
              <div key={m.key}>
                <label
                  className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    checked ? "border-[#635bff]/50 bg-[#635bff]/8" : "border-[#3e3e46] bg-[#222228] hover:border-[#635bff]/30"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => setState((p) => ({ ...p, [m.key]: e.target.checked }))}
                    className="mt-0.5 w-4 h-4 rounded border-[#3e3e46] bg-[#222228] accent-[#635bff] shrink-0"
                  />
                  <div className="min-w-0 flex-1 flex items-center gap-1.5">
                    <p className="text-[12px] font-semibold text-[#f0f0f2]">{m.label}</p>
                    <Toolist variant="floating" wide text={m.hint} />
                  </div>
                </label>
                {checked && m.requiresStripeActivation ? (
                  <div className="mt-1.5 ml-6 text-[10px] text-amber-300/90 bg-amber-500/5 border border-amber-500/20 rounded-md px-2 py-1.5 leading-relaxed">
                    ⚠️ {m.label} precisa estar <strong>ativado no seu painel da Stripe</strong> pra funcionar.
                    Ative em{" "}
                    <a
                      href="https://dashboard.stripe.com/account/payments/settings"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-amber-200"
                    >
                      Stripe → Payment methods
                    </a>
                    .
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        {!state.methodCard && !state.methodPix && !state.methodBoleto ? (
          <p className="text-[10px] text-amber-300 bg-amber-500/5 border border-amber-500/20 rounded-lg px-2 py-1.5">
            ⚠️ Selecione ao menos 1 método. Se salvar com tudo desmarcado, cartão volta ativo automaticamente.
          </p>
        ) : null}
      </div>

      {/* Botão Pagar */}
      <div className="space-y-2.5 border-t border-[#2c2c32] pt-4">
        <label className="block text-[9px] font-bold text-[#d8d8d8] uppercase tracking-widest">
          Botão Pagar
        </label>

        <div className="space-y-2">
          <label className="block text-[10px] font-semibold text-[#c8c8ce]">Cor</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={state.payButtonColor}
              onChange={(e) => setState((p) => ({ ...p, payButtonColor: e.target.value.toLowerCase() }))}
              className="w-10 h-10 rounded-lg bg-[#222228] border border-[#3e3e46] cursor-pointer"
            />
            <input
              type="text"
              value={state.payButtonColor}
              onChange={(e) => {
                const v = e.target.value.trim();
                if (/^#[0-9a-fA-F]{0,6}$/.test(v) || v === "") {
                  setState((p) => ({ ...p, payButtonColor: v }));
                }
              }}
              placeholder="#635bff"
              className="flex-1 bg-[#222228] border border-[#3e3e46] rounded-lg px-3 py-2 text-[12px] font-mono text-[#f0f0f2] placeholder:text-[#868686] focus:border-[#635bff] outline-none transition"
            />
            {[
              "#635bff", "#e24c30", "#10b981", "#f59e0b", "#ec4899", "#0ea5e9",
            ].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setState((p) => ({ ...p, payButtonColor: c }))}
                className="w-6 h-6 rounded-full border-2 border-[#3e3e46] hover:scale-110 transition-transform"
                style={{ background: c }}
                aria-label={`Cor ${c}`}
              />
            ))}
          </div>
        </div>

        <label
          className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
            state.payButtonLightSweep
              ? "border-[#635bff]/50 bg-[#635bff]/8"
              : "border-[#3e3e46] bg-[#222228] hover:border-[#635bff]/30"
          }`}
        >
          <input
            type="checkbox"
            checked={state.payButtonLightSweep}
            onChange={(e) => setState((p) => ({ ...p, payButtonLightSweep: e.target.checked }))}
            className="mt-0.5 w-4 h-4 rounded border-[#3e3e46] bg-[#222228] accent-[#635bff] shrink-0"
          />
          <div className="min-w-0 flex-1 flex items-center gap-1.5">
            <p className="text-[12px] font-semibold text-[#f0f0f2]">Efeito de brilho (light sweep)</p>
            <Toolist
              variant="floating"
              wide
              text="Faixa de luz que passa pelo botão a cada 2,6s. Chama atenção e aumenta cliques."
            />
          </div>
        </label>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// STEP 3 — Gatilhos de venda
// ══════════════════════════════════════════════════════════════

function StepGatilhos({
  state,
  setState,
}: {
  state: State;
  setState: React.Dispatch<React.SetStateAction<State>>;
}) {
  return (
    <div className="space-y-4">
      {/* Notificações de compra */}
      <TriggerCard
        icon={ShoppingBag}
        iconColor="#34d399"
        title="Notificações de compra"
        hint="Toasts rotativos no canto inferior: 'Maria de SP acabou de comprar'. Nomes e cidades BR sintéticos."
        enabled={state.triggerSaleNotifications}
        onToggle={(v) => setState((p) => ({ ...p, triggerSaleNotifications: v }))}
      />

      {/* Countdown */}
      <TriggerCard
        icon={Clock}
        iconColor="#ef4444"
        title="Cronômetro regressivo no topo"
        hint="Barra sticky vermelha/laranja com tempo + frase. Quando zera, pisca e troca a frase."
        enabled={state.triggerCountdown}
        onToggle={(v) => setState((p) => ({ ...p, triggerCountdown: v }))}
      >
        {state.triggerCountdown ? (
          <div className="space-y-2.5 pt-2">
            <FieldNumber
              label="Duração (minutos)"
              value={state.countdownMinutes}
              min={1}
              max={180}
              onChange={(v) => setState((p) => ({ ...p, countdownMinutes: v }))}
            />
            <FieldText
              label="Frase durante o countdown"
              maxLength={140}
              value={state.countdownMessage}
              onChange={(v) => setState((p) => ({ ...p, countdownMessage: v }))}
            />
            <FieldText
              label="Frase quando zerar"
              maxLength={140}
              value={state.countdownExpiredMessage}
              onChange={(v) => setState((p) => ({ ...p, countdownExpiredMessage: v }))}
            />
          </div>
        ) : null}
      </TriggerCard>

      {/* Estoque */}
      <TriggerCard
        icon={Flame}
        iconColor="#f59e0b"
        title="Contador de estoque"
        hint="Mostra 'Apenas X unidades' abaixo do produto. Desce 1 a cada 10s, nunca zera (para em 1)."
        enabled={state.triggerStock}
        onToggle={(v) => setState((p) => ({ ...p, triggerStock: v }))}
      >
        {state.triggerStock ? (
          <div className="pt-2">
            <FieldNumber
              label="Unidades iniciais"
              value={state.stockInitial}
              min={1}
              max={9999}
              onChange={(v) => setState((p) => ({ ...p, stockInitial: v }))}
            />
          </div>
        ) : null}
      </TriggerCard>

      {/* Visualizadores */}
      <TriggerCard
        icon={Eye}
        iconColor="#a8a2ff"
        title="Visualizadores em tempo real"
        hint="Badge fixa no canto superior: 'X pessoas vendo agora'. Varia ±3 a cada 5s dentro do range."
        enabled={state.triggerViewers}
        onToggle={(v) => setState((p) => ({ ...p, triggerViewers: v }))}
      >
        {state.triggerViewers ? (
          <div className="grid grid-cols-2 gap-2 pt-2">
            <FieldNumber
              label="Mínimo"
              value={state.viewersMin}
              min={1}
              max={9999}
              onChange={(v) => setState((p) => ({ ...p, viewersMin: v }))}
            />
            <FieldNumber
              label="Máximo"
              value={state.viewersMax}
              min={1}
              max={9999}
              onChange={(v) => setState((p) => ({ ...p, viewersMax: v }))}
            />
          </div>
        ) : null}
      </TriggerCard>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// STEP 4 — Garantia
// ══════════════════════════════════════════════════════════════

function StepGarantia({
  state,
  setState,
}: {
  state: State;
  setState: React.Dispatch<React.SetStateAction<State>>;
}) {
  return (
    <div className="space-y-4">
      <TriggerCard
        icon={ShieldCheck}
        iconColor="#34d399"
        title="Selo de garantia"
        hint="Aparece abaixo do botão Pagar como um selinho verde. Diminui a fricção da compra."
        enabled={state.triggerGuarantee}
        onToggle={(v) => setState((p) => ({ ...p, triggerGuarantee: v }))}
      >
        {state.triggerGuarantee ? (
          <div className="pt-2">
            <label className="flex items-center gap-1.5 text-[10px] font-semibold text-[#c8c8ce] mb-1.5">
              <span>Texto do selo</span>
              <Toolist
                variant="floating"
                wide
                text="Seja específico (7 dias, 30 dias, devolução integral etc.) — promessa vaga converte menos."
              />
            </label>
            <textarea
              value={state.guaranteeText}
              onChange={(e) =>
                setState((p) => ({ ...p, guaranteeText: e.target.value.slice(0, 240) }))
              }
              rows={3}
              maxLength={240}
              placeholder="Garantia de 7 dias. Se não gostar, devolvemos seu dinheiro."
              className="w-full bg-[#222228] border border-emerald-500/40 rounded-lg px-3 py-2 text-[12px] text-[#f0f0f2] placeholder:text-[#868686] focus:border-emerald-500 outline-none resize-y transition"
            />
          </div>
        ) : null}
      </TriggerCard>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// UI helpers
// ══════════════════════════════════════════════════════════════

function TriggerCard({
  icon: Icon,
  iconColor,
  title,
  hint,
  enabled,
  onToggle,
  children,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  iconColor: string;
  title: string;
  hint: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border p-3.5 transition-colors ${
        enabled ? "border-[#635bff]/50 bg-[#635bff]/8" : "border-[#3e3e46] bg-[#222228]"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${iconColor}22`, border: `1px solid ${iconColor}55` }}
        >
          <Icon className="w-4 h-4" style={{ color: iconColor }} />
        </div>
        <div className="min-w-0 flex-1 flex items-center gap-1.5">
          <p className="text-[12px] font-semibold text-[#f0f0f2]">{title}</p>
          <Toolist variant="floating" wide text={hint} />
        </div>
        <button
          type="button"
          onClick={() => onToggle(!enabled)}
          role="switch"
          aria-checked={enabled}
          className={`shrink-0 relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            enabled ? "bg-[#635bff]" : "bg-[#3e3e46]"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              enabled ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
      {children}
    </div>
  );
}

function FieldNumber({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="block text-[10px] font-semibold text-[#c8c8ce] mb-1.5">{label}</label>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isFinite(n)) return;
          onChange(Math.max(min, Math.min(max, Math.round(n))));
        }}
        className="w-full bg-[#222228] border border-[#3e3e46] rounded-lg px-3 py-2 text-[12px] text-[#f0f0f2] focus:border-[#635bff] outline-none transition"
      />
    </div>
  );
}

function FieldText({
  label,
  value,
  maxLength,
  onChange,
}: {
  label: string;
  value: string;
  maxLength: number;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-[10px] font-semibold text-[#c8c8ce] mb-1.5">{label}</label>
      <input
        type="text"
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[#222228] border border-[#3e3e46] rounded-lg px-3 py-2 text-[12px] text-[#f0f0f2] focus:border-[#635bff] outline-none transition"
      />
    </div>
  );
}

function ImageUploadSlot({
  label,
  hint,
  value,
  uploading,
  inputRef,
  onFile,
  onRemove,
}: {
  label: string;
  hint: string;
  value: string | null;
  uploading: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFile: (file: File | null) => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-1.5 text-[9px] font-bold text-[#d8d8d8] uppercase tracking-widest">
        <span>{label}</span>
        <Toolist variant="floating" wide text={hint} />
      </label>

      {value ? (
        <div className="relative rounded-lg overflow-hidden border border-[#3e3e46] bg-[#222228]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt={label} className="w-full h-32 object-cover" />
          <button
            type="button"
            onClick={onRemove}
            className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-500/90 hover:bg-red-500 text-white text-[10px] font-bold"
          >
            <Trash2 className="w-3 h-3" />
            Remover
          </button>
        </div>
      ) : (
        <label
          className={`flex items-center justify-center gap-2 h-32 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${
            uploading
              ? "border-[#635bff]/60 bg-[#635bff]/5"
              : "border-[#3e3e46] hover:border-[#635bff]/60 hover:bg-[#222228]"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            disabled={uploading}
          />
          {uploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-[#a8a2ff]" />
              <span className="text-[11px] text-[#c8c8ce]">Enviando...</span>
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 text-[#a8a2ff]" />
              <span className="text-[11px] text-[#c8c8ce]">Clique pra enviar imagem</span>
            </>
          )}
        </label>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// PREVIEW COMPONENT (com gatilhos mockados)
// ══════════════════════════════════════════════════════════════

const PREVIEW_BUYER_POOL: { name: string; city: string }[] = [
  { name: "Maria S.", city: "São Paulo/SP" },
  { name: "João P.", city: "Rio de Janeiro/RJ" },
  { name: "Fernanda L.", city: "Belo Horizonte/MG" },
  { name: "Rafael A.", city: "Curitiba/PR" },
  { name: "Juliana C.", city: "Recife/PE" },
  { name: "Lucas M.", city: "Salvador/BA" },
  { name: "Camila T.", city: "Porto Alegre/RS" },
  { name: "Thiago B.", city: "Fortaleza/CE" },
];

function CheckoutPreview({
  state,
  device = "desktop",
}: {
  state: State;
  device?: "desktop" | "mobile";
}) {
  const isLight = state.mode === "light";
  const bg = isLight ? "#f5f5f7" : "#18181b";
  const cardBg = isLight ? "#ffffff" : "#27272a";
  const cardBorder = isLight ? "#e4e4e7" : "#2c2c32";
  const inputBg = isLight ? "#f4f4f5" : "#222228";
  const inputBorder = isLight ? "#d4d4d8" : "#3e3e46";
  const text = isLight ? "#18181b" : "#f0f0f2";
  const textMuted = isLight ? "#71717a" : "#c8c8ce";
  const textFaint = isLight ? "#a1a1aa" : "#9a9aa2";
  const emerald = isLight ? "#059669" : "#34d399";

  const isMobile = device === "mobile";
  const contentMaxW = isMobile ? "100%" : 560;

  const payColor = state.payButtonColor;

  // Toast flutuante de notificação de compra (aparece/some rotacionando)
  const [notifIdx, setNotifIdx] = useState<number | null>(null);
  useEffect(() => {
    if (!state.triggerSaleNotifications) {
      setNotifIdx(null);
      return;
    }
    let i = 0;
    let showTimer: ReturnType<typeof setTimeout> | null = null;
    let hideTimer: ReturnType<typeof setTimeout> | null = null;
    const cycle = () => {
      setNotifIdx(i);
      hideTimer = setTimeout(() => {
        setNotifIdx(null);
        showTimer = setTimeout(() => {
          i = (i + 1) % PREVIEW_BUYER_POOL.length;
          cycle();
        }, 1800);
      }, 4500);
    };
    // primeiro disparo rápido pra o afiliado ver o efeito assim que liga
    showTimer = setTimeout(cycle, 600);
    return () => {
      if (showTimer) clearTimeout(showTimer);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [state.triggerSaleNotifications]);
  const notif = notifIdx !== null ? PREVIEW_BUYER_POOL[notifIdx] : null;

  return (
    <div className="relative overflow-hidden" style={{ background: bg }}>
      {/* Countdown preview */}
      {state.triggerCountdown ? (
        <div
          className="relative z-[2] w-full border-b backdrop-blur"
          style={{
            background: "rgba(239, 68, 68, 0.6)",
            borderColor: "rgba(239, 68, 68, 0.4)",
          }}
        >
          <div className="px-3 py-2.5 flex items-center justify-center gap-2 text-white text-center">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <p className="text-[11px] font-semibold truncate leading-tight">
              {state.countdownMessage}
            </p>
            <span className="inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[11px] font-mono font-bold tabular-nums bg-black/35 shrink-0">
              {String(Math.floor(state.countdownMinutes)).padStart(2, "0")}:00
            </span>
          </div>
        </div>
      ) : null}

      {/* Viewers preview (flutuante) */}
      {state.triggerViewers ? (
        <div className="absolute top-1 right-1 z-[3] pointer-events-none">
          <div className="flex items-center gap-1 rounded-full border border-white/10 bg-black/35 backdrop-blur px-2 py-1 shadow-lg">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
              <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            <Eye className="w-2.5 h-2.5 text-white/85" />
            <span className="text-[9px] text-white font-semibold tabular-nums">
              {Math.round((state.viewersMin + state.viewersMax) / 2)}
            </span>
            <span className="text-[8px] text-white/70">vendo</span>
          </div>
        </div>
      ) : null}

      <div
        className="p-3 space-y-2 mx-auto relative z-[1]"
        style={{ color: text, maxWidth: contentMaxW }}
      >
        {state.headerImageUrl ? (
          <div className="rounded-lg overflow-hidden border" style={{ borderColor: cardBorder }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={state.headerImageUrl} alt="" className="w-full h-16 object-cover" />
          </div>
        ) : null}

        {/* Produto */}
        <div className="rounded-lg border p-2.5 flex gap-2.5" style={{ background: cardBg, borderColor: cardBorder }}>
          <div
            className="w-12 h-12 rounded shrink-0 flex items-center justify-center"
            style={{ background: inputBg, borderColor: cardBorder }}
          >
            <Package className="w-5 h-5" style={{ color: textFaint }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-bold" style={{ color: text }}>Produto de exemplo</p>
            <p className="text-sm font-bold font-mono tabular-nums mt-0.5" style={{ color: emerald }}>
              R$ 100,00
            </p>
          </div>
        </div>

        {/* Stock trigger */}
        {state.triggerStock ? (
          <div
            className="rounded-lg border px-2.5 py-1.5 flex items-center gap-2"
            style={{ background: cardBg, borderColor: cardBorder }}
          >
            <Flame className="w-3 h-3 shrink-0" style={{ color: "#f59e0b" }} />
            <p className="text-[10px] leading-tight" style={{ color: text }}>
              Apenas <span className="font-bold tabular-nums">{state.stockInitial}</span> unidades em estoque
            </p>
          </div>
        ) : null}

        {/* Entrega */}
        <div className="rounded-lg border p-2.5 space-y-1.5" style={{ background: cardBg, borderColor: cardBorder }}>
          <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: textMuted }}>Entrega</p>
          <div
            className="flex items-center justify-between px-2 py-1.5 rounded-md border"
            style={{ background: inputBg, borderColor: payColor }}
          >
            <div className="flex items-center gap-1.5">
              <Truck className="w-3 h-3" style={{ color: payColor }} />
              <span className="text-[10px] font-semibold">Frete PAC</span>
            </div>
            <span className="text-[10px] font-mono font-bold" style={{ color: emerald }}>R$ 15,00</span>
          </div>
          <div
            className="flex items-center justify-between px-2 py-1.5 rounded-md border"
            style={{ background: inputBg, borderColor: inputBorder }}
          >
            <div className="flex items-center gap-1.5">
              <Store className="w-3 h-3" style={{ color: textFaint }} />
              <span className="text-[10px]" style={{ color: textMuted }}>Retirar na loja</span>
            </div>
            <span className="text-[9px] font-bold" style={{ color: emerald }}>Grátis</span>
          </div>
        </div>

        {/* Pagamento */}
        <div className="rounded-lg border p-2.5 space-y-1.5" style={{ background: cardBg, borderColor: cardBorder }}>
          <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: textMuted }}>Pagamento</p>
          {(() => {
            const tabs: { key: string; label: string }[] = [];
            const anyOn = state.methodCard || state.methodPix || state.methodBoleto;
            if (state.methodCard || !anyOn) tabs.push({ key: "card", label: "Cartão" });
            if (state.methodPix) tabs.push({ key: "pix", label: "PIX" });
            if (state.methodBoleto) tabs.push({ key: "boleto", label: "Boleto" });
            return (
              <div className="flex gap-1">
                {tabs.map((t, i) => (
                  <div
                    key={t.key}
                    className={`flex-1 rounded-md px-1.5 py-1 text-[9px] text-center border ${i === 0 ? "font-semibold" : ""}`}
                    style={{
                      background: inputBg,
                      borderColor: i === 0 ? payColor : inputBorder,
                      color: i === 0 ? text : textMuted,
                    }}
                  >
                    {t.label}
                  </div>
                ))}
              </div>
            );
          })()}
          <div className="rounded-md px-2 py-1.5 border text-[9px]" style={{ background: inputBg, borderColor: inputBorder, color: textFaint }}>
            1234 1234 1234 1234
          </div>
          {/* Botão Pagar com light sweep */}
          <button
            type="button"
            disabled
            className="relative overflow-hidden w-full flex items-center justify-center gap-1.5 px-2 py-3 rounded-md text-white text-[12px] font-bold mt-1"
            style={{
              background: payColor,
              boxShadow: `0 4px 14px -4px ${payColor}66`,
            }}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            Pagar R$ 115,00
            {state.payButtonLightSweep ? (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 w-1/3 animate-light-sweep"
                style={{
                  background:
                    "linear-gradient(110deg, transparent 0%, rgba(255,255,255,0) 30%, rgba(255,255,255,0.55) 50%, rgba(255,255,255,0) 70%, transparent 100%)",
                }}
              />
            ) : null}
          </button>

          {state.triggerGuarantee ? (
            <div
              className="rounded-md border px-2 py-1 flex items-center gap-1.5"
              style={{
                background: isLight ? "rgba(5, 150, 105, 0.08)" : "rgba(16, 185, 129, 0.1)",
                borderColor: isLight ? "rgba(5, 150, 105, 0.3)" : "rgba(16, 185, 129, 0.35)",
              }}
            >
              <ShieldCheck className="w-3 h-3 shrink-0" style={{ color: isLight ? "#059669" : "#34d399" }} />
              <p className="text-[9px] leading-tight" style={{ color: text }}>
                {state.guaranteeText}
              </p>
            </div>
          ) : null}
        </div>

        {state.footerImageUrl ? (
          <div
            className={`mx-auto rounded-lg overflow-hidden border ${
              device === "mobile"
                ? "w-full"
                : state.footerImageSize === "small"
                  ? "max-w-[40%]"
                  : state.footerImageSize === "medium"
                    ? "max-w-[65%]"
                    : "w-full"
            }`}
            style={{ borderColor: cardBorder }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={state.footerImageUrl} alt="" className="w-full h-auto object-cover" />
          </div>
        ) : null}

      </div>

      {/* Toast flutuante de notificação de compra — aparece/some rotacionando no canto superior direito */}
      {notif ? (
        <div
          key={notifIdx}
          className="absolute top-8 right-2 z-[4] max-w-[calc(100%-1rem)] animate-slide-in-right pointer-events-none"
        >
          <div
            className="flex items-center gap-2 rounded-lg border px-2 py-1.5 shadow-2xl"
            style={{ background: cardBg, borderColor: cardBorder }}
          >
            <div
              className="w-7 h-7 rounded-md overflow-hidden flex items-center justify-center shrink-0"
              style={{ background: inputBg }}
            >
              {state.headerImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={state.headerImageUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <Package className="w-3.5 h-3.5" style={{ color: textMuted }} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold leading-tight truncate" style={{ color: text }}>
                {notif.name}
              </p>
              <p className="text-[9px] leading-tight truncate" style={{ color: textMuted }}>
                acabou de comprar
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

