"use client";

import React, { useCallback, useMemo, useState } from "react";
import {
  Upload,
  Loader2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  User,
  Image as ImageIcon,
  Video,
  Download,
  AlertCircle,
  Mic,
} from "lucide-react";
import ProFeatureGate from "../ProFeatureGate";
import {
  FEMALE_PRESETS,
  MALE_PRESETS,
  SCENE_CHIPS,
  POSE_CHIPS,
  STYLE_CHIPS,
  IMPROVEMENT_CHIPS,
  VIDEO_MOTION_CHIPS,
} from "@/lib/expert-generator/constants";
import {
  DEFAULT_IMAGE_PROMPT,
  DEFAULT_VIDEO_PROMPT,
} from "@/lib/expert-generator/build-prompt";
import { compressImageFileToMaxBytes } from "@/lib/compress-image-client";
import { humanizeLargeRequestError } from "@/lib/humanize-fetch-error";

const accentBtn =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-3 text-sm font-semibold disabled:opacity-40 transition-all shadow-[0_4px_20px_rgba(16,185,129,0.25)]";
const card = "rounded-2xl border border-dark-border bg-dark-card p-5 md:p-6";
const chipOff =
  "rounded-lg border border-dark-border bg-dark-bg px-3 py-1.5 text-xs font-medium text-text-secondary hover:border-emerald-600/40 transition-colors";
const chipOn =
  "rounded-lg border border-emerald-600/80 bg-emerald-600/15 px-3 py-1.5 text-xs font-semibold text-emerald-400";

function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

function dataUrlToBase64(dataUrl: string): string {
  const i = dataUrl.indexOf(",");
  return i >= 0 ? dataUrl.slice(i + 1) : dataUrl;
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(dataUrlToBase64(r.result as string));
    r.onerror = () => reject(new Error("Falha ao ler imagem."));
    r.readAsDataURL(blob);
  });
}

