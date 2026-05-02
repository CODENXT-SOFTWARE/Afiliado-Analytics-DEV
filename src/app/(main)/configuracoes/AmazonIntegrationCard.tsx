"use client";

import { useState, useEffect } from "react";
import { Tag, KeyRound, ExternalLink } from "lucide-react";
import {
  AMAZON_EXT_AFFILIATE_TAG_LS_KEY,
  AMAZON_EXT_SESSION_LS_KEY,
} from "@/lib/amazon/amazon-session-cookie";
import { dispatchAmazonAffiliateSettingsChanged } from "@/lib/amazon/use-amazon-affiliate-local-settings";
import Toolist from "@/app/components/ui/Toolist";

/** Afiliado Analytics na Chrome Web Store (token Amazon no navegador). */
const AFILIADO_ANALYTICS_CHROME_WEB_STORE_URL =
  "https://chromewebstore.google.com/detail/afiliado-analytics/ogfmdnpbcglgppaakmiemaohgofailal";

/** Painel oficial da Amazon Associates BR — Ferramentas → Product Advertising API. */
const AMAZON_PA_API_CREDENTIALS_URL =
  "https://afiliados.amazon.com.br/assoc-credentials/home";

export default function AmazonIntegrationCard() {
  const [affiliateTag, setAffiliateTag] = useState("");
  const [sessionToken, setSessionToken] = useState("");

  useEffect(() => {
    try {
      setAffiliateTag(localStorage.getItem(AMAZON_EXT_AFFILIATE_TAG_LS_KEY) ?? "");
      setSessionToken(localStorage.getItem(AMAZON_EXT_SESSION_LS_KEY) ?? "");
    } catch {
      /* ignore */
    }
  }, []);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const onSave = () => {
    setError(null);
    setOk(false);
    const tag = affiliateTag.trim();
    const tok = sessionToken.trim();
    if (!tag) {
      setError("Informe o seu Associate Tag (obrigatório).");
      return;
    }
    if (!tok) {
      setError("Informe o token de sessão da extensão (obrigatório).");
      return;
    }
    // Amazon associate tags são tipicamente algo como "meusite-20" — letras,
    // números e hífens.
    if (!/^[a-zA-Z0-9_-]+$/.test(tag)) {
      setError("Associate Tag inválido: use só letras, números, _ ou -.");
      return;
    }
    setSaving(true);
    try {
      localStorage.setItem(AMAZON_EXT_AFFILIATE_TAG_LS_KEY, tag);
      localStorage.setItem(AMAZON_EXT_SESSION_LS_KEY, tok);
      dispatchAmazonAffiliateSettingsChanged();
      setOk(true);
    } catch {
      setError("Não foi possível salvar no navegador.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
      <div className="bg-dark-bg/40 border-b border-dark-border px-5 py-4">
        <h2 className="text-base sm:text-lg font-semibold text-text-primary font-heading">
          Amazon — Afiliados
        </h2>
      </div>

      <div className="px-5 py-5 space-y-4">
        <div>
          <label className="flex items-center gap-2 text-sm font-semibold text-text-secondary">
            <Tag className="h-4 w-4 text-shopee-orange" />
            Associate Tag (etiqueta)
          </label>
          <input
            value={affiliateTag}
            onChange={(e) => {
              setAffiliateTag(e.target.value);
              setOk(false);
            }}
            placeholder="seusite-20"
            autoComplete="off"
            spellCheck={false}
            className="mt-2 w-full rounded-md border border-dark-border bg-dark-bg py-2 px-3 text-text-primary placeholder-text-secondary/60 focus:border-shopee-orange focus:outline-none focus:ring-1 focus:ring-shopee-orange sm:text-sm"
          />
          <p className="text-[11px] text-text-secondary mt-1">
            Seu Associate Tag da Amazon (formato: meusite-20). Aparece nos links
            de afiliado como <code>?tag=...</code>.
          </p>
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <label
              htmlFor="amazon-config-ext-session-token"
              className="flex items-center gap-2 text-sm font-semibold text-text-secondary"
            >
              <KeyRound className="h-4 w-4 text-shopee-orange" />
              Token da extensão
            </label>
            <Toolist
              variant="floating"
              wide
              text="Abra a extensão Afiliado Analytics na Amazon e copie o token. Obrigatório para o servidor simular sua sessão de afiliado e buscar produtos com seu link."
            />
          </div>
          <input
            id="amazon-config-ext-session-token"
            type="password"
            value={sessionToken}
            onChange={(e) => {
              setSessionToken(e.target.value);
              setOk(false);
            }}
            placeholder="dWJpZ0xlYS… (cole o token da extensão)"
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
          <a
            href={AMAZON_PA_API_CREDENTIALS_URL}
            target="_blank"
            rel="noopener noreferrer"
            title="Painel oficial — Ferramentas → Product Advertising API. Requer ter feito ao menos 3 vendas qualificadas em 180 dias."
            className="inline-flex items-center gap-1.5 text-xs font-medium text-shopee-orange hover:underline"
          >
            Gerar PA-API
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
          <a
            href="https://associados.amazon.com.br/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-shopee-orange hover:underline"
          >
            Programa Amazon Associados
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        </div>
      </div>
    </section>
  );
}
