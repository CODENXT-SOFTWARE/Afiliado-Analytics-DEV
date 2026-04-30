"use client";

/**
 * Card "Ativar Notificação" da página /configuracoes (Minha Conta).
 *
 * Reúne em um só lugar:
 *   - Botão pra instalar o PWA (mesmo flow do menu flutuante).
 *   - Botão pra ativar (ou desativar) notificações push, com status atual.
 *   - Botão de teste, visível apenas quando push já está ativo.
 *
 * Segue o padrão visual dos outros cards desta página: header escuro com
 * borda, corpo com `space-y-4`, botão primário em `shopee-orange`.
 */

import { useEffect, useState } from "react";
import {
  Bell,
  BellOff,
  CheckCircle2,
  Download,
  Send,
  Smartphone,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import {
  detectPushSupport,
  ensureSubscribed,
  requestPermissionAndSubscribe,
  unsubscribeFromPush,
} from "@/lib/push/client";
import { runPwaInstallFlow, type PwaInstallFlowResult } from "@/lib/pwa-install-flow";
import PwaInstallHintModal from "@/app/components/PwaInstallHintModal";

type PermissionState = "default" | "granted" | "denied" | "unsupported";

function readPermission(): PermissionState {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return "unsupported";
  }
  if (detectPushSupport() !== "supported") return "unsupported";
  return Notification.permission as PermissionState;
}

function readStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