function ExpertGeneratorInner() {
  const [productPreview, setProductPreview] = useState<string | null>(null);
  const [productBase64, setProductBase64] = useState<string | null>(null);
  const [productMime, setProductMime] = useState("image/jpeg");
  const [productDescription, setProductDescription] = useState("");
  const [compressing, setCompressing] = useState(false);
  const [productAnalyzing, setProductAnalyzing] = useState(false);

  const [gender, setGender] = useState<"women" | "men">("women");
  const [modelMode, setModelMode] = useState<"preset" | "custom">("preset");
  const [presetId, setPresetId] = useState(FEMALE_PRESETS[0]!.id);
  const [customModel, setCustomModel] = useState("");

  const [sceneIds, setSceneIds] = useState<string[]>(["casa"]);
  const [sceneCustom, setSceneCustom] = useState("");
  const [poseIds, setPoseIds] = useState<string[]>(["frente"]);
  const [poseCustom, setPoseCustom] = useState("");
  const [styleIds, setStyleIds] = useState<string[]>(["casual"]);
  const [improvementIds, setImprovementIds] = useState<string[]>([]);

  const [advancedImageOpen, setAdvancedImageOpen] = useState(false);
  const [advancedImagePrompt, setAdvancedImagePrompt] =
    useState(DEFAULT_IMAGE_PROMPT);

  const [advancedVideoOpen, setAdvancedVideoOpen] = useState(false);
  const [advancedVideoPrompt, setAdvancedVideoPrompt] =
    useState(DEFAULT_VIDEO_PROMPT);

  const [motionIds, setMotionIds] = useState<string[]>(["micro", "uso"]);
  const [motionCustom, setMotionCustom] = useState("");
  const [durationSec, setDurationSec] = useState<4 | 6 | 8>(6);
  const [videoAspect, setVideoAspect] = useState<"9:16" | "16:9">("9:16");
  const [videoRes, setVideoRes] = useState<"720p" | "1080p">("720p");
  const [generateAudio, setGenerateAudio] = useState(false);
  const [videoVoiceScript, setVideoVoiceScript] = useState("");
  const [videoVoiceGender, setVideoVoiceGender] = useState<"female" | "male">(
    "female"
  );

  const [imageAspect, setImageAspect] = useState("9:16");
  const [imageProvider, setImageProvider] = useState<"vertex" | "nano-banana">(
    "vertex"
  );

  const [genImgLoading, setGenImgLoading] = useState(false);
  const [genImgErr, setGenImgErr] = useState<string | null>(null);
  const [imageResult, setImageResult] = useState<{
    base64: string;
    mime: string;
  } | null>(null);
  const [lastVisionSummary, setLastVisionSummary] = useState<string | null>(
    null
  );

  const [veoLoading, setVeoLoading] = useState(false);
  const [veoErr, setVeoErr] = useState<string | null>(null);
  const [veoProgress, setVeoProgress] = useState<string | null>(null);
  const [videoDataUrl, setVideoDataUrl] = useState<string | null>(null);
  const [videoGcsUri, setVideoGcsUri] = useState<string | null>(null);

  const presets = gender === "women" ? FEMALE_PRESETS : MALE_PRESETS;

  React.useEffect(() => {
    const first = (gender === "women" ? FEMALE_PRESETS : MALE_PRESETS)[0]!.id;
    setPresetId((prev) => {
      const list = gender === "women" ? FEMALE_PRESETS : MALE_PRESETS;
      if (list.some((p) => p.id === prev)) return prev;
      return first;
    });
  }, [gender]);

  const canGenerateImage = useMemo(() => {
    if (productAnalyzing || compressing) return false;
    if (modelMode === "custom" && customModel.trim().length < 8) return false;
    return Boolean(productBase64) || productDescription.trim().length >= 15;
  }, [
    productAnalyzing,
    compressing,
    modelMode,
    customModel,
    productBase64,
    productDescription,
  ]);

  const ingestProductFile = useCallback(async (file: File | null) => {
    if (!file) {
      setProductPreview(null);
      setProductBase64(null);
      return;
    }
    const ok = ["image/jpeg", "image/png", "image/webp"].includes(file.type);
    if (!ok) {
      setGenImgErr("Use JPEG, PNG ou WEBP.");
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      setGenImgErr("Arquivo acima de 100MB.");
      return;
    }
    setGenImgErr(null);
    setCompressing(true);
    setProductAnalyzing(false);
    let b64: string | null = null;
    try {
      const maxPayload = 3_400_000;
      const blob = await compressImageFileToMaxBytes(file, maxPayload);
      b64 = await blobToBase64(blob);
      setProductMime("image/jpeg");
      setProductBase64(b64);
      setProductPreview(URL.createObjectURL(blob));
    } catch (e) {
      setGenImgErr(e instanceof Error ? e.message : "Erro ao processar imagem.");
      setProductPreview(null);
      setProductBase64(null);
      setCompressing(false);
      return;
    } finally {
      setCompressing(false);
    }

    if (!b64) return;

    setProductAnalyzing(true);
    try {
      const res = await fetch("/api/expert-generator/analyze-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productImageBase64: b64,
          productMimeType: "image/jpeg",
        }),
      });
      const data = (await res.json()) as {
        description?: string;
        error?: string;
        detail?: string;
        modelUsed?: string;
      };
      if (res.ok && typeof data.description === "string" && data.description.trim()) {
        setProductDescription(data.description.trim());
        setGenImgErr(null);
      } else {
        const base =
          data.error ??
          "Não foi possível preencher a descrição automaticamente. Pode escrever à mão ou gerar na mesma.";
        const extra =
          typeof data.detail === "string" && data.detail.trim()
            ? `\n\n${data.detail.trim().slice(0, 1200)}`
            : "";
        setGenImgErr(base + extra);
      }
    } catch {
      setGenImgErr(
        "Falha de rede ao analisar o produto. Descreva no campo abaixo ou tente gerar na mesma."
      );
    } finally {
      setProductAnalyzing(false);
    }
  }, []);

  const buildOptionsPayload = useCallback(() => {
    const model =
      modelMode === "custom"
        ? { mode: "custom" as const, description: customModel, gender }
        : { mode: "preset" as const, presetId, gender };
    return {
      model,
      sceneIds,
      sceneCustom,
      poseIds,
      poseCustom,
      styleIds,
      improvementIds,
      motionIds,
      motionCustom,
    };
  }, [
    modelMode,
    customModel,
    gender,
    presetId,
    sceneIds,
    sceneCustom,
    poseIds,
    poseCustom,
    styleIds,
    improvementIds,
    motionIds,
    motionCustom,
  ]);

  const onGenerateImage = async () => {
    setGenImgErr(null);
    setGenImgLoading(true);
    setImageResult(null);
    setLastVisionSummary(null);
    setVideoDataUrl(null);
    setVideoGcsUri(null);
    try {
      const res = await fetch("/api/expert-generator/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          advancedImagePrompt,
          aspectRatio: imageAspect,
          productImageBase64: productBase64 ?? "",
          productMimeType: productMime,
          productDescription,
          productVisionSummary: productDescription.trim() || undefined,
          imageProvider,
          options: buildOptionsPayload(),
        }),
      });
      const raw = await res.text();
      let data: {
        error?: string;
        hint?: string;
        detail?: string;
        imageBase64?: string;
        mimeType?: string;
        productVisionSummary?: string | null;
      } = {};
      try {
        data = JSON.parse(raw) as typeof data;
      } catch {
        throw new Error(humanizeLargeRequestError(raw.slice(0, 200)));
      }
      if (!res.ok) {
        const detailSlice =
          typeof data.detail === "string" && data.detail.trim()
            ? data.detail.trim().slice(0, 1500)
            : "";
        const parts = [data.error, data.hint, detailSlice].filter(Boolean);
        throw new Error(
          parts.length > 0
            ? parts.join("\n\n")
            : humanizeLargeRequestError(raw.slice(0, 200))
        );
      }
      if (!data.imageBase64) {
        throw new Error("Resposta sem imagem.");
      }
      setImageResult({
        base64: data.imageBase64,
        mime: data.mimeType ?? "image/png",
      });
      setLastVisionSummary(
        typeof data.productVisionSummary === "string"
          ? data.productVisionSummary
          : null
      );
    } catch (e) {
      setGenImgErr(e instanceof Error ? e.message : "Erro ao gerar imagem.");
    } finally {
      setGenImgLoading(false);
    }
  };

  const pollVeo = async (operationName: string) => {
    for (let i = 0; i < 60; i++) {
      setVeoProgress(
        `A gerar vídeo no Vertex (Veo Fast)… ${i + 1}/60 (~3s entre tentativas)`
      );
      const res = await fetch("/api/expert-generator/veo-poll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operationName }),
      });
      const j = (await res.json()) as {
        done?: boolean;
        error?: string | { message?: string };
        videos?: {
          bytesBase64Encoded?: string;
          gcsUri?: string;
          mimeType?: string;
        }[];
      };
      if (!res.ok) {
        const msg =
          typeof j.error === "string"
            ? j.error
            : j.error?.message ?? "Falha no poll Veo.";
        throw new Error(msg);
      }
      const errObj = j.error;
      if (errObj && typeof errObj === "object" && errObj.message) {
        throw new Error(errObj.message);
      }
      if (j.done) {
        const v = j.videos?.[0];
        if (v?.bytesBase64Encoded && v.mimeType) {
          setVideoDataUrl(
            `data:${v.mimeType};base64,${v.bytesBase64Encoded}`
          );
          setVideoGcsUri(null);
        } else if (v?.gcsUri) {
          setVideoGcsUri(v.gcsUri);
          setVideoDataUrl(null);
        } else if ((j as { raiMediaFilteredCount?: number }).raiMediaFilteredCount) {
          throw new Error(
            "O Veo filtrou o vídeo por políticas de segurança. Tente ajustar o prompt ou a imagem."
          );
        } else {
          throw new Error(
            "Vídeo concluído mas sem bytes nem URI pública. Configure storageUri no GCP ou tente novamente."
          );
        }
        return;
      }
      await new Promise((r) => setTimeout(r, 3000));
    }
    throw new Error("Tempo esgotado ao aguardar o Veo.");
  };

  const onGenerateVideo = async () => {
    if (!imageResult) return;
    setVeoErr(null);
    setVeoLoading(true);
    setVideoDataUrl(null);
    setVideoGcsUri(null);
    setVeoProgress("A iniciar geração…");
    try {
      const res = await fetch("/api/expert-generator/veo-start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: imageResult.base64,
          imageMimeType: imageResult.mime,
          aspectRatio: videoAspect,
          durationSeconds: durationSec,
          resolution: videoRes,
          generateAudio:
            videoVoiceScript.trim().length > 0 ? true : generateAudio,
          voiceScript: videoVoiceScript.trim() || undefined,
          voiceGender: videoVoiceGender,
          advancedVideoPrompt,
          advancedImagePrompt,
          productDescription,
          productVisionSummary: lastVisionSummary,
          options: buildOptionsPayload(),
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        operationName?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || "Falha ao iniciar Veo.");
      }
      if (!data.operationName) {
        throw new Error("Sem operationName.");
      }
      await pollVeo(data.operationName);
    } catch (e) {
      setVeoErr(e instanceof Error ? e.message : "Erro no vídeo.");
    } finally {
      setVeoLoading(false);
      setVeoProgress(null);
    }
  };

  const downloadImage = () => {
    if (!imageResult) return;
    const a = document.createElement("a");
    a.href = `data:${imageResult.mime};base64,${imageResult.base64}`;
    a.download = `especialista-${Date.now()}.png`;
    a.click();
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 pb-24 space-y-8">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-emerald-400">
          <Sparkles className="h-6 w-6" />
          <h1 className="text-2xl font-bold text-text-primary">
            Gerador de Especialista
          </h1>
        </div>
        <p className="text-sm text-text-secondary leading-relaxed">
          Modelos económicos no Vertex:{" "}
          <strong className="text-text-primary">Imagen 4 Fast</strong> (~US$ 0,02
          / imagem) e{" "}
          <strong className="text-text-primary">Veo 3.1 Fast</strong> (~US$ 0,10/s
          de vídeo — ex.: 6s ≈ US$ 0,60). Requer{" "}
          <code className="text-xs bg-dark-bg px-1 rounded">VERTEX_PROJECT_ID</code>{" "}
          +{" "}
          <code className="text-xs bg-dark-bg px-1 rounded">
            VERTEX_SERVICE_ACCOUNT_JSON_BASE64
          </code>
          .           <code className="text-xs bg-dark-bg px-1 rounded">GEMINI_API_KEY</code>{" "}
          obrigatória para analisar a foto ao carregar e enriquecer o prompt. As opções de cena/pose
          vão no corpo JSON (<code className="text-xs bg-dark-bg px-1 rounded">options</code>
          ) — escolha <strong className="text-text-primary">só uma cena</strong> para o modelo não misturar casa com academia.
        </p>
      </header>

      {/* Passo 1 */}
      <section className={card}>
        <h2 className="text-sm font-bold text-emerald-400 mb-1">
          1. Foto do produto
        </h2>
        <p className="text-xs text-text-secondary mb-4">
          JPEG, PNG ou WEBP até 100MB (comprimimos no browser antes do envio).
          Ao escolher a foto, enviamos para o Gemini uma análise detalhada e
          preenchemos o campo de texto abaixo — pode editar antes de gerar.
        </p>
        <label className="flex flex-col items-center justify-center min-h-[160px] border-2 border-dashed border-dark-border rounded-xl bg-dark-bg/50 cursor-pointer hover:border-emerald-600/50 transition-colors">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => ingestProductFile(e.target.files?.[0] ?? null)}
          />
          {compressing || productAnalyzing ? (
            <div className="flex flex-col items-center gap-2 text-text-secondary text-sm">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
              <span>
                {compressing
                  ? "A comprimir…"
                  : "A analisar o produto com Gemini…"}
              </span>
            </div>
          ) : productPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={productPreview}
              alt="Produto"
              className="max-h-48 rounded-lg object-contain"
            />
          ) : (
            <>
              <Upload className="h-10 w-10 text-text-secondary mb-2" />
              <span className="text-sm text-text-secondary text-center px-4">
                Toque ou arraste a foto do produto
              </span>
            </>
          )}
        </label>
        <p className="text-xs text-text-secondary mt-3">
          Sem foto? Descreva o produto (mín. 15 caracteres). Com foto, o texto
          vem da análise automática (em inglês) — edite se quiser corrigir a
          marca ou cores.
        </p>
        <textarea
          value={productDescription}
          onChange={(e) => setProductDescription(e.target.value)}
          placeholder="Ex.: Dois frascos cilíndricos pretos mate, tampa preta canelada, rótulo preto com EREC em branco e PRO em vermelho, ícone espartano branco/vermelho, texto 30 KAPSELN…"
          rows={5}
          className="mt-2 w-full rounded-xl border border-dark-border bg-dark-bg py-2.5 px-3.5 text-text-primary text-sm placeholder:text-text-secondary/40 focus:outline-none focus:border-emerald-600/60"
        />
      </section>

      {/* Passo 2 */}
      <section className={`${card} space-y-6`}>
        <h2 className="text-sm font-bold text-emerald-400">
          2. Modelo, cena, pose, estilo e melhorias
        </h2>

        <div>
          <p className="text-xs font-semibold text-text-secondary mb-2">MODELO</p>
          <div className="flex rounded-lg border border-dark-border p-0.5 w-fit mb-3">
            <button
              type="button"
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                gender === "women"
                  ? "bg-emerald-600 text-white"
                  : "text-text-secondary"
              }`}
              onClick={() => setGender("women")}
            >
              Mulheres
            </button>
            <button
              type="button"
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                gender === "men"
                  ? "bg-emerald-600 text-white"
                  : "text-text-secondary"
              }`}
              onClick={() => setGender("men")}
            >
              Homens
            </button>
          </div>

          {modelMode === "preset" ? (
            <div className="flex flex-wrap gap-3">
              {presets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setModelMode("preset");
                    setPresetId(p.id);
                  }}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-colors ${
                    presetId === p.id && modelMode === "preset"
                      ? "border-emerald-500 bg-emerald-600/10"
                      : "border-dark-border hover:border-emerald-600/30"
                  }`}
                >
                  <span className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-700/40 to-dark-bg border border-dark-border flex items-center justify-center text-sm font-bold text-emerald-300">
                    {p.name.slice(0, 1)}
                  </span>
                  <span className="text-[11px] text-text-secondary max-w-[72px] truncate">
                    {p.name}
                  </span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setModelMode("custom")}
                className="flex flex-col items-center gap-1 p-2 rounded-xl border border-emerald-600/60 bg-emerald-600/5 min-w-[100px]"
              >
                <User className="w-8 h-8 text-emerald-400 mt-2" />
                <span className="text-[11px] font-semibold text-emerald-400">
                  Criar do zero
                </span>
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-emerald-600/50 bg-dark-bg/80 p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-emerald-400">
                    Criar do zero
                  </p>
                  <p className="text-xs text-emerald-400/70">
                    Descreva como quer sua modelo
                  </p>
                </div>
                <button
                  type="button"
                  className="text-xs text-text-secondary underline"
                  onClick={() => setModelMode("preset")}
                >
                  Voltar aos presets
                </button>
              </div>
              <textarea
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
                placeholder='Ex.: Mulher brasileira, 25 anos, pele morena, cabelo cacheado castanho, olhos escuros, sorriso simpático, estilo moderno…'
                rows={4}
                className="w-full rounded-lg border border-emerald-600/40 bg-dark-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
              />
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold text-text-secondary mb-2">
            CENA / AMBIENTE
          </p>
          <p className="text-[11px] text-text-secondary/80 mb-2">
            Uma cena de cada vez (evita misturar &quot;casa&quot; com
            &quot;academia&quot; no prompt).
          </p>
          <div className="flex flex-wrap gap-2">
            {SCENE_CHIPS.map((c) => (
              <button
                key={c.id}
                type="button"
                className={
                  sceneIds.length === 1 && sceneIds[0] === c.id
                    ? chipOn
                    : chipOff
                }
                onClick={() => setSceneIds([c.id])}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <textarea
          value={sceneCustom}
          onChange={(e) => setSceneCustom(e.target.value)}
          placeholder="Cenário personalizado (opcional)"
          rows={2}
          className="w-full rounded-xl border border-dark-border bg-dark-bg py-2 px-3 text-sm text-text-primary"
        />

        <ChipGroup
          title="POSE"
          items={POSE_CHIPS}
          selected={poseIds}
          onToggle={(id) => setPoseIds(toggleId(poseIds, id))}
        />
        <textarea
          value={poseCustom}
          onChange={(e) => setPoseCustom(e.target.value)}
          placeholder="Pose personalizada (opcional)"
          rows={2}
          className="w-full rounded-xl border border-dark-border bg-dark-bg py-2 px-3 text-sm text-text-primary"
        />

        <ChipGroup
          title="ESTILO"
          items={STYLE_CHIPS}
          selected={styleIds}
          onToggle={(id) => setStyleIds(toggleId(styleIds, id))}
        />

        <ChipGroup
          title="MELHORIAS"
          items={IMPROVEMENT_CHIPS}
          selected={improvementIds}
          onToggle={(id) => setImprovementIds(toggleId(improvementIds, id))}
        />

        <div>
          <p className="text-xs font-semibold text-text-secondary mb-2">
            Motor de imagem
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setImageProvider("vertex")}
              className={imageProvider === "vertex" ? chipOn : chipOff}
            >
              Vertex · Imagen 4 Fast
            </button>
            <button
              type="button"
              onClick={() => setImageProvider("nano-banana")}
              className={imageProvider === "nano-banana" ? chipOn : chipOff}
            >
              Nano Banana (Gemini Image)
            </button>
          </div>
          <p className="text-[11px] text-text-secondary/80 mt-2 mb-3">
            O mesmo prompt completo (passos 1–3) é enviado nos dois. Com Nano Banana,
            a foto do produto também vai na API (referência visual + texto). Vertex
            usa só texto (Imagen não vê pixels). Com Nano Banana + foto, não é
            obrigatório usar “Analisar produto” antes — o modelo usa a imagem como
            referência do pack; notas no campo de descrição ainda ajudam. Os modelos
            Gemini Image normalmente exigem faturamento pago na API (não só tier
            gratuito).
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold text-text-secondary mb-2">
            Proporção da imagem
          </p>
          <div className="flex flex-wrap gap-2">
            {["9:16", "1:1", "4:3", "16:9"].map((ar) => (
              <button
                key={ar}
                type="button"
                onClick={() => setImageAspect(ar)}
                className={imageAspect === ar ? chipOn : chipOff}
              >
                {ar}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setAdvancedImageOpen((o) => !o)}
          className="flex items-center gap-2 text-sm text-text-secondary w-full justify-between py-2 border-t border-dark-border"
        >
          <span>Prompt avançado (imagem)</span>
          {advancedImageOpen ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
        {advancedImageOpen ? (
          <textarea
            value={advancedImagePrompt}
            onChange={(e) => setAdvancedImagePrompt(e.target.value)}
            rows={14}
            className="w-full rounded-xl border border-dark-border bg-dark-bg px-3 py-2 text-xs text-text-primary font-mono leading-relaxed"
          />
        ) : null}

        {genImgErr ? (
          <div className="flex items-start gap-2 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl p-3">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{genImgErr}</span>
          </div>
        ) : null}

        <button
          type="button"
          disabled={!canGenerateImage || genImgLoading}
          className={accentBtn + " w-full"}
          onClick={onGenerateImage}
        >
          {genImgLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ImageIcon className="h-4 w-4" />
          )}
          {imageProvider === "vertex"
            ? "Gerar imagem (~US$ 0,02 · Imagen 4 Fast)"
            : "Gerar imagem (Nano Banana · Gemini Image)"}
        </button>
        {!canGenerateImage ? (
          <p className="text-center text-xs text-text-secondary">
            Envie a foto do produto ou descreva o produto (15+ caracteres) e
            preencha a modelo.
          </p>
        ) : null}
      </section>

      {imageResult ? (
        <section className={`${card} space-y-4`}>
          <h2 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            Resultado — imagem
          </h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`data:${imageResult.mime};base64,${imageResult.base64}`}
            alt="Gerada"
            className="w-full max-w-md mx-auto rounded-xl border border-dark-border"
          />
          <button
            type="button"
            onClick={downloadImage}
            className="inline-flex items-center gap-2 text-sm text-emerald-400 hover:underline"
          >
            <Download className="h-4 w-4" />
            Descarregar PNG/JPEG
          </button>

          <div className="border-t border-dark-border pt-4 space-y-4">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <Video className="h-4 w-4 text-emerald-400" />
              Vídeo a partir desta imagem (Veo 3.1 Fast)
            </h3>
            <ChipGroup
              title="Movimento"
              items={VIDEO_MOTION_CHIPS}
              selected={motionIds}
              onToggle={(id) => setMotionIds(toggleId(motionIds, id))}
            />
            <textarea
              value={motionCustom}
              onChange={(e) => setMotionCustom(e.target.value)}
              placeholder="Movimento personalizado (opcional)"
              rows={2}
              className="w-full rounded-xl border border-dark-border bg-dark-bg py-2 px-3 text-sm"
            />
            <div className="flex flex-wrap gap-3 text-xs">
              <span className="text-text-secondary">Duração:</span>
              {([4, 6, 8] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  className={durationSec === d ? chipOn : chipOff}
                  onClick={() => setDurationSec(d)}
                >
                  {d}s
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 text-xs items-center">
              <span className="text-text-secondary">Formato:</span>
              <button
                type="button"
                className={videoAspect === "9:16" ? chipOn : chipOff}
                onClick={() => setVideoAspect("9:16")}
              >
                9:16
              </button>
              <button
                type="button"
                className={videoAspect === "16:9" ? chipOn : chipOff}
                onClick={() => setVideoAspect("16:9")}
              >
                16:9
              </button>
            </div>
            <div className="flex flex-wrap gap-3 text-xs items-center">
              <span className="text-text-secondary">Resolução:</span>
              <button
                type="button"
                className={videoRes === "720p" ? chipOn : chipOff}
                onClick={() => setVideoRes("720p")}
              >
                720p
              </button>
              <button
                type="button"
                className={videoRes === "1080p" ? chipOn : chipOff}
                onClick={() => setVideoRes("1080p")}
              >
                1080p
              </button>
            </div>
            <div className="rounded-xl border border-dark-border bg-dark-bg/40 p-3 space-y-2">
              <p className="text-xs font-semibold text-emerald-400 flex items-center gap-2">
                <Mic className="h-3.5 w-3.5" />
                Roteiro falado (opcional)
              </p>
              <p className="text-[11px] text-text-secondary">
                Se escrever abaixo, o Veo gera <strong>áudio</strong> e tenta
                sincronizar a boca (qualidade variável). Voz em português do
                Brasil.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={
                    videoVoiceGender === "female" ? chipOn : chipOff
                  }
                  onClick={() => setVideoVoiceGender("female")}
                >
                  Voz feminina
                </button>
                <button
                  type="button"
                  className={videoVoiceGender === "male" ? chipOn : chipOff}
                  onClick={() => setVideoVoiceGender("male")}
                >
                  Voz masculina
                </button>
              </div>
              <textarea
                value={videoVoiceScript}
                onChange={(e) => setVideoVoiceScript(e.target.value)}
                placeholder='Ex.: "Esse aqui é o Gluco Vital, eu uso todo dia depois do treino…"'
                rows={3}
                className="w-full rounded-lg border border-dark-border bg-dark-bg py-2 px-3 text-sm text-text-primary"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={generateAudio}
                onChange={(e) => setGenerateAudio(e.target.checked)}
                disabled={videoVoiceScript.trim().length > 0}
              />
              Áudio ambiente sem roteiro (só se o campo acima estiver vazio)
            </label>

            <button
              type="button"
              onClick={() => setAdvancedVideoOpen((o) => !o)}
              className="flex items-center gap-2 text-sm text-text-secondary w-full justify-between py-2"
            >
              <span>Prompt avançado (vídeo)</span>
              {advancedVideoOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
            {advancedVideoOpen ? (
              <textarea
                value={advancedVideoPrompt}
                onChange={(e) => setAdvancedVideoPrompt(e.target.value)}
                rows={8}
                className="w-full rounded-xl border border-dark-border bg-dark-bg px-3 py-2 text-xs font-mono"
              />
            ) : null}

            {veoErr ? (
              <div className="flex items-start gap-2 text-sm text-red-400 bg-red-400/10 rounded-xl p-3">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {veoErr}
              </div>
            ) : null}
            {veoProgress ? (
              <p className="text-xs text-text-secondary">{veoProgress}</p>
            ) : null}

            <button
              type="button"
              disabled={veoLoading}
              className={accentBtn + " w-full"}
              onClick={onGenerateVideo}
            >
              {veoLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Video className="h-4 w-4" />
              )}
              Gerar vídeo (~US$ 0,10/s · Veo 3.1 Fast)
            </button>
            <p className="text-xs text-text-secondary text-center">
              Custo indicativo: {durationSec}s × US$ 0,10 ≈ US$
              {(durationSec * 0.1).toFixed(2)} (consulte a tabela Google atual).
            </p>

            {videoDataUrl ? (
              <video
                src={videoDataUrl}
                controls
                className="w-full rounded-xl border border-dark-border mt-2"
              />
            ) : null}
            {videoGcsUri ? (
              <p className="text-xs text-amber-400 break-all">
                O vídeo foi gravado no bucket: {videoGcsUri}. Configure saída
                base64 ou um bucket acessível para pré-visualizar aqui.
              </p>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ChipGroup(props: {
  title: string;
  items: { id: string; label: string }[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-text-secondary mb-2">
        {props.title}
      </p>
      <div className="flex flex-wrap gap-2">
        {props.items.map((c) => (
          <button
            key={c.id}
            type="button"
            className={props.selected.includes(c.id) ? chipOn : chipOff}
            onClick={() => props.onToggle(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function GeradorEspecialistaPage() {
  return (
    <ProFeatureGate feature="geradorCriativos">
      <ExpertGeneratorInner />
    </ProFeatureGate>
  );
}
