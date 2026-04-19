"use client";

import { useEffect, useRef, useState } from "react";
import PreviewViewportShim from "@/app/components/ui/PreviewViewportShim";
import {
  Loader2,
  Upload,
  Trash2,
  Image as ImageIcon,
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
} from "lucide-react";

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
};

type ImageSlot = "header" | "footer";

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"]);
const MAX_BYTES = 5 * 1024 * 1024;

export default function CustomCheckoutTab() {
  const INITIAL: State = {
    mode: "dark",
    headerImageUrl: null,
    footerImageUrl: null,
    footerImageSize: "full",
    methodCard: true,
    methodPix: true,
    methodBoleto: true,
  };
  const [state, setState] = useState<State>(INITIAL);
  const [initialState, setInitialState] = useState<State>(INITIAL);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingSlot, setUploadingSlot] = useState<ImageSlot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
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

  const dirty =
    state.mode !== initialState.mode ||
    state.headerImageUrl !== initialState.headerImageUrl ||
    state.footerImageUrl !== initialState.footerImageUrl ||
    state.footerImageSize !== initialState.footerImageSize ||
    state.methodCard !== initialState.methodCard ||
    state.methodPix !== initialState.methodPix ||
    state.methodBoleto !== initialState.methodBoleto;

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
        body: JSON.stringify({
          mode: state.mode,
          headerImageUrl: state.headerImageUrl,
          footerImageUrl: state.footerImageUrl,
          footerImageSize: state.footerImageSize,
          methodCard: state.methodCard,
          methodPix: state.methodPix,
          methodBoleto: state.methodBoleto,
        }),
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

          <ImageUploadSlot
            label="Imagem do topo (banner)"
            hint="Aparece no topo do checkout — use pra oferta, propaganda ou identidade visual. Recomendado: 1200×300px."
            value={state.headerImageUrl}
            uploading={uploadingSlot === "header"}
            inputRef={headerInputRef}
            onFile={(f) => handleFile("header", f)}
            onRemove={() => setState((p) => ({ ...p, headerImageUrl: null }))}
          />

          <ImageUploadSlot
            label="Imagem abaixo do botão pagar (rodapé)"
            hint="Aparece abaixo do botão de pagamento — ideal pra selos de segurança, garantia ou avisos extras."
            value={state.footerImageUrl}
            uploading={uploadingSlot === "footer"}
            inputRef={footerInputRef}
            onFile={(f) => handleFile("footer", f)}
            onRemove={() => setState((p) => ({ ...p, footerImageUrl: null }))}
          />

          {state.footerImageUrl ? (
            <div className="space-y-2">
              <label className="block text-[9px] font-bold text-[#d8d8d8] uppercase tracking-widest">
                Tamanho da imagem do rodapé (desktop)
              </label>
              <p className="text-[10px] text-[#9a9aa2] leading-relaxed">
                No mobile a imagem sempre ocupa 100% pra não ficar minúscula.
              </p>
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

          {/* Theme mode */}
          <div className="space-y-2">
            <label className="block text-[9px] font-bold text-[#d8d8d8] uppercase tracking-widest">
              Tema
            </label>
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

          {/* Métodos de pagamento */}
          <div className="space-y-2">
            <label className="block text-[9px] font-bold text-[#d8d8d8] uppercase tracking-widest">
              Meios de pagamento aceitos
            </label>
            <p className="text-[10px] text-[#9a9aa2] leading-relaxed">
              Só os marcados aqui aparecem no checkout do comprador. Lembre de habilitar o mesmo no painel
              da sua conta Stripe — caso contrário, o Stripe recusa a cobrança.
            </p>
            <div className="space-y-1.5">
              {(
                [
                  { key: "methodCard", label: "Cartão de crédito / débito", hint: "Visa, Mastercard, Elo, Amex..." },
                  { key: "methodPix", label: "PIX", hint: "QR code instantâneo." },
                  { key: "methodBoleto", label: "Boleto", hint: "Vencimento 3 dias úteis. Compensação demora 1–3 dias após o pagamento." },
                ] as const
              ).map((m) => {
                const checked = state[m.key];
                return (
                  <label
                    key={m.key}
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                      checked
                        ? "border-[#635bff]/50 bg-[#635bff]/8"
                        : "border-[#3e3e46] bg-[#222228] hover:border-[#635bff]/30"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => setState((p) => ({ ...p, [m.key]: e.target.checked }))}
                      className="mt-0.5 w-4 h-4 rounded border-[#3e3e46] bg-[#222228] accent-[#635bff] shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-semibold text-[#f0f0f2]">{m.label}</p>
                      <p className="text-[10px] text-[#9a9aa2] mt-0.5 leading-relaxed">{m.hint}</p>
                    </div>
                  </label>
                );
              })}
            </div>
            {!state.methodCard && !state.methodPix && !state.methodBoleto ? (
              <p className="text-[10px] text-amber-300 bg-amber-500/5 border border-amber-500/20 rounded-lg px-2 py-1.5">
                ⚠️ Selecione ao menos 1 método. Se salvar com tudo desmarcado, cartão volta ativo automaticamente.
              </p>
            ) : null}
          </div>

          {error ? (
            <p className="text-[11px] text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              {error}
            </p>
          ) : null}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty || saving}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#635bff] text-white text-[12px] font-bold hover:bg-[#5048e5] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
          </div>
        </div>

        {/* ═══════════════ PREVIEW ═══════════════ */}
        <div className="rounded-lg border border-dark-border overflow-hidden bg-dark-card">
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
                  aria-pressed={previewDevice === "mobile"}
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
                  aria-pressed={previewDevice === "desktop"}
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
              {/* Frame de celular CSS — mais confiável que PNG mockup pra encaixar o conteúdo. */}
              <div
                className="relative mx-auto shadow-2xl"
                style={{
                  width: 320,
                  height: 640,
                  background: "#0a0a0b",
                  borderRadius: 42,
                  padding: 8,
                }}
              >
                {/* Botões laterais (detalhe visual) */}
                <span
                  aria-hidden
                  className="absolute bg-[#1a1a1e]"
                  style={{ left: -2, top: 110, width: 3, height: 30, borderRadius: 2 }}
                />
                <span
                  aria-hidden
                  className="absolute bg-[#1a1a1e]"
                  style={{ right: -2, top: 140, width: 3, height: 60, borderRadius: 2 }}
                />

                {/* Tela */}
                <div
                  className="relative w-full h-full overflow-hidden"
                  style={{ borderRadius: 34, background: state.mode === "light" ? "#f5f5f7" : "#18181b" }}
                >
                  {/* Dynamic Island */}
                  <div
                    aria-hidden
                    className="absolute left-1/2 -translate-x-1/2 z-[10] bg-black"
                    style={{ top: 8, width: 96, height: 22, borderRadius: 14 }}
                  />

                  <PreviewViewportShim referenceWidth={390}>
                    <CheckoutPreview
                    mode={state.mode}
                    headerImageUrl={state.headerImageUrl}
                    footerImageUrl={state.footerImageUrl}
                    footerImageSize={state.footerImageSize}
                    device={previewDevice}
                    methodCard={state.methodCard}
                    methodPix={state.methodPix}
                    methodBoleto={state.methodBoleto}
                  />
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
                    <CheckoutPreview
                    mode={state.mode}
                    headerImageUrl={state.headerImageUrl}
                    footerImageUrl={state.footerImageUrl}
                    footerImageSize={state.footerImageSize}
                    device={previewDevice}
                    methodCard={state.methodCard}
                    methodPix={state.methodPix}
                    methodBoleto={state.methodBoleto}
                  />
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

