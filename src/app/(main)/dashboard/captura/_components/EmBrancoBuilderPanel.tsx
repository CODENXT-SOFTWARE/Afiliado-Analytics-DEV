"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import type {
  BlankAnimationPreset,
  BlankBgImageFit,
  BlankBgImagePosition,
  BlankBgImageRepeat,
  BlankCanvasConfig,
  BlankCtaPlacement,
  BlankDecorative,
  BlankFontPreset,
} from "@/lib/capture-blank-canvas";
import EmBrancoCssColorField from "./EmBrancoCssColorField";
import Toolist from "@/app/components/ui/Toolist";

const labelClass = "block text-xs font-medium text-text-secondary mb-1";
const inputClass =
  "w-full rounded-lg border border-dark-border bg-dark-bg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-shopee-orange/50";
const tabBase =
  "shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors border border-transparent";
const tabActive = "bg-shopee-orange/15 text-shopee-orange border-shopee-orange/30";
const tabIdle = "text-text-secondary hover:text-text-primary hover:bg-dark-bg/60";

type TabId = "bg" | "card" | "text" | "btn" | "media" | "motion";

export type EmBrancoBuilderPanelProps = {
  value: BlankCanvasConfig;
  onChange: (next: BlankCanvasConfig) => void;
  heroFile: File | null;
  onHeroFile: (f: File | null) => void;
  onClearStoredHero: () => void | Promise<void>;
  bgFile: File | null;
  onBgFile: (f: File | null) => void;
  onClearStoredBg: () => void | Promise<void>;
  /** Pré-visualização (blob local ou URL pública já guardada). */
  heroPreviewUrl: string | null;
  bgPreviewUrl: string | null;
  captureWizardMode: "create" | "edit";
};

function patch(prev: BlankCanvasConfig, part: Partial<BlankCanvasConfig>): BlankCanvasConfig {
  return { ...prev, ...part };
}