export default function NotificacoesCard() {
  const [permission, setPermission] = useState<PermissionState>("default");
  const [standalone, setStandalone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [installHint, setInstallHint] = useState<PwaInstallFlowResult | null>(null);

  useEffect(() => {
    setPermission(readPermission());
    setStandalone(readStandalone());

    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(display-mode: standalone)");
    const onChange = () => setStandalone(readStandalone());
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  // Quando a permissão já é "granted", garante a subscription no servidor
  // (idempotente). Cobre o caso de o usuário ter aceito antes do login.
  useEffect(() => {
    if (permission === "granted") {
      ensureSubscribed().catch(() => {});
    }
  }, [permission]);

  const isUnsupported = permission === "unsupported";
  const isGranted = permission === "granted";
  const isDenied = permission === "denied";

  const onInstall = async () => {
    const result = await runPwaInstallFlow();
    if (result === "standalone") {
      setStandalone(true);
      setFeedback({ kind: "ok", text: "App já instalado neste dispositivo." });
      return;
    }
    if (result === "browser") {
      setInstallHint("browser");
      return;
    }
    // Após o prompt nativo, refresca o estado.
    setTimeout(() => setStandalone(readStandalone()), 800);
  };

  const onEnable = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const result = await requestPermissionAndSubscribe();
      setPermission(result as PermissionState);
      if (result === "granted") {
        setFeedback({ kind: "ok", text: "Notificações ativadas com sucesso." });
      } else if (result === "denied") {
        setFeedback({
          kind: "error",
          text: "Permissão negada pelo navegador. Libere nas configurações do site para reativar.",
        });
      } else {
        setFeedback({ kind: "error", text: "Permissão não concedida." });
      }
    } catch (err) {
      setFeedback({
        kind: "error",
        text: err instanceof Error ? err.message : "Falha ao ativar notificações.",
      });
    } finally {
      setBusy(false);
    }
  };

  const onDisable = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const ok = await unsubscribeFromPush();
      if (ok) {
        setPermission(readPermission());
        setFeedback({ kind: "ok", text: "Notificações desativadas neste dispositivo." });
      } else {
        setFeedback({ kind: "error", text: "Não foi possível desativar agora." });
      }
    } finally {
      setBusy(false);
    }
  };

  const onTest = async () => {
    setTesting(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json?.error ?? "Falha ao enviar teste");
      }
      setFeedback({
        kind: "ok",
        text: "Teste enviado. Verifique a bandeja em alguns segundos.",
      });
    } catch (err) {
      setFeedback({
        kind: "error",
        text: err instanceof Error ? err.message : "Falha ao enviar teste.",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <>
      <section className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
        <div className="bg-dark-bg/40 border-b border-dark-border px-5 py-4 flex items-center justify-between gap-3">
          <h2 className="text-base sm:text-lg font-semibold text-text-primary font-heading">
            Ativar notificação
          </h2>

          <span
            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
              isGranted
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : isDenied
                  ? "border-red-500/30 bg-red-500/10 text-red-300"
                  : "border-dark-border bg-dark-bg text-text-secondary"
            }`}
          >
            {isGranted ? (
              <>
                <CheckCircle2 className="h-3 w-3" /> Ativadas
              </>
            ) : isDenied ? (
              <>
                <XCircle className="h-3 w-3" /> Bloqueadas
              </>
            ) : isUnsupported ? (
              <>
                <AlertTriangle className="h-3 w-3" /> Indisponível
              </>
            ) : (
              <>
                <Bell className="h-3 w-3" /> Inativas
              </>
            )}
          </span>
        </div>

        <div className="px-5 py-5 space-y-4">
          

          {isUnsupported && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <AlertTriangle className="h-4 w-4 text-amber-300 mt-0.5 shrink-0" />
              <div className="text-xs text-amber-100/90">
                Seu navegador atual não oferece suporte a Web Push. No iPhone, é
                preciso adicionar o app à tela inicial e usar o iOS 16.4 ou
                superior.
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {/* Baixar o app (PWA) */}
            <button
              type="button"
              onClick={onInstall}
              className="group flex items-start gap-3 rounded-xl border border-dark-border bg-dark-bg/60 p-4 text-left transition-all hover:border-shopee-orange/50 hover:bg-dark-bg"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-dark-bg text-shopee-orange transition-colors group-hover:bg-shopee-orange/15">
                {standalone ? (
                  <Smartphone className="h-5 w-5" />
                ) : (
                  <Download className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-text-primary">
                  {standalone ? "App já instalado" : "Baixar o app"}
                </p>
                <p className="mt-0.5 text-xs text-text-secondary">
                  {standalone
                    ? "Você está usando a versão instalada."
                    : "Adicione à tela inicial pra receber pushes nativos."}
                </p>
              </div>
            </button>

            {/* Ativar / desativar notificações */}
            {isGranted ? (
              <button
                type="button"
                onClick={onDisable}
                disabled={busy}
                className="group flex items-start gap-3 rounded-xl border border-dark-border bg-dark-bg/60 p-4 text-left transition-all hover:border-red-500/40 hover:bg-dark-bg disabled:opacity-60"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-dark-bg text-text-secondary transition-colors group-hover:bg-red-500/15 group-hover:text-red-300">
                  <BellOff className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-text-primary">
                    {busy ? "Desativando..." : "Desativar notificações"}
                  </p>
                  <p className="mt-0.5 text-xs text-text-secondary">
                    Para neste dispositivo. Você pode reativar a qualquer momento.
                  </p>
                </div>
              </button>
            ) : (
              <button
                type="button"
                onClick={onEnable}
                disabled={busy || isUnsupported || isDenied}
                className="group flex items-start gap-3 rounded-xl border border-dark-border bg-dark-bg/60 p-4 text-left transition-all hover:border-shopee-orange/50 hover:bg-dark-bg disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-dark-border disabled:hover:bg-dark-bg/60"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-dark-bg text-shopee-orange transition-colors group-hover:bg-shopee-orange/15">
                  <Bell className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-text-primary">
                    {busy
                      ? "Ativando..."
                      : isDenied
                        ? "Permissão bloqueada"
                        : "Ativar notificações"}
                  </p>
                  <p className="mt-0.5 text-xs text-text-secondary">
                    {isDenied
                      ? "Libere a permissão nas configurações do navegador."
                      : "Receba avisos do Afiliado Analytics na tela inicial."}
                  </p>
                </div>
              </button>
            )}
          </div>

          {isGranted && (
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={onTest}
                disabled={testing}
                className="inline-flex items-center gap-2 rounded-md bg-shopee-orange px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                <Send className="h-4 w-4" />
                {testing ? "Enviando teste..." : "Enviar notificação de teste"}
              </button>
              <span className="text-xs text-text-secondary/80">
                Útil pra confirmar que a tela inicial está recebendo.
              </span>
            </div>
          )}

          {feedback && (
            <div
              className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs ${
                feedback.kind === "ok"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                  : "border-red-500/30 bg-red-500/10 text-red-200"
              }`}
            >
              {feedback.kind === "ok" ? (
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              )}
              <span>{feedback.text}</span>
            </div>
          )}

         
        </div>
      </section>

      <PwaInstallHintModal
        hint={installHint === "standalone" || installHint === "browser" ? installHint : null}
        onClose={() => setInstallHint(null)}
      />
    </>
  );
}
