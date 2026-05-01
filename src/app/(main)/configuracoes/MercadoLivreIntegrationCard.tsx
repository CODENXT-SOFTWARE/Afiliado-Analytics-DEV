"use client";

import { useState, useEffect } from "react";
import { Tag, KeyRound, ExternalLink, ChevronDown, IdCard, Trash2 } from "lucide-react";
import {
  ML_EXT_AFFILIATE_TAG_LS_KEY,
  ML_EXT_SESSION_LS_KEY,
} from "@/lib/mercadolivre/ml-session-cookie";
import { dispatchMlAffiliateSettingsChanged } from "@/lib/mercadolivre/use-ml-affiliate-local-settings";
import Toolist from "@/app/components/ui/Toolist";

/** Afiliado Analytics na Chrome Web Store (token ML no navegador). */
const AFILIADO_ANALYTICS_CHROME_WEB_STORE_URL =
  "https://chromewebstore.google.com/detail/afiliado-analytics/ogfmdnpbcglgppaakmiemaohgofailal";

type MercadoLivreIntegrationCardProps = {
  initialClientId?: string;
  initialHasSecret?: boolean;
  initialSecretLast4?: string | null;
};

export default function MercadoLivreIntegrationCard({
  initialClientId = "",
  initialHasSecret = false,
  initialSecretLast4 = null,
}: MercadoLivreIntegrationCardProps) {
  const [affiliateTag, setAffiliateTag] = useState("");
  const [sessionToken, setSessionToken] = useState("");

  useEffect(() => {
    try {
      setAffiliateTag(localStorage.getItem(ML_EXT_AFFILIATE_TAG_LS_KEY) ?? "");
      setSessionToken(localStorage.getItem(ML_EXT_SESSION_LS_KEY) ?? "");
    } catch {
      /* ignore */
    }
  }, []);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const [apiOpen, setApiOpen] = useState(false);
  const [mlClientId, setMlClientId] = useState(initialClientId);
  const [mlClientSecret, setMlClientSecret] = useState("");
  const [mlHasSecret, setMlHasSecret] = useState(initialHasSecret);
  const [mlSecretLast4, setMlSecretLast4] = useState<string | null>(initialSecretLast4);
  const [savingApi, setSavingApi] = useState(false);
  const [removingApi, setRemovingApi] = useState(false);
  const [confirmRemoveApi, setConfirmRemoveApi] = useState(false);
  const [errorApi, setErrorApi] = useState<string | null>(null);
  const [okApi, setOkApi] = useState(false);

  const hasMlApiIntegration = !!mlClientId.trim() || mlHasSecret;

  const onSave = () => {
    setError(null);
    setOk(false);
    const tag = affiliateTag.trim();
    const tok = sessionToken.trim();
    if (!tag) {
      setError("Informe a etiqueta em uso (obrigatória).");
      return;
    }
    if (!tok) {
      setError("Informe o token de sessão da extensão (obrigatório).");
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(tag)) {
      setError("Etiqueta inválida: use só letras, números, _ ou -.");
      return;
    }
    setSaving(true);
    try {
      localStorage.setItem(ML_EXT_AFFILIATE_TAG_LS_KEY, tag);
      localStorage.setItem(ML_EXT_SESSION_LS_KEY, tok);
      dispatchMlAffiliateSettingsChanged();
      setOk(true);
    } catch {
      setError("Não foi possível salvar no navegador.");
    } finally {
      setSaving(false);
    }
  };

  const refreshMlApiStatus = async () => {
    const status = await fetch("/api/settings/mercadolivre-api").then((r) => r.json());
    if (status?.mercadolivre_client_id != null) setMlClientId(String(status.mercadolivre_client_id));
    setMlHasSecret(!!status?.has_secret);
    setMlSecretLast4(status?.last4 ?? null);
  };

  const onSaveApi = async () => {
    setSavingApi(true);
    setErrorApi(null);
    setOkApi(false);
    try {
      const res = await fetch("/api/settings/mercadolivre-api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mercadolivre_client_id: mlClientId.trim(),
          mercadolivre_client_secret: mlClientSecret.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao salvar");
      setMlClientSecret("");
      await refreshMlApiStatus();
      setOkApi(true);
    } catch (e) {
      setErrorApi(e instanceof Error ? e.message : "Erro");
    } finally {
      setSavingApi(false);
    }
  };

  const onRemoveApi = async () => {
    setRemovingApi(true);
    setErrorApi(null);
    try {
      const res = await fetch("/api/settings/mercadolivre-api", { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao remover");
      setMlClientId("");
      setMlClientSecret("");
      setMlHasSecret(false);
      setMlSecretLast4(null);
      setConfirmRemoveApi(false);
      setOkApi(false);
    } catch (e) {
      setErrorApi(e instanceof Error ? e.message : "Erro");
    } finally {
      setRemovingApi(false);
    }
  };

  return (
    <section className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
      <div className="bg-dark-bg/40 border-b border-dark-border px-5 py-4">
        <h2 className="text-base sm:text-lg font-semibold text-text-primary font-heading">
          Mercado Livre — Afiliados
        </h2>
   
      </div>

      <div className="px-5 py-5 space-y-4">
        <div>
          <label className="flex items-center gap-2 text-sm font-semibold text-text-secondary">
            <Tag className="h-4 w-4 text-shopee-orange" />
            Etiqueta em uso 
          </label>
          <input
            value={affiliateTag}
            onChange={(e) => {
              setAffiliateTag(e.target.value);
              setOk(false);
            }}
            placeholder="cake9265169"
            autoComplete="off"
            spellCheck={false}
            className="mt-2 w-full rounded-md border border-dark-border bg-dark-bg py-2 px-3 text-text-primary placeholder-text-secondary/60 focus:border-shopee-orange focus:outline-none focus:ring-1 focus:ring-shopee-orange sm:text-sm"
          />
          <p className="text-[11px] text-text-secondary mt-1">Seu nome afiliado do ML</p>
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <label
              htmlFor="ml-config-ext-session-token"
              className="flex items-center gap-2 text-sm font-semibold text-text-secondary"
            >
              <KeyRound className="h-4 w-4 text-shopee-orange" />
              Token da extensão
            </label>
            <Toolist
              variant="floating"
              wide
              text="Abra a extensão no Mercado Livre e copie o token. Obrigatório para o servidor simular sua sessão de afiliado no Mercado Livre."
            />
          </div>
          <input
            id="ml-config-ext-session-token"
            type="password"
            value={sessionToken}
            onChange={(e) => {
              setSessionToken(e.target.value);
              setOk(false);
            }}
            placeholder="c3NpZD0… ou ssid=…"
            autoComplete="off"
            spellCheck={false}
            className="mt-2 w-full rounded-md border border-dark-border bg-dark-bg py-2 px-3 text-text-primary placeholder-text-secondary/60 focus:border-shopee-orange focus:outline-none focus:ring-1 focus:ring-shopee-orange sm:text-sm"
          />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center justify-center rounded-md px-5 py-2 text-sm font-semibold
             text-white bg-shopee-orange cursor-pointer hover:opacity-90 disabled:opacity-60 transition-opacity"
          >
            {saving ? "Salvando…" : "Salvar"}
          </button>
          {ok && <span className="text-sm text-green-400 cursor-pointer">Salvo no navegador.</span>}
          {error && <span className="text-sm text-red-400 cursor-pointer">{error}</span>}
        </div>

        <div className="rounded-lg border border-dark-border bg-dark-bg/50 overflow-hidden">
          <button
            type="button"
            onClick={() => {
              setApiOpen((o) => !o);
              setErrorApi(null);
            }}
            className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-semibold text-text-primary hover:bg-dark-bg/80 transition-colors"
            aria-expanded={apiOpen}
          >
            <span>API Mercado Livre (opcional)</span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-text-secondary transition-transform ${apiOpen ? "rotate-180" : ""}`}
            />
          </button>

          {apiOpen ? (
            <div className="px-4 pb-4 pt-0 space-y-4 border-t border-dark-border/70">
        

              {hasMlApiIntegration && !confirmRemoveApi ? (
                <button
                  type="button"
                  onClick={() => setConfirmRemoveApi(true)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-red-400 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remover credenciais da API
                </button>
              ) : null}

              {confirmRemoveApi ? (
                <div className="flex flex-wrap items-center gap-2 rounded-md border border-red-500/30 bg-red-500/5 p-3">
                  <p className="text-xs text-text-secondary flex-1 min-w-[200px]">
                    Apagar ID do aplicativo e chave secreta do servidor?
                  </p>
                  <button
                    type="button"
                    onClick={() => setConfirmRemoveApi(false)}
                    className="rounded-md px-3 py-1.5 text-xs font-semibold text-text-secondary hover:bg-dark-bg"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => void onRemoveApi()}
                    disabled={removingApi}
                    className="rounded-md px-3 py-1.5 text-xs font-semibold bg-red-500/20 text-red-300 hover:bg-red-500/30 disabled:opacity-60"
                  >
                    {removingApi ? "Removendo…" : "Remover"}
                  </button>
                </div>
              ) : null}

              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-text-secondary">
                  <IdCard className="h-4 w-4 text-shopee-orange" />
                  ID do aplicativo
                </label>
                <input
                  value={mlClientId}
                  onChange={(e) => {
                    setMlClientId(e.target.value);
                    setOkApi(false);
                  }}
                  placeholder="5144260800592888"
                  autoComplete="off"
                  spellCheck={false}
                  className="mt-2 w-full rounded-md border border-dark-border bg-dark-bg py-2 px-3 text-text-primary placeholder-text-secondary/60 focus:border-shopee-orange focus:outline-none focus:ring-1 focus:ring-shopee-orange sm:text-sm"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-text-secondary">
                  <KeyRound className="h-4 w-4 text-shopee-orange" />
                  Chave secreta (Client Secret)
                </label>
                <input
                  type="password"
                  value={mlClientSecret}
                  onChange={(e) => {
                    setMlClientSecret(e.target.value);
                    setOkApi(false);
                  }}
                  placeholder={mlHasSecret ? "Deixe em branco para manter a atual" : "••••••••"}
                  autoComplete="off"
                  spellCheck={false}
                  className="mt-2 w-full rounded-md border border-dark-border bg-dark-bg py-2 px-3 text-text-primary placeholder-text-secondary/60 focus:border-shopee-orange focus:outline-none focus:ring-1 focus:ring-shopee-orange sm:text-sm"
                />
                {mlHasSecret && mlSecretLast4 ? (
                  <p className="text-[11px] text-text-secondary mt-1">
                    Chave salva no servidor (termina em <span className="text-shopee-orange/90">…{mlSecretLast4}</span>
                    ).
                  </p>
                ) : (
                  <p className="text-[11px] text-text-secondary mt-1">
                    Por favor, para gerar sua API KEY, acesse: <a href="https://www.mercadolivre.com.br/afiliados/linkbuilder#hub" target="_blank" rel="noopener noreferrer" className="text-shopee-orange hover:underline">Dev Center ML</a>
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => void onSaveApi()}
                  disabled={savingApi}
                  className="inline-flex items-center justify-center rounded-md px-5 py-2 text-sm font-semibold text-white bg-shopee-orange hover:opacity-90 disabled:opacity-60 transition-opacity"
                >
                  {savingApi ? "Salvando…" : "Salvar na conta"}
                </button>
                {okApi && <span className="text-sm text-green-400">Salvo no Supabase.</span>}
                {errorApi && <span className="text-sm text-red-400">{errorApi}</span>}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1">
          <a
            href={AFILIADO_ANALYTICS_CHROME_WEB_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-shopee-orange hover:underline"
          >
            Instalar extensão
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        </div>
      </div>
    </section>
  );
}
