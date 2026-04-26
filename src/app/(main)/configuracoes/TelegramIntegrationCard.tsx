"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Plus,
  Trash2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Users,
  X,
  ExternalLink,
  ChevronDown,
} from "lucide-react";

export type TelegramBot = {
  id: string;
  bot_username: string;
  bot_name: string;
  bot_token: string;
  webhook_set_at: string | null;
  webhook_last_error: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

export type TelegramGrupo = {
  id: string;
  bot_id: string;
  lista_id: string | null;
  chat_id: string;
  group_name: string;
  descoberto_em: string;
  ultima_mensagem_em: string | null;
  created_at: string;
};

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  return `há ${days} d`;
}

export default function TelegramIntegrationCard() {
  const [bots, setBots] = useState<TelegramBot[]>([]);
  const [grupos, setGrupos] = useState<TelegramGrupo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // Form de novo bot
  const [showForm, setShowForm] = useState(false);
  const [howToOpen, setHowToOpen] = useState(false);
  const [expandedGruposBots, setExpandedGruposBots] = useState<Set<string>>(new Set());

  const toggleGruposExpanded = (botId: string) => {
    setExpandedGruposBots((prev) => {
      const next = new Set(prev);
      if (next.has(botId)) next.delete(botId);
      else next.add(botId);
      return next;
    });
  };
  const [tokenInput, setTokenInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [savingBot, setSavingBot] = useState(false);

  const [removingId, setRemovingId] = useState<string | null>(null);
  const [refreshingGrupos, setRefreshingGrupos] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [botsRes, gruposRes] = await Promise.all([
        fetch("/api/telegram/bots"),
        fetch("/api/telegram/grupos"),
      ]);
      const botsJson = await botsRes.json();
      const gruposJson = await gruposRes.json();
      if (!botsRes.ok) throw new Error(botsJson?.error ?? "Erro ao carregar bots");
      setBots(Array.isArray(botsJson.bots) ? botsJson.bots : []);
      setGrupos(Array.isArray(gruposJson.grupos) ? gruposJson.grupos : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const refreshGrupos = async () => {
    setRefreshingGrupos(true);
    try {
      const r = await fetch("/api/telegram/grupos");
      const j = await r.json();
      if (r.ok) setGrupos(Array.isArray(j.grupos) ? j.grupos : []);
    } finally {
      setRefreshingGrupos(false);
    }
  };

  const openNewForm = () => {
    setTokenInput("");
    setNameInput("");
    setError(null);
    setOk(null);
    setShowForm(true);
  };

  const saveBot = async () => {
    const token = tokenInput.trim();
    if (!token) {
      setError("Cole o token do bot.");
      return;
    }
    setSavingBot(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch("/api/telegram/bots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_token: token, bot_name: nameInput.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao cadastrar bot.");
      setBots((prev) => [json, ...prev]);
      if (json.webhook_last_error) {
        setOk(`Bot @${json.bot_username} cadastrado, mas o webhook falhou. Use "Tentar de novo".`);
      } else {
        setOk(`Bot @${json.bot_username} conectado! Adicione-o como admin nos grupos que quiser.`);
      }
      setShowForm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setSavingBot(false);
    }
  };

  const removeBot = async (bot: TelegramBot) => {
    if (!confirm(`Remover o bot @${bot.bot_username}? Os grupos descobertos por ele também serão removidos.`)) {
      return;
    }
    setRemovingId(bot.id);
    setError(null);
    setOk(null);
    try {
      const res = await fetch(`/api/telegram/bots?id=${encodeURIComponent(bot.id)}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao remover");
      setBots((prev) => prev.filter((b) => b.id !== bot.id));
      setGrupos((prev) => prev.filter((g) => g.bot_id !== bot.id));
      setOk("Bot removido.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setRemovingId(null);
    }
  };

  const retryWebhook = async (bot: TelegramBot) => {
    // Re-PATCH não chama setWebhook; o jeito mais simples é remover e recadastrar.
    // Como não temos endpoint dedicado de retry ainda, oriente o usuário.
    if (
      !confirm(
        `Pra refazer o webhook do bot @${bot.bot_username}, vou remover e recadastrar (você precisa colar o token de novo). Continuar?`
      )
    ) {
      return;
    }
    await removeBot(bot);
    openNewForm();
  };

  const gruposPorBot = (botId: string) => grupos.filter((g) => g.bot_id === botId);

  return (
    <section className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
      <div className="bg-dark-bg/40 border-b border-dark-border px-5 py-4">
        <h2 className="text-base sm:text-lg font-semibold text-text-primary font-heading flex items-center gap-2">
          <Image src="/telegram.png" alt="Telegram" width={32} height={32} className="h-5 w-5 object-contain" />
          Integração Telegram
        </h2>
        <p className="text-xs text-text-secondary mt-1">
          O webhook é configurado automaticamente.
        </p>
      </div>

      <div className="px-5 py-5 space-y-5">
      {/* Instruções de criação do bot (dropdown) */}
      <div className="rounded-lg border border-shopee-orange/30 bg-shopee-orange/5">
        <button
          type="button"
          onClick={() => setHowToOpen((v) => !v)}
          aria-expanded={howToOpen}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-shopee-orange/10 rounded-lg"
        >
          <span className="text-sm font-semibold text-shopee-orange">Como criar seu bot</span>
          <ChevronDown
            className={`h-4 w-4 text-shopee-orange transition-transform duration-200 ${howToOpen ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>
        {howToOpen && (
          <div className="px-4 pb-4 pt-1 border-t border-shopee-orange/15">
            <ol className="list-decimal pl-5 text-xs text-text-secondary space-y-1 mt-3">
              <li>
                Abra o Telegram e procure{" "}
                <a
                  href="https://t.me/BotFather"
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-400 hover:underline inline-flex items-center gap-0.5"
                >
                  @BotFather
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>
                Envie <code className="rounded bg-dark-bg px-1">/newbot</code>, escolha um nome e um username (terminando em{" "}
                <code className="rounded bg-dark-bg px-1">bot</code>)
              </li>
              <li>Copie o token que ele te enviar e cole aqui embaixo</li>
              <li>
                <span className="text-amber-400 font-medium">Importante:</span> envie{" "}
                <code className="rounded bg-dark-bg px-1">/setprivacy</code> ao @BotFather, escolha seu bot e clique em{" "}
                <code className="rounded bg-dark-bg px-1">Disable</code> — assim ele recebe todas as mensagens dos grupos
              </li>
              <li>Adicione o bot como administrador nos grupos que você quer usar</li>
            </ol>
          </div>
        )}
      </div>

      {/* Mensagens de status */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}
      {ok && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-sm">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          {ok}
        </div>
      )}

      {/* Cabeçalho da lista de bots */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">Bots conectados</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refreshGrupos}
            disabled={refreshingGrupos}
            className="inline-flex items-center gap-1.5 rounded-md border border-dark-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary disabled:opacity-50"
            title="Recarregar grupos descobertos"
          >
            {refreshingGrupos ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Atualizar grupos
          </button>
          <button
            type="button"
            onClick={openNewForm}
            className="inline-flex items-center gap-1.5 rounded-md border border-shopee-orange/50 bg-shopee-orange/10 px-3 py-1.5 text-sm font-medium text-shopee-orange hover:bg-shopee-orange/20 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Conectar bot
          </button>
        </div>
      </div>

      {/* Form de novo bot */}
      {showForm && (
        <div className="p-4 rounded-lg border border-dark-border bg-dark-bg space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-text-primary">Novo bot Telegram</h4>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded p-1 text-text-secondary hover:bg-dark-card hover:text-text-primary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              Token do bot *
            </label>
            <input
              type="text"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="123456789:AA...xyz"
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-md border border-dark-border bg-dark-card py-2 px-3 text-text-primary text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              Apelido do Bot
            </label>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Bot Promoções 1"
              className="w-full rounded-md border border-dark-border bg-dark-card py-2 px-3 text-text-primary text-sm"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={saveBot}
              disabled={savingBot}
              className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white bg-shopee-orange hover:opacity-90 disabled:opacity-60"
            >
              {savingBot ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Conectar bot
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-md border border-dark-border px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary"
            >
              Cancelar
            </button>
          </div>
          
        </div>
      )}

      {/* Lista de bots */}
      {loading ? (
        <div className="flex items-center gap-2 text-text-secondary py-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando...
        </div>
      ) : bots.length === 0 && !showForm ? (
        <p className="text-sm text-text-secondary py-4">
          Nenhum bot conectado ainda. Clique em &quot;Conectar bot&quot; pra começar.
        </p>
      ) : (
        <ul className="space-y-3">
          {bots.map((bot) => {
            const botGrupos = gruposPorBot(bot.id);
            return (
              <li
                key={bot.id}
                className="rounded-md border border-dark-border bg-dark-bg overflow-hidden"
              >
                {/* Header do bot */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-3 border-b border-dark-border">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Image src="/telegram.png" alt="Telegram" width={32} height={32} className="h-4 w-4 object-contain shrink-0" />
                      <p className="font-medium text-text-primary truncate">{bot.bot_name}</p>
                    </div>
                    <p className="text-xs text-text-secondary mt-0.5">
                      <a
                        href={`https://t.me/${bot.bot_username}`}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-sky-400"
                      >
                        @{bot.bot_username}
                      </a>
                      <span className="mx-1.5">•</span>
                      <span className="font-mono text-[11px]">{bot.bot_token}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {bot.webhook_set_at && !bot.webhook_last_error ? (
                      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Webhook ativo
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => retryWebhook(bot)}
                        className="inline-flex items-center gap-1 rounded-md border border-amber-500/50 bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-400 hover:bg-amber-500/20"
                        title={bot.webhook_last_error ?? "Webhook não configurado"}
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Refazer webhook
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeBot(bot)}
                      disabled={removingId === bot.id}
                      className="rounded-md border border-red-500/40 px-2 py-1 text-xs font-medium text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                      title="Remover bot"
                    >
                      {removingId === bot.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                  {bot.webhook_last_error && (
                    <div className="w-full mt-2 pt-2 border-t border-dark-border flex items-start gap-2 text-xs text-red-400">
                      <XCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                      <span className="break-all">{bot.webhook_last_error}</span>
                    </div>
                  )}
                </div>

                {/* Lista de grupos descobertos (dropdown) */}
                <div className="px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => toggleGruposExpanded(bot.id)}
                    aria-expanded={expandedGruposBots.has(bot.id)}
                    className="w-full flex items-center justify-between gap-2 text-xs font-medium text-text-secondary hover:text-text-primary transition rounded px-1 py-0.5"
                  >
                    <span className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      Grupos descobertos ({botGrupos.length})
                    </span>
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform duration-200 ${
                        expandedGruposBots.has(bot.id) ? "rotate-180" : ""
                      }`}
                      aria-hidden
                    />
                  </button>
                  {expandedGruposBots.has(bot.id) && (
                    <div className="mt-2">
                      {botGrupos.length === 0 ? (
                        <p className="text-xs text-text-secondary py-1">
                          Nenhum grupo ainda. Adicione o bot como admin em algum grupo e mande qualquer mensagem.
                          Depois clique em &quot;Atualizar grupos&quot;.
                        </p>
                      ) : (
                        <ul className="space-y-1">
                          {botGrupos.map((g) => (
                            <li
                              key={g.id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded border border-dark-border/60 bg-dark-card/50 px-2.5 py-1.5"
                            >
                              <div className="min-w-0">
                                <p className="text-sm text-text-primary truncate">
                                  {g.group_name || <span className="italic text-text-secondary">sem título</span>}
                                </p>
                                <p
                                  className="text-[11px] font-mono text-shopee-orange"
                                  style={{ WebkitTextFillColor: "var(--color-shopee-orange)" }}
                                >
                                  {g.chat_id}
                                </p>
                              </div>
                              <span className="text-[11px] text-text-secondary">
                                última msg {formatRelative(g.ultima_mensagem_em)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      </div>
    </section>
  );
}
