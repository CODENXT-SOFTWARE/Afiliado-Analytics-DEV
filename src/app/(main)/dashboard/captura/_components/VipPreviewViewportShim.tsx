"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/** Largura de referência tipo telemóvel; `vw` nos templates VIP escala em função disto após o zoom. */
const SIMULATED_MOBILE_WIDTH_PX = 390;

type Props = {
  /** Quando falso, só o scroll normal (dashboard em desktop). */
  enabled: boolean;
  children: ReactNode;
  /** Toasts do preview: mesmo zoom que a página (senão ficam gigantes em viewport estreita). */
  overlay?: ReactNode;
};

/**
 * No dashboard em viewport estreita, o preview VIP fica num retângulo pequeno mas o CSS usa `vw`
 * relativamente à janela — texto e toasts ficam desproporcionados. Encolhemos o subtree como se fosse
 * uma página de ~390px de largura a caber no recorte (`zoom` + ResizeObserver).
 */
export default function VipPreviewViewportShim({ enabled, children, overlay }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [cw, setCw] = useState(SIMULATED_MOBILE_WIDTH_PX);

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
      <div className="relative h-full min-h-0 overflow-y-auto overflow-x-hidden scrollbar-none">
        {children}
        {overlay ?? null}
      </div>
    );
  }

  const zoom = Math.min(1, cw / SIMULATED_MOBILE_WIDTH_PX);
  const zoomStyle: CSSProperties = {
    width: SIMULATED_MOBILE_WIDTH_PX,
    zoom,
  };

  return (
    <div
      ref={hostRef}
      className="flex h-full min-h-0 w-full justify-center overflow-y-auto overflow-x-hidden scrollbar-none"
    >
      <div className="relative shrink-0" style={zoomStyle}>
        {children}
        {overlay ?? null}
      </div>
    </div>
  );
}