// ═══════════════ IMAGE UPLOAD SLOT ═══════════════

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
      <label className="block text-[9px] font-bold text-[#d8d8d8] uppercase tracking-widest">{label}</label>
      <p className="text-[10px] text-[#9a9aa2] leading-relaxed">{hint}</p>

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

// ═══════════════ PREVIEW COMPONENT ═══════════════

function CheckoutPreview({
  mode,
  headerImageUrl,
  footerImageUrl,
  footerImageSize = "full",
  device = "desktop",
  compact = false,
  methodCard = true,
  methodPix = true,
  methodBoleto = true,
}: {
  mode: Mode;
  headerImageUrl: string | null;
  footerImageUrl?: string | null;
  footerImageSize?: FooterSize;
  device?: "desktop" | "mobile";
  compact?: boolean;
  methodCard?: boolean;
  methodPix?: boolean;
  methodBoleto?: boolean;
}) {
  const isLight = mode === "light";
  // Paleta aplicada em função do tema — casa com o que o /checkout/[subId] usa.
  const bg = isLight ? "#f5f5f7" : "#18181b";
  const cardBg = isLight ? "#ffffff" : "#27272a";
  const cardBorder = isLight ? "#e4e4e7" : "#2c2c32";
  const inputBg = isLight ? "#f4f4f5" : "#222228";
  const inputBorder = isLight ? "#d4d4d8" : "#3e3e46";
  const text = isLight ? "#18181b" : "#f0f0f2";
  const textMuted = isLight ? "#71717a" : "#c8c8ce";
  const textFaint = isLight ? "#a1a1aa" : "#9a9aa2";
  const accent = "#635bff";
  const emerald = isLight ? "#059669" : "#34d399";

  // Largura máxima do conteúdo — espelha `max-w-2xl` (672px) do checkout real.
  // No mobile ocupa tudo; no desktop o conteúdo fica centralizado com bg preenchendo os lados.
  const isMobile = device === "mobile";
  const contentMaxW = isMobile ? "100%" : 560;

  return (
    <div
      className={compact ? "overflow-hidden" : "rounded-xl overflow-hidden"}
      style={{ background: bg }}
    >
      <div
        className={compact ? "p-3 space-y-2.5 mx-auto" : "p-4 sm:p-6 space-y-3 mx-auto"}
        style={{ color: text, maxWidth: contentMaxW }}
      >
        {/* Header image — agora dentro do container com maxWidth, como no checkout real */}
        {headerImageUrl ? (
          <div
            className="rounded-lg overflow-hidden border"
            style={{ borderColor: cardBorder }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={headerImageUrl}
              alt=""
              className={compact ? "w-full h-20 object-cover" : "w-full h-24 object-cover"}
            />
          </div>
        ) : null}
        {/* Produto */}
        <div className="rounded-lg border p-3 flex gap-3" style={{ background: cardBg, borderColor: cardBorder }}>
          <div
            className="w-14 h-14 rounded shrink-0 flex items-center justify-center"
            style={{ background: inputBg, borderColor: cardBorder }}
          >
            <Package className="w-6 h-6" style={{ color: textFaint }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold" style={{ color: text }}>
              Produto de exemplo
            </p>
            <p className="text-base font-bold font-mono tabular-nums mt-0.5" style={{ color: emerald }}>
              R$ 100,00
            </p>
          </div>
        </div>

        {/* Entrega */}
        <div className="rounded-lg border p-3 space-y-2" style={{ background: cardBg, borderColor: cardBorder }}>
          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: textMuted }}>
            Entrega
          </p>
          <div className="flex gap-2">
            <input
              readOnly
              value="00000-000"
              className="flex-1 rounded-md px-2 py-1.5 text-[11px] border"
              style={{ background: inputBg, borderColor: inputBorder, color: text }}
            />
            <button
              type="button"
              disabled
              className="px-3 py-1.5 rounded-md text-[10px] font-bold text-white"
              style={{ background: accent }}
            >
              Calcular
            </button>
          </div>
          <div
            className="flex items-center justify-between px-2.5 py-2 rounded-md border"
            style={{ background: inputBg, borderColor: accent }}
          >
            <div className="flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5" style={{ color: accent }} />
              <span className="text-[11px] font-semibold">Frete PAC</span>
            </div>
            <span className="text-[11px] font-mono font-bold" style={{ color: emerald }}>
              R$ 15,00
            </span>
          </div>
          <div
            className="flex items-center justify-between px-2.5 py-2 rounded-md border"
            style={{ background: inputBg, borderColor: inputBorder }}
          >
            <div className="flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5" style={{ color: textFaint }} />
              <span className="text-[11px]" style={{ color: textMuted }}>
                Retirar na loja
              </span>
            </div>
            <span className="text-[10px] font-bold" style={{ color: emerald }}>
              Grátis
            </span>
          </div>
        </div>

        {/* Pagamento mock — só mostra abas dos métodos marcados. Cartão é fallback se tudo off. */}
        <div className="rounded-lg border p-3 space-y-2" style={{ background: cardBg, borderColor: cardBorder }}>
          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: textMuted }}>
            Pagamento
          </p>
          {(() => {
            const tabs: { key: "card" | "pix" | "boleto"; label: string }[] = [];
            const anyOn = methodCard || methodPix || methodBoleto;
            if (methodCard || !anyOn) tabs.push({ key: "card", label: "Cartão" });
            if (methodPix) tabs.push({ key: "pix", label: "PIX" });
            if (methodBoleto) tabs.push({ key: "boleto", label: "Boleto" });
            return (
              <div className="flex gap-1.5">
                {tabs.map((t, i) => (
                  <div
                    key={t.key}
                    className={`flex-1 rounded-md px-2 py-1.5 text-[10px] text-center border ${
                      i === 0 ? "font-semibold" : ""
                    }`}
                    style={{
                      background: inputBg,
                      borderColor: i === 0 ? accent : inputBorder,
                      color: i === 0 ? text : textMuted,
                    }}
                  >
                    {t.label}
                  </div>
                ))}
              </div>
            );
          })()}
          <div
            className="rounded-md px-2 py-1.5 border text-[10px]"
            style={{ background: inputBg, borderColor: inputBorder, color: textFaint }}
          >
            1234 1234 1234 1234
          </div>
          <button
            type="button"
            disabled
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-white text-[12px] font-bold mt-1"
            style={{ background: accent }}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            Pagar R$ 115,00
          </button>
        </div>

        {/* Footer image (se houver) — no mobile sempre 100%; no desktop respeita footerImageSize */}
        {footerImageUrl ? (
          <div
            className={`mx-auto rounded-lg overflow-hidden border ${
              device === "mobile"
                ? "w-full"
                : footerImageSize === "small"
                  ? "max-w-[40%]"
                  : footerImageSize === "medium"
                    ? "max-w-[65%]"
                    : "w-full"
            }`}
            style={{ borderColor: cardBorder }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={footerImageUrl} alt="" className="w-full h-auto object-cover" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