function EmBrancoToggleRow(props: {
  id: string;
  label: string;
  /** Texto longo no ícone de ajuda (Toolist). */
  toolistText?: string;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
}) {
  const labelId = `${props.id}-label`;
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-1.5 pr-2">
        <span id={labelId} className="text-sm font-medium text-text-primary min-w-0">
          {props.label}
        </span>
        {props.toolistText ? (
          <Toolist variant="below" wide text={props.toolistText} className="shrink-0" />
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-labelledby={labelId}
        aria-checked={props.checked}
        onClick={() => props.onCheckedChange(!props.checked)}
        className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border border-dark-border transition-colors focus:outline-none focus:ring-2 focus:ring-shopee-orange/50 ${
          props.checked ? "bg-shopee-orange" : "bg-dark-bg"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow transition ${
            props.checked ? "translate-x-[1.35rem]" : "translate-x-0.5"
          } mt-px`}
        />
      </button>
    </div>
  );
}

const MAX_BLANK_IMAGE_BYTES = 3 * 1024 * 1024;
const BLANK_IMG_MIME = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);

function EmBrancoImagePickBlock(props: {
  inputId: string;
  previewUrl: string | null;
  hasPendingOrStored: boolean;
  pendingFile: boolean;
  onPickFile: (f: File | null) => void;
  onClear: () => void | Promise<void>;
  selectTitle: string;
  constraintsLine: string;
  accept: string;
  uploadHint: string;
}) {
  const {
    inputId,
    previewUrl,
    hasPendingOrStored,
    pendingFile,
    onPickFile,
    onClear,
    selectTitle,
    constraintsLine,
    accept,
    uploadHint,
  } = props;

  return (
    <div className="space-y-2">
      {hasPendingOrStored ? (
        <div className="flex items-center gap-3">
          {previewUrl ? (
            <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-md border border-dark-border bg-dark-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="" className="h-full w-full object-cover" />
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => void onClear()}
            className="inline-flex items-center gap-2 rounded-md border border-dark-border bg-dark-bg px-3 py-2 text-sm text-text-secondary hover:text-text-primary"
          >
            <X className="h-4 w-4" />
            {pendingFile ? "Remover seleção" : "Remover imagem"}
          </button>
        </div>
      ) : null}

      <label
        htmlFor={inputId}
        className="block cursor-pointer rounded-lg border border-dashed border-dark-border bg-dark-bg/40 p-4 transition-colors hover:bg-dark-bg/60"
      >
        <input
          id={inputId}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            e.target.value = "";
            if (!f) {
              onPickFile(null);
              return;
            }
            if (!BLANK_IMG_MIME.has(f.type) || f.size > MAX_BLANK_IMAGE_BYTES) return;
            onPickFile(f);
          }}
        />
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-dark-border bg-dark-card">
            <Plus className="h-5 w-5 text-text-secondary" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-text-primary">{selectTitle}</div>
            <div className="truncate text-xs text-text-secondary">{constraintsLine}</div>
          </div>
        </div>
      </label>
      <p className="text-[11px] leading-relaxed text-text-secondary/85">{uploadHint}</p>
    </div>
  );
}

export default function EmBrancoBuilderPanel({
  value: c,
  onChange,
  heroFile,
  onHeroFile,
  onClearStoredHero,
  bgFile,
  onBgFile,
  onClearStoredBg,
  heroPreviewUrl,
  bgPreviewUrl,
  captureWizardMode,
}: EmBrancoBuilderPanelProps) {
  const [tab, setTab] = useState<TabId>("bg");

  const blankImgUploadHint =
    captureWizardMode === "create"
      ? "Pré-visualização imediata. O envio ao armazenamento acontece ao criar o site (como a logo no passo 1)."
      : "Pré-visualização imediata. O envio ao armazenamento acontece ao guardar as alterações.";

  const tabs: { id: TabId; label: string }[] = [
    { id: "bg", label: "Fundo" },
    { id: "card", label: "Cartão" },
    { id: "text", label: "Textos" },
    { id: "btn", label: "Botão" },
    { id: "media", label: "Logo & imagem" },
    { id: "motion", label: "Animação" },
  ];

  return (
    <div className="rounded-lg border border-dark-border bg-dark-bg/25 p-4 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-text-primary">Página em branco</div>
          <p className="text-xs text-text-secondary mt-1 leading-relaxed">
            Ajuste visual do cartão. Textos e cor do CTA nos passos 1–2.
          </p>
        </div>
        <Toolist
          variant="below"
          wide
          className="shrink-0"
          text="Fundo (cor, gradiente, imagem, brilho animado), cartão, tipografia, botão, imagem de destaque e animações de entrada. YouTube, carrossel, notificações e secção promocional ficam no passo 5 do assistente."
        />
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-dark-border/70 pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`${tabBase} ${tab === t.id ? tabActive : tabIdle}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "bg" ? (
        <div className="space-y-3">
          <EmBrancoToggleRow
            id="em-use-solid-bg"
            label="Fundo sólido"
            toolistText="Em vez do gradiente: usa uma única cor (definida abaixo) para o fundo da página."
            checked={c.useSolidBg}
            onCheckedChange={(useSolidBg) => onChange(patch(c, { useSolidBg }))}
          />
          {c.useSolidBg ? (
            <EmBrancoCssColorField
              label="Cor do fundo"
              value={c.solidBg}
              onChange={(solidBg) => onChange(patch(c, { solidBg }))}
              allowAlpha
              fallbackHex="#0c0c0f"
            />
          ) : (
            <>
              <div>
                <label className={labelClass}>Ângulo do gradiente ({c.bgAngle}°)</label>
                <input
                  type="range"
                  min={0}
                  max={360}
                  value={c.bgAngle}
                  onChange={(e) => onChange(patch(c, { bgAngle: Number(e.target.value) }))}
                  className="w-full accent-shopee-orange"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <EmBrancoCssColorField
                  label="Cor inicial"
                  value={c.bgFrom}
                  onChange={(bgFrom) => onChange(patch(c, { bgFrom }))}
                  allowAlpha
                  fallbackHex="#0f0f14"
                />
                <EmBrancoCssColorField
                  label="Cor final"
                  value={c.bgTo}
                  onChange={(bgTo) => onChange(patch(c, { bgTo }))}
                  allowAlpha
                  fallbackHex="#1a0f24"
                />
              </div>
            </>
          )}
          <div>
            <label className={labelClass}>Decoração de fundo</label>
            <select
              value={c.decorative}
              onChange={(e) => onChange(patch(c, { decorative: e.target.value as BlankDecorative }))}
              className={inputClass}
            >
              <option value="none">Nenhuma</option>
              <option value="dots">Pontos subtis</option>
              <option value="grid">Grelha técnica</option>
              <option value="gradient_orbs">Orbes de luz</option>
            </select>
          </div>

          <div className="rounded-md border border-dark-border/60 bg-dark-bg/30 p-3 space-y-3">
            <EmBrancoToggleRow
              id="em-bg-image"
              label="Imagem de fundo"
              toolistText="Camada por baixo do gradiente ou da cor sólida: a imagem fica atrás do tratamento visual escolhido em cima."
              checked={c.bgImageEnabled}
              onCheckedChange={(bgImageEnabled) => onChange(patch(c, { bgImageEnabled }))}
            />
            {c.bgImageEnabled ? (
              <>
                <EmBrancoImagePickBlock
                  inputId="em-blank-bg-file"
                  previewUrl={bgPreviewUrl}
                  hasPendingOrStored={Boolean(bgFile || c.bgImagePath?.trim())}
                  pendingFile={Boolean(bgFile)}
                  onPickFile={onBgFile}
                  onClear={onClearStoredBg}
                  selectTitle="Selecionar imagem de fundo"
                  constraintsLine="PNG, JPEG ou WebP até 3 MB"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  uploadHint={blankImgUploadHint}
                />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className={labelClass}>Ajuste</label>
                    <select
                      value={c.bgImageFit}
                      onChange={(e) => onChange(patch(c, { bgImageFit: e.target.value as BlankBgImageFit }))}
                      className={inputClass}
                    >
                      <option value="cover">Cover (preenche)</option>
                      <option value="contain">Contain (inteira)</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Repetição</label>
                    <select
                      value={c.bgImageRepeat}
                      onChange={(e) => onChange(patch(c, { bgImageRepeat: e.target.value as BlankBgImageRepeat }))}
                      className={inputClass}
                    >
                      <option value="no-repeat">Sem repetir</option>
                      <option value="repeat">Repetir</option>
                      <option value="repeat-x">Só horizontal</option>
                      <option value="repeat-y">Só vertical</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Posição</label>
                    <select
                      value={c.bgImagePosition}
                      onChange={(e) => onChange(patch(c, { bgImagePosition: e.target.value as BlankBgImagePosition }))}
                      className={inputClass}
                    >
                      <option value="center">Centro</option>
                      <option value="top">Topo</option>
                      <option value="bottom">Base</option>
                      <option value="left">Esquerda</option>
                      <option value="right">Direita</option>
                    </select>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === "card" ? (
        <div className="space-y-3">
          <EmBrancoCssColorField
            label="Cor do cartão"
            value={c.cardBg}
            onChange={(cardBg) => onChange(patch(c, { cardBg }))}
            allowAlpha
            fallbackHex="#ffffff"
          />
          <EmBrancoCssColorField
            label="Borda do cartão"
            value={c.cardBorder}
            onChange={(cardBorder) => onChange(patch(c, { cardBorder }))}
            allowAlpha
            fallbackHex="#ffffff"
          />
          <div>
            <label className={labelClass}>Raio dos cantos ({c.cardRadiusPx}px)</label>
            <input
              type="range"
              min={0}
              max={48}
              value={c.cardRadiusPx}
              onChange={(e) => onChange(patch(c, { cardRadiusPx: Number(e.target.value) }))}
              className="w-full accent-shopee-orange"
            />
          </div>
          <div>
            <label className={labelClass}>Sombra ({Math.round(c.cardShadowOpacity * 100)}%)</label>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(c.cardShadowOpacity * 100)}
              onChange={(e) => onChange(patch(c, { cardShadowOpacity: Number(e.target.value) / 100 }))}
              className="w-full accent-shopee-orange"
            />
          </div>
          <EmBrancoToggleRow
            id="em-glass-card"
            label="Efeito vidro"
            toolistText="Desfoque (backdrop blur) no cartão para aspeto de vidro fosco sobre o fundo."
            checked={c.glassCard}
            onCheckedChange={(glassCard) => onChange(patch(c, { glassCard }))}
          />
          <div>
            <label className={labelClass}>Largura máx. do conteúdo ({c.maxContentWidthPx}px)</label>
            <input
              type="range"
              min={320}
              max={640}
              step={10}
              value={c.maxContentWidthPx}
              onChange={(e) => onChange(patch(c, { maxContentWidthPx: Number(e.target.value) }))}
              className="w-full accent-shopee-orange"
            />
          </div>
        </div>
      ) : null}

      {tab === "text" ? (
        <div className="space-y-3">
          <div>
            <label className={labelClass}>Tipo de letra</label>
            <select
              value={c.fontPreset}
              onChange={(e) => onChange(patch(c, { fontPreset: e.target.value as BlankFontPreset }))}
              className={inputClass}
            >
              <option value="system">Sistema</option>
              <option value="inter">Inter</option>
              <option value="dm_sans">DM Sans</option>
              <option value="playfair">Playfair Display</option>
              <option value="space_grotesk">Space Grotesk</option>
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <EmBrancoCssColorField
              label="Título — cor"
              value={c.titleColor}
              onChange={(titleColor) => onChange(patch(c, { titleColor }))}
              fallbackHex="#fafafa"
            />
            <div>
              <label className={labelClass}>Título — tamanho ({c.titleFontPx}px)</label>
              <input
                type="range"
                min={18}
                max={48}
                value={c.titleFontPx}
                onChange={(e) => onChange(patch(c, { titleFontPx: Number(e.target.value) }))}
                className="w-full accent-shopee-orange"
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>Alinhamento do título</label>
            <select
              value={c.titleAlign}
              onChange={(e) => onChange(patch(c, { titleAlign: e.target.value as BlankCanvasConfig["titleAlign"] }))}
              className={inputClass}
            >
              <option value="left">Esquerda</option>
              <option value="center">Centro</option>
              <option value="right">Direita</option>
            </select>
          </div>
          {c.showSubtitle ? (
            <EmBrancoCssColorField
              label="Cor da linha curta sob o título"
              value={c.subtitleColor}
              onChange={(subtitleColor) => onChange(patch(c, { subtitleColor }))}
              allowAlpha
              fallbackHex="#fafafa"
            />
          ) : null}
          <EmBrancoCssColorField
            label="Cor da descrição"
            value={c.descColor}
            onChange={(descColor) => onChange(patch(c, { descColor }))}
            allowAlpha
            fallbackHex="#fafafa"
          />
          <div>
            <label className={labelClass}>Tamanho da descrição ({c.descFontPx}px)</label>
            <input
              type="range"
              min={12}
              max={22}
              value={c.descFontPx}
              onChange={(e) => onChange(patch(c, { descFontPx: Number(e.target.value) }))}
              className="w-full accent-shopee-orange"
            />
          </div>
          <div>
            <label className={labelClass}>Alinhamento do texto (título + descrição)</label>
            <select
              value={c.textAlign}
              onChange={(e) => onChange(patch(c, { textAlign: e.target.value as BlankCanvasConfig["textAlign"] }))}
              className={inputClass}
            >
              <option value="left">Esquerda</option>
              <option value="center">Centro</option>
              <option value="right">Direita</option>
            </select>
          </div>
        </div>
      ) : null}

      {tab === "btn" ? (
        <div className="space-y-3">
          <div>
            <label className={labelClass}>Posição do botão</label>
            <select
              value={c.ctaPlacement}
              onChange={(e) => onChange(patch(c, { ctaPlacement: e.target.value as BlankCtaPlacement }))}
              className={inputClass}
            >
              <option value="below_description">Depois do texto (no cartão)</option>
              <option value="bottom_sticky">Fixo em baixo (sticky)</option>
            </select>
          </div>
          <div className="flex items-center gap-1.5 rounded-md border border-dark-border/60 bg-dark-bg/30 px-2.5 py-2">
            <span className="text-[11px] text-text-secondary/90">Cor do botão no passo 1</span>
            <Toolist
              variant="below"
              wide
              text="A cor de fundo do botão é a mesma do passo 1 (identidade da página). Neste separador defines só posição do CTA, raio, largura total e pulso."
            />
          </div>
          <div>
            <label className={labelClass}>Raio do botão (px; 999 = pílula)</label>
            <input
              type="range"
              min={0}
              max={999}
              value={c.btnRadiusPx}
              onChange={(e) => onChange(patch(c, { btnRadiusPx: Number(e.target.value) }))}
              className="w-full accent-shopee-orange"
            />
          </div>
          <EmBrancoToggleRow
            id="em-btn-full-width"
            label="Botão largura total"
            checked={c.btnFullWidth}
            onCheckedChange={(btnFullWidth) => onChange(patch(c, { btnFullWidth }))}
          />
          <EmBrancoToggleRow
            id="em-btn-pulse"
            label="Pulso no botão"
            toolistText="Animação suave à volta do CTA para chamar mais atenção ao botão."
            checked={c.btnPulse}
            onCheckedChange={(btnPulse) => onChange(patch(c, { btnPulse }))}
          />
        </div>
      ) : null}

      {tab === "media" ? (
        <div className="space-y-3">
          <EmBrancoToggleRow
            id="em-show-logo"
            label="Mostrar logo"
            toolistText="Usa a mesma imagem enviada no passo 1 (logo opcional do site)."
            checked={c.showLogo}
            onCheckedChange={(showLogo) => onChange(patch(c, { showLogo }))}
          />
          <EmBrancoToggleRow
            id="em-show-hero"
            label="Mostrar imagem de destaque"
            checked={c.showHero}
            onCheckedChange={(showHero) => onChange(patch(c, { showHero }))}
          />
          {c.showHero ? (
            <>
              <div>
                <div className="mb-2 flex items-center gap-1.5">
                  <span className="text-xs font-medium text-text-secondary">Imagem de destaque</span>
                  <Toolist
                    variant="below"
                    wide
                    text="Aparece no cartão por baixo do título (quando ativa). Mesmo fluxo que a logo: pode escolher o ficheiro já; o upload ao armazenamento é ao criar ou guardar o site."
                  />
                </div>
                <EmBrancoImagePickBlock
                  inputId="em-blank-hero-file"
                  previewUrl={heroPreviewUrl}
                  hasPendingOrStored={Boolean(heroFile || c.heroPath?.trim())}
                  pendingFile={Boolean(heroFile)}
                  onPickFile={onHeroFile}
                  onClear={onClearStoredHero}
                  selectTitle="Selecionar imagem de destaque"
                  constraintsLine="PNG, JPEG ou WebP até 3 MB"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  uploadHint={blankImgUploadHint}
                />
              </div>
              <div>
                <label className={labelClass}>Raio da imagem ({c.heroRadiusPx}px)</label>
                <input
                  type="range"
                  min={0}
                  max={40}
                  value={c.heroRadiusPx}
                  onChange={(e) => onChange(patch(c, { heroRadiusPx: Number(e.target.value) }))}
                  className="w-full accent-shopee-orange"
                />
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {tab === "motion" ? (
        <div className="space-y-3">
          <div>
            <div className="mb-1 flex items-center gap-1.5">
              <span className="block text-xs font-medium text-text-secondary">Animação de entrada</span>
              <Toolist
                variant="below"
                wide
                text='Respeitamos “menos movimento” no sistema: com essa opção ativa no dispositivo, as animações são desligadas automaticamente.'
              />
            </div>
            <select
              value={c.animation}
              onChange={(e) => onChange(patch(c, { animation: e.target.value as BlankAnimationPreset }))}
              className={inputClass}
            >
              <option value="none">Nenhuma</option>
              <option value="fade_rise">Subir com fade</option>
              <option value="bounce_in">Bounce suave</option>
              <option value="float_card">Cartão a flutuar</option>
              <option value="pulse_cta">Entrada rápida + foco CTA</option>
              <option value="shimmer_bg">Brilho no fundo</option>
            </select>
          </div>
          <div className="flex items-center gap-1.5 border-t border-dark-border/50 pt-2">
            <span className="text-[11px] font-medium text-text-primary">Brilho no fundo</span>
            <Toolist
              variant="below"
              wide
              text="Funciona com fundo sólido ou em gradiente (sem imagem de fundo). Com imagem de fundo ativa, o brilho animado fica desligado para não mover a foto — podes usar gradiente por cima da imagem para leitura."
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
