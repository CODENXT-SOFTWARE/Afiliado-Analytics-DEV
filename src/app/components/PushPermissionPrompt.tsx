"use client";

/**
 * Card flutuante (canto inferior esquerdo, fora da área dos FABs de
 * suporte/instalação) que aparece pra usuários logados que ainda não
 * decidiram sobre notificações. Clicar em "Ativar" pede permissão via
 * gesto do usuário e registra a subscription no servidor.
 *
 * Não aparece se:
 *   - O usuário não está logado.
 *   - O navegador não suporta Push API.
 *   - Permissão já é "granted" ou "denied".
 *   - O usuário fechou o card há menos de 7 dias.
 */

import { useEffect, useState } from "react";
import Image from "next/image";
import { Bell, X } from "lucide-react";
import { useSupabase } from "@/app/components/auth/AuthProvider";
import {
  detectPushSupport,
  dismissPermissionPrompt,
  requestPermissionAndSubscribe,
  shouldShowPermissionPrompt,
} from "@/lib/push/client";

export default function PushPermissionPrompt() {
  const { session } = useSupabase();
  const isLogged = !!session?.user;
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isLogged) {
      setVisible(false);
      return;
    }
    if (detectPushSupport() !== "supported") {
      setVisible(false);
      return;
    }
    // Pequeno delay pra evitar flash assim que a página carrega.
    const t = window.setTimeout(() => {
      setVisible(shouldShowPermissionPrompt());
    }, 1500);
    return () => window.clearTimeout(t);
  }, [isLogged]);

  if (!visible) return null;

  const close = () => {
    dismissPermissionPrompt();
    setVisible(false);
  };

  const onEnable = async () => {
    setBusy(true);
    try {
      const result = await requestPermissionAndSubscribe();
      if (result === "granted") {
        setVisible(false);
      } else if (result === "denied") {
        dismissPermissionPrompt();
        setVisible(false);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-label="Ativar notificações"
      className="fixed bottom-6 left-6 z-[60] hidden w-[min(92vw,360px)] sm:block"
      style={{ animation: "aaPushPromptIn 0.35s ease-out both" }}
    >
      <style>{`
        @keyframes aaPushPromptIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="overflow-hidden rounded-2xl border border-white/12 bg-zinc-900/95 text-white shadow-[0_18px_48px_rgba(0,0,0,0.55)] backdrop-blur-md">
        <div className="flex items-start gap-3 p-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#e24c30] to-[#ff6b35] shadow-[0_8px_24px_rgba(226,76,48,0.45)]">
            <Image
              src="/pwa-icon-192.png"
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 object-contain"
              unoptimized
              priority
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[14px] font-bold tracking-tight">
                Ativar notificações
              </p>
              <button
                type="button"
                onClick={close}
                aria-label="Fechar"
                className="ml-2 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-white/55 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
            <p className="mt-1 text-[12px] leading-snug text-white/70">
              Avisos de comissões, vendas no Mercado Pago e tendências —
              direto na sua tela inicial.
            </p>

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={onEnable}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-[#e24c30] to-[#ff6b35] px-3 py-1.5 text-[12px] font-bold tracking-tight text-white shadow-[0_4px_14px_rgba(226,76,48,0.45)] transition-all hover:shadow-[0_6px_18px_rgba(226,76,48,0.55)] active:scale-[0.98] disabled:opacity-60"
              >
                <Bell className="h-3.5 w-3.5" aria-hidden />
                {busy ? "Ativando..." : "Ativar"}
              </button>
              <button
                type="button"
                onClick={close}
                className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-white/65 transition-colors hover:bg-white/8 hover:text-white"
              >
                Agora não
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
