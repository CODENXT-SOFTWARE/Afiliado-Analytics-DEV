"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

type Props = {
  /** Largura de referência em px — o conteúdo renderiza nesse tamanho e é escalado via CSS `zoom`. */
  referenceWidth: number;
  /** Quando false, o conteúdo renderiza sem escalonamento (fica responsivo ao container). */
  enabled?: boolean;
  children: ReactNode;
};

/**
 * Escala o filho pra caber na largura do container, mantendo proporções de `vw/px` do conteúdo.
 * Usa CSS `zoom` + ResizeObserver — reativo a mudanças de largura do wrapper.
 *
 * Uso: wrap de uma preview que foi desenhada pra uma largura específica (ex.: 390px mobile, 1024px desktop)
 * dentro de um container arbitrário menor/maior.
 */
export default function PreviewViewportShim({ referenceWidth, enabled = true, children }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [cw, setCw] = useState(referenceWidth);

  useEffect(() => {
    if (!enabled) return;
    const el = hostRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setCw(Math.max(32, Math.round(el.clientWidth)));
    });
    ro.observe(el);
    setCw(Math.max(32, Math.round(el.clientWidth)));
    return () => ro.disconnect();
  }, [enabled]);

  if (!enabled) {
    return (
      <div
        className="preview-shim-scroll h-full w-full overflow-x-hidden"
        style={{ overflowY: "auto", scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        <style jsx>{`
          .preview-shim-scroll::-webkit-scrollbar { display: none; }
        `}</style>
        {children}
      </div>
    );
  }

  const zoom = Math.min(1, cw / referenceWidth);
  const zoomStyle: CSSProperties = {
    width: referenceWidth,
    zoom,
  };

  return (
    <div
      ref={hostRef}
      className="preview-shim-scroll flex h-full min-h-0 w-full justify-center overflow-x-hidden"
      style={{
        overflowY: "auto",
        // Impede que o scrollbar aparecendo/sumindo mude a largura do container —
        // isso era o que causava o flicker no mobile quando a footer image carregava.
        scrollbarWidth: "none",
        msOverflowStyle: "none",
      }}
    >
      <style jsx>{`
        .preview-shim-scroll::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      <div className="relative shrink-0" style={zoomStyle}>
        {children}
      </div>
    </div>
  );
}
