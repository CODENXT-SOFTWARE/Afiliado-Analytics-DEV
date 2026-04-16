"use client";

import { useCallback, useEffect, useState } from "react";

type Props = {
  inviteCode: string | null;
  universalLink: string;
  logoUrl: string | null;
  buttonColor: string;
};

export default function CaptureGoWhatsAppClient({
  inviteCode,
  universalLink,
  logoUrl,
  buttonColor,
}: Props) {
  const link = typeof universalLink === "string" ? universalLink : "";
  const color = typeof buttonColor === "string" && buttonColor.trim() ? buttonColor.trim() : "#90ee90";
  const logo = typeof logoUrl === "string" && logoUrl.trim() ? logoUrl.trim() : null;
  const code = inviteCode != null && String(inviteCode).trim() ? String(inviteCode).trim() : null;

  const canDeepLink = Boolean(code);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!canDeepLink || !code) return;
    try {
      const id = window.setTimeout(() => {
        window.location.href = `whatsapp://chat/?code=${code}`;
      }, 0);
      return () => window.clearTimeout(id);
    } catch {
      return undefined;
    }
  }, [canDeepLink, code]);

  useEffect(() => {
    if (!link.trim()) return;
    const t = window.setTimeout(() => {
      window.location.replace(link);
    }, 18000);
    return () => window.clearTimeout(t);
  }, [link]);

  const enterGroup = useCallback(() => {
    if (!link.trim()) {
      setToast("Grupo indisponível no momento.");
      return;
    }
    if (canDeepLink && code) {
      window.location.href = `whatsapp://chat/?code=${code}`;
      window.setTimeout(() => {
        window.location.href = link;
      }, 500);
    } else {
      window.location.href = link;
    }
  }, [canDeepLink, code, link]);

  const copyLink = useCallback(async () => {
    if (!link.trim()) {
      setToast("Link indisponível.");
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      setToast("Link copiado!");
    } catch {
      setToast("Não foi possível copiar automaticamente.");
    }
  }, [link]);

  return (
    <main className="flex min-h-[100dvh] w-full flex-col items-center justify-center bg-zinc-100 px-4 py-10 text-center text-zinc-800">
      <div className="w-full max-w-[400px] space-y-6 px-1">
        <header className="flex justify-center">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- URL de Storage pode ser outro host Supabase
            <img
              src={logo}
              alt=""
              width={200}
              height={200}
              className="h-[200px] w-[200px] cursor-pointer rounded-full bg-[rgba(3,30,13,0.05)] object-contain p-2"
              onClick={enterGroup}
            />
          ) : (
            <div className="h-[200px] w-[200px] rounded-full bg-zinc-200/80" aria-hidden />
          )}
        </header>

        <h1 className="text-lg font-semibold leading-snug text-zinc-800">
          Após clicar no botão abaixo, clique na opção &quot;CONTINUAR&quot;
        </h1>

        <div className="flex flex-col gap-3.5">
          <button
            type="button"
            className="w-full rounded-lg px-4 py-4 text-lg font-semibold text-black shadow-sm transition hover:opacity-95 active:scale-[0.99]"
            style={{ backgroundColor: color }}
            onClick={enterGroup}
          >
            Entrar no grupo
          </button>

          <button
            type="button"
            className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-4 py-4 text-lg font-semibold text-zinc-800 transition hover:bg-zinc-200/80 active:scale-[0.99]"
            onClick={copyLink}
          >
            Copiar o link
          </button>

          <p className="text-left text-xs leading-relaxed text-zinc-600">
            Se não conseguir abrir, copie o link e cole em uma conversa.
          </p>
        </div>
      </div>

      {toast ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Mensagem"
        >
          <div className="w-full max-w-sm rounded-xl border border-zinc-700 bg-zinc-800 p-5 shadow-2xl">
            <p className="mb-4 text-left text-sm leading-relaxed text-zinc-100">{toast}</p>
            <button
              type="button"
              className="w-full rounded-lg bg-[#EE4D2D] py-2.5 text-sm font-semibold text-white hover:opacity-95"
              onClick={() => setToast(null)}
            >
              OK
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
