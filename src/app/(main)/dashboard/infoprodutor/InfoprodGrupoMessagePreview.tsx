"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Package } from "lucide-react";

function parseBRLInput(s: string): number | null {
  const t = s.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function formatBRLPreview(value: number | null): string {
  if (value == null || value <= 0) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(value);
}

export type InfoprodGrupoMessagePreviewProps = {
  title: string;
  description: string;
  imageSrc: string;
  priceStr: string;
  priceOldStr: string;
  /** Manual: link real. MP: texto placeholder quando ainda não há URL. */
  linkHint: string;
  isMercadoPago: boolean;
};

/**
 * Prévia estilo mensagem de grupo — atualiza conforme o formulário.
 */
export default function InfoprodGrupoMessagePreview({
  title,
  description,
  imageSrc,
  priceStr,
  priceOldStr,
  linkHint,
  isMercadoPago,
}: InfoprodGrupoMessagePreviewProps) {
  const price = parseBRLInput(priceStr);
  const priceOld = parseBRLInput(priceOldStr);
  const displayTitle = title.trim() || "Título do produto";
  const rawDesc = description.trim();
  const hasDiscount =
    price != null &&
    price > 0 &&
    priceOld != null &&
    priceOld > 0 &&
    priceOld > price;
  const pct =
    hasDiscount && priceOld != null && price != null
      ? Math.round((1 - price / priceOld) * 100)
      : null;

  const linkDisplay =
    linkHint.trim() ||
    (isMercadoPago
      ? "Seu link de checkout será gerado ao salvar o produto."
      : "Cole o link de venda no formulário.");

  return (
    <div className="rounded-xl border border-[#2c2c32] bg-[#27272a] overflow-hidden">
      <div className="px-3 py-2.5">
        <p className="text-[9px] font-bold uppercase tracking-wider text-[#9a9aa2] mb-2">
          Prévia no grupo
        </p>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <motion.span
              className="inline-block shrink-0 will-change-transform"
              animate={{ y: [0, -5, 0] }}
              transition={{
                duration: 2.4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <Image
                src="/tendencias/cabecasho.png"
                alt=""
                width={36}
                height={36}
                className="h-9 w-auto object-contain"
              />
            </motion.span>
            <span className="text-[13px] font-bold text-[#EE4D2D] tracking-tight">
              SUA AUTOMAÇÃO
            </span>
          </div>

          <div className="overflow-hidden rounded-none border border-[#2c2c32] bg-[#222228] text-[#f0f0f2] text-[12px] leading-snug">
            <div className="relative aspect-[4/3] w-full">
              {imageSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageSrc}
                  alt=""
                  className="h-full w-full object-cover rounded-none border-0 bg-transparent"
                />
              ) : (
                <div className="flex min-h-[100px] w-full flex-col items-center justify-center gap-1 text-[#9a9aa2] bg-transparent">
                  <Package className="h-8 w-8 opacity-50" />
                  <span className="text-[10px]">Envie uma foto</span>
                </div>
              )}
            </div>
            <div className="px-2.5 py-2 space-y-1.5 border-t border-[#2c2c32]">
              <p className="text-[11px] font-bold text-center text-[#f0f0f2]">
                🔥 OFERTA EM DESTAQUE 🔥
              </p>
              <p className="text-[11px] whitespace-pre-wrap break-words">{displayTitle}</p>
              {rawDesc ? (
                <p className="text-[10px] text-[#d8d8d8] whitespace-pre-wrap break-words">
                  📌 {rawDesc}
                </p>
              ) : (
                <p className="text-[10px] text-[#9a9aa2] italic">
                  Adicione uma descrição opcional no formulário.
                </p>
              )}
              {hasDiscount && pct != null && pct > 0 ? (
                <p className="text-[10px]">
                  💰 Aproveite: {pct}% de <em>desconto</em>!
                </p>
              ) : null}
              <div className="text-[10px] space-y-0.5 pt-0.5 border-t border-[#3e3e46]">
                {priceOld != null && priceOld > 0 ? (
                  <p className="text-[#9a9aa2]">
                    🔴 De:{" "}
                    <span className="line-through">{formatBRLPreview(priceOld)}</span>
                  </p>
                ) : null}
                {price != null && price > 0 ? (
                  <p>
                    🔥 Por: <strong className="text-[#f0f0f2]">{formatBRLPreview(price)}</strong>
                  </p>
                ) : (
                  <p className="text-[#9a9aa2]">💰 Defina o preço no formulário</p>
                )}
              </div>
              <p className="text-[10px] pt-1 font-medium text-[#f0f0f2]">
                🏷️ Promoção — clique no link 👇
              </p>
              <p className="text-[10px] text-[#EE4D2D] break-all underline underline-offset-2">
                {linkDisplay}
              </p>
            </div>
            <div className="flex justify-end px-2 pb-1.5 pt-0 border-t border-[#2c2c32]">
              <span className="text-[9px] text-[#9a9aa2] tabular-nums">
                {new Date().toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
