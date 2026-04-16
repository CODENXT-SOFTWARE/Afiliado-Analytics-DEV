"use client";

import React from "react";

/** Chart.js só no layout do dashboard — evita carregar/registar Chart em páginas públicas (captura /go, etc.). */
export function Providers({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
