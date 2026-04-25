"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Send,
  Plus,
  Trash2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  CheckCircle2,
  Search,
  Pencil,
  X,
  Users,
} from "lucide-react";

type TelegramBot = {
  id: string;
  bot_username: string;
  bot_name: string;
  ativo: boolean;
  webhook_set_at: string | null;
};

type TelegramGrupo = {
  id: string;
  bot_id: string;
  lista_id: string | null;
  chat_id: string;
  group_name: string;
  ultima_mensagem_em: string | null;
};

type TelegramListaResumo = {
  id: string;
  bot_id: string;
  nome_lista: string;
  created_at: string;
  groups_count: number;
};

type TelegramListaFull = {
  id: string;
  bot_id: string;
  nome_lista: string;
  created_at: string;
  groups: { chat_id: string; nome: string }[];
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

export default function TelegramListasClient() {
  const [bots, setBots] = useState<TelegramBot[]>([]);
  const [listas, setListas] = useState<TelegramListaResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [removingId, setRemovingId] = useState<string | null>(null);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingListaId, setEditingListaId] = useState<string | null>(null);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [botsRes, listasRes] = await Promise.all([
        fetch("/api/telegram/bots"),
        fetch("/api/telegram/listas"),
      ]);
      const botsJson = await botsRes.json();
      const listasJson = await listasRes.json();
      if (!botsRes.ok) throw new Error(botsJson?.error ?? "Erro ao carregar bots");
      setBots(Array.isArray(botsJson.bots) ? botsJson.bots : []);
      setListas(Array.isArray(listasJson.data) ? listasJson.data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const botById = useMemo(() => {
    const m = new Map<string, TelegramBot>();
    bots.forEach((b) => m.set(b.id, b));
    return m;
  }, [bots]);

  const filteredListas = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return listas;
    return listas.filter((l) => l.nome_lista.toLowerCase().includes(q));
  }, [listas, search]);

  const openNewModal = () => {
    if (bots.length === 0) {
      setError("Conecte um bot Telegram em Configurações antes de criar listas.");
      return;
    }
    setEditingListaId(null);
    setModalOpen(true);
  };

  const openEditModal = (id: string) => {
    setEditingListaId(id);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingListaId(null);
  };

  const handleSaved = (msg: string) => {
    setOk(msg);
    setError(null);
    closeModal();
    loadAll();
  };

  const removeLista = async (l: TelegramListaResumo) => {
    if (!confirm(`Excluir a lista "${l.nome_lista}"? Os grupos descobertos NÃO serão apagados.`)) {
      return;
    }
    setRemovingId(l.id);
    setError(null);
    setOk(null);
    try {
      const res = await fetch(`/api/telegram/listas?id=${encodeURIComponent(l.id)}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao excluir");
      setListas((prev) => prev.filter((x) => x.id !== l.id));
      setOk(`Lista "${l.nome_lista}" excluída.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold text-text-primary font-heading flex items-center gap-2">
            <Send className="h-5 w-5 text-sky-400" />
            Listas de Grupos · Telegram
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Agrupe grupos descobertos por seus bots em listas reutilizáveis nas automações.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadAll}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-md border border-dark-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary disabled:opacity-50"
            title="Recarregar"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Atualizar
          </button>
          <button
            type="button"
            onClick={openNewModal}
            className="inline-flex items-center gap-1.5 rounded-md border border-sky-500/50 bg-sky-500/10 px-3 py-1.5 text-sm font-medium text-sky-400 hover:bg-sky-500/20 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nova lista
          </button>
        </div>
      </div>

      {/* Mensagens */}
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

      {/* Aviso se não tem bot */}
      {!loading && bots.length === 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-300">
          Você ainda não conectou nenhum bot Telegram.{" "}
          <a href="/configuracoes" className="underline hover:text-amber-200">
            Vá em Configurações → Integração WhatsApp + Telegram
          </a>{" "}
          pra conectar.
        </div>
      )}

      {/* Busca */}
      {bots.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome da lista..."
            className="w-full rounded-md border border-dark-border bg-dark-card py-2 pl-9 pr-3 text-text-primary text-sm"
          />
        </div>
      )}

      {/* Listagem */}
      {loading ? (
        <div className="flex items-center gap-2 text-text-secondary py-6">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando...
        </div>
      ) : filteredListas.length === 0 ? (
        <p className="text-sm text-text-secondary py-6">
          {listas.length === 0
            ? bots.length === 0
              ? ""
              : 'Nenhuma lista ainda. Clique em "Nova lista" pra começar.'
            : "Nenhuma lista bate com a busca."}
        </p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredListas.map((l) => {
            const bot = botById.get(l.bot_id);
            return (
              <li
                key={l.id}
                className="rounded-lg border border-dark-border bg-dark-card p-4 flex flex-col gap-2"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-text-primary truncate">{l.nome_lista}</p>
                  <p className="text-xs text-text-secondary mt-0.5 truncate">
                    {bot ? `@${bot.bot_username}` : <span className="italic">bot removido</span>}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                  <Users className="h-3.5 w-3.5" />
                  {l.groups_count} grupo{l.groups_count === 1 ? "" : "s"}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => openEditModal(l.id)}
                    className="inline-flex items-center gap-1 rounded-md border border-dark-border px-2 py-1 text-xs font-medium text-text-secondary hover:text-text-primary"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => removeLista(l)}
                    disabled={removingId === l.id}
                    className="inline-flex items-center gap-1 rounded-md border border-red-500/40 px-2 py-1 text-xs font-medium text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                  >
                    {removingId === l.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    Excluir
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {modalOpen && (
        <ListaModal
          bots={bots}
          editingListaId={editingListaId}
          onClose={closeModal}
          onSaved={handleSaved}
        />
      )}
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Modal de criar/editar lista
// ────────────────────────────────────────────────────────────────────────────────

function ListaModal({
  bots,
  editingListaId,
  onClose,
  onSaved,
}: {
  bots: TelegramBot[];
  editingListaId: string | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const isEdit = editingListaId !== null;

  const [botId, setBotId] = useState<string>(bots[0]?.id ?? "");
  const [nomeLista, setNomeLista] = useState("");
  const [grupos, setGrupos] = useState<TelegramGrupo[]>([]);
  const [selectedChatIds, setSelectedChatIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Carrega lista existente (para editar) e/ou os grupos do bot selecionado
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setErr(null);
      try {
        // Se está editando, primeiro carrega a lista para saber bot_id e grupos atuais
        if (isEdit && editingListaId) {
          const r = await fetch(`/api/telegram/listas?id=${encodeURIComponent(editingListaId)}`);
          const j = await r.json();
          if (!r.ok) throw new Error(j?.error ?? "Erro ao carregar lista");
          if (cancelled) return;
          const lista = j.data as TelegramListaFull;
          setBotId(lista.bot_id);
          setNomeLista(lista.nome_lista);
          setSelectedChatIds(new Set(lista.groups.map((g) => g.chat_id)));
          // Agora carrega os grupos disponíveis do bot
          const gr = await fetch(`/api/telegram/grupos?bot_id=${encodeURIComponent(lista.bot_id)}`);
          const gj = await gr.json();
          if (!cancelled) {
            setGrupos(Array.isArray(gj.grupos) ? gj.grupos : []);
          }
        } else {
          if (!botId) return;
          const gr = await fetch(`/api/telegram/grupos?bot_id=${encodeURIComponent(botId)}`);
          const gj = await gr.json();
          if (!cancelled) {
            setGrupos(Array.isArray(gj.grupos) ? gj.grupos : []);
          }
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Erro");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, editingListaId, botId]);

  const toggleChat = (chatId: string) => {
    setSelectedChatIds((prev) => {
      const next = new Set(prev);
      if (next.has(chatId)) next.delete(chatId);
      else next.add(chatId);
      return next;
    });
  };

  const selectAll = () => setSelectedChatIds(new Set(grupos.map((g) => g.chat_id)));
  const clearAll = () => setSelectedChatIds(new Set());

  const handleSave = async () => {
    if (!botId) {
      setErr("Selecione um bot.");
      return;
    }
    const nome = nomeLista.trim();
    if (!nome) {
      setErr("Informe o nome da lista.");
      return;
    }
    if (selectedChatIds.size === 0) {
      setErr("Selecione ao menos um grupo.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const chat_ids = Array.from(selectedChatIds);
      if (isEdit && editingListaId) {
        const r = await fetch("/api/telegram/listas", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingListaId, nome_lista: nome, chat_ids }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error ?? "Erro ao salvar");
        onSaved(`Lista "${nome}" atualizada com ${chat_ids.length} grupo(s).`);
      } else {
        const r = await fetch("/api/telegram/listas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bot_id: botId, nome_lista: nome, chat_ids }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error ?? "Erro ao criar");
        onSaved(`Lista "${nome}" criada com ${chat_ids.length} grupo(s).`);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="rounded-xl border border-dark-border bg-dark-card p-5 shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
            <Send className="h-4 w-4 text-sky-400" />
            {isEdit ? "Editar lista" : "Nova lista Telegram"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-text-secondary hover:bg-dark-bg hover:text-text-primary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {err && (
          <div className="flex items-center gap-2 p-2.5 mb-3 rounded-md border border-red-500/30 bg-red-500/10 text-red-400 text-xs">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
            {err}
          </div>
        )}

        <div className="space-y-3 overflow-y-auto pr-1">
          {/* Bot */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Bot *</label>
            <select
              value={botId}
              onChange={(e) => {
                setBotId(e.target.value);
                setSelectedChatIds(new Set());
              }}
              disabled={isEdit}
              className="w-full rounded-md border border-dark-border bg-dark-bg py-2 px-3 text-text-primary text-sm disabled:opacity-60"
            >
              {bots.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.bot_name} (@{b.bot_username})
                </option>
              ))}
            </select>
            {isEdit && (
              <p className="text-[11px] text-text-secondary mt-1">
                Bot não pode ser alterado em listas existentes.
              </p>
            )}
          </div>

          {/* Nome */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              Nome da lista *
            </label>
            <input
              type="text"
              value={nomeLista}
              onChange={(e) => setNomeLista(e.target.value)}
              placeholder="Ex: Promoções Achadinhos"
              className="w-full rounded-md border border-dark-border bg-dark-bg py-2 px-3 text-text-primary text-sm"
            />
          </div>

          {/* Grupos */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-text-secondary">
                Grupos descobertos ({grupos.length})
              </label>
              {grupos.length > 0 && (
                <div className="flex items-center gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={selectAll}
                    className="text-sky-400 hover:underline"
                  >
                    Marcar todos
                  </button>
                  <span className="text-text-secondary">·</span>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="text-text-secondary hover:text-text-primary"
                  >
                    Limpar
                  </button>
                </div>
              )}
            </div>

            {loading ? (
              <div className="flex items-center gap-2 text-text-secondary text-sm py-3">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando grupos...
              </div>
            ) : grupos.length === 0 ? (
              <p className="text-xs text-text-secondary py-2">
                Nenhum grupo descoberto pra esse bot ainda. Adicione o bot como admin em algum
                grupo, mande qualquer mensagem, e volte aqui.
              </p>
            ) : (
              <ul className="space-y-1 max-h-72 overflow-y-auto pr-1 border border-dark-border rounded-md bg-dark-bg p-2">
                {grupos.map((g) => {
                  const checked = selectedChatIds.has(g.chat_id);
                  const usedByOther = g.lista_id !== null && (!isEdit || g.lista_id !== editingListaId);
                  return (
                    <li
                      key={g.id}
                      className={`flex items-center gap-2 rounded px-2 py-1.5 cursor-pointer hover:bg-dark-card/50 ${
                        checked ? "bg-sky-500/10" : ""
                      }`}
                      onClick={() => toggleChat(g.chat_id)}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleChat(g.chat_id)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-3.5 w-3.5 accent-sky-500"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-text-primary truncate">
                          {g.group_name || (
                            <span className="italic text-text-secondary">sem título</span>
                          )}
                        </p>
                        <p className="text-[11px] text-text-secondary font-mono">{g.chat_id}</p>
                      </div>
                      <span className="text-[11px] text-text-secondary">
                        {formatRelative(g.ultima_mensagem_em)}
                      </span>
                      {usedByOther && (
                        <span
                          className="text-[10px] text-amber-400 ml-1"
                          title="Esse grupo já está em outra lista — marcar moverá ele pra cá"
                        >
                          em outra lista
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-dark-border mt-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-dark-border px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isEdit ? "Salvar alterações" : "Criar lista"}
          </button>
        </div>
      </div>
    </div>
  );
}
