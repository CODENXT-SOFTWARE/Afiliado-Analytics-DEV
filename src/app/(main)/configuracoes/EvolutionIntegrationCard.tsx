"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import {
  Plus,
  Trash2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  QrCode,
  X,
} from "lucide-react";

export type EvolutionInstance = {
  id: string;
  nome_instancia: string;
  numero_whatsapp: string | null;
  hash: string | null;
  get_participants: boolean;
  created_at: string;
  updated_at: string;
};

/** n8n pode devolver objeto direto, ou array [{ json: { ... } }], ou chaves alternativas. */
function normalizeN8nBody(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (Array.isArray(raw) && raw.length > 0) {
    const first = raw[0];
    if (first && typeof first === "object" && "json" in first) {
      const inner = (first as { json: unknown }).json;
      if (inner && typeof inner === "object") return inner as Record<string, unknown>;
    }
    if (first && typeof first === "object") return first as Record<string, unknown>;
    return null;
  }
  if (typeof raw === "object") return raw as Record<string, unknown>;
  return null;
}

function extractQrFromN8nPayload(obj: Record<string, unknown> | null): string | null {
  if (!obj) return null;
  const data = obj.data;
  const dataObj = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  const candidates: unknown[] = [
    obj.qrcode,
    obj.qrCode,
    obj.qr_code,
    obj.base64,
    dataObj?.qrcode,
    dataObj?.qrCode,
    dataObj?.qr_code,
    dataObj?.base64,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.length > 10) return c;
  }
  return null;
}

function extractHashFromN8nPayload(obj: Record<string, unknown> | null): string | null {
  if (!obj) return null;
  const data = obj.data;
  const dataObj = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  const h = obj.hash ?? dataObj?.hash;
  return typeof h === "string" && h.trim() ? h.trim() : null;
}

export default function EvolutionIntegrationCard() {
  const [instances, setInstances] = useState<EvolutionInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingInstance, setSavingInstance] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [reconnectingId, setReconnectingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // Form nova/edição instância
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nomeInstancia, setNomeInstancia] = useState("");
  const [numeroWhatsApp, setNumeroWhatsApp] = useState("");

  // Status por instância (verificar_status / testar_conexao)
  const [statusLoading, setStatusLoading] = useState<string | null>(null);
  const [statusResult, setStatusResult] = useState<Record<string, { status?: string; conectado?: boolean; erro?: string }>>({});

  // Modal QR code (criar_instancia)
  const [qrInstance, setQrInstance] = useState<EvolutionInstance | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrCodeBase64, setQrCodeBase64] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);

  // Polling: verificar_status a cada 5s até status "open"; limpar no unmount
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingInstanceNameRef = useRef<string | null>(null);
  const pollingInstanceIdRef = useRef<string | null>(null);

  const checkStatusForInstance = async (inst: EvolutionInstance): Promise<{ status?: string; conectado?: boolean; erro?: string }> => {
    try {
      const res = await fetch("/api/evolution/n8n-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipoAcao: "verificar_status",
          nomeInstancia: inst.nome_instancia,
          hash: inst.hash ?? undefined,
          getParticipants: inst.get_participants,
        }),
      });
      const json = await res.json();
      if (!res.ok) return { erro: json?.error ?? "Falha ao verificar" };
      const conectado = json?.status === "open" || json?.conectado === true;
      return { status: json?.status, conectado };
    } catch {
      return { erro: "Erro de rede" };
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/evolution/instances");
      const data = await res.json();
      const list = Array.isArray(data.instances) ? data.instances : [];
      setInstances(list);
      // Ao abrir a seção, verificar status de cada instância no n8n
      const results: Record<string, { status?: string; conectado?: boolean; erro?: string }> = {};
      for (const inst of list) {
        results[inst.id] = await checkStatusForInstance(inst);
      }
      setStatusResult((prev) => ({ ...prev, ...results }));
    } catch {
      setError("Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Limpar polling ao desmontar o componente (evitar memory leak)
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      pollingInstanceNameRef.current = null;
      pollingInstanceIdRef.current = null;
    };
  }, []);

  const openNewForm = () => {
    setEditingId(null);
    setNomeInstancia("");
    setNumeroWhatsApp("");
    setShowForm(true);
  };

  const openEditForm = (inst: EvolutionInstance) => {
    setEditingId(inst.id);
    setNomeInstancia(inst.nome_instancia);
    setNumeroWhatsApp(inst.numero_whatsapp ?? "");
    setShowForm(true);
  };

  const saveInstance = async () => {
    const nome = nomeInstancia.trim();
    if (!nome) {
      setError("Nome da instância é obrigatório.");
      return;
    }
    setSavingInstance(true);
    setError(null);
    setOk(null);
    try {
      if (editingId) {
        const res = await fetch("/api/evolution/instances", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingId,
            nome_instancia: nome,
            numero_whatsapp: numeroWhatsApp.replace(/\D/g, "") || null,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "Erro ao salvar");
        setInstances((prev) => prev.map((i) => (i.id === editingId ? { ...i, ...json } : i)));
        setOk("Instância atualizada.");
      } else {
        const res = await fetch("/api/evolution/instances", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nome_instancia: nome,
            numero_whatsapp: numeroWhatsApp.replace(/\D/g, "") || null,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "Erro ao criar");
        setInstances((prev) => [json, ...prev]);
        setOk("Instância adicionada, clique em Conectar e leia o QR Code!");
      }
      setShowForm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setSavingInstance(false);
    }
  };

  const removeInstance = async (inst: EvolutionInstance) => {
    setRemovingId(inst.id);
    setError(null);
    setOk(null);
    try {
      const n8nRes = await fetch("/api/evolution/n8n-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipoAcao: "excluir_instancia",
          nomeInstancia: inst.nome_instancia,
        }),
      });
      const n8nJson = await n8nRes.json().catch(() => ({}));
      if (!n8nRes.ok) {
        throw new Error(
          typeof n8nJson?.error === "string" ? n8nJson.error : "Falha ao notificar exclusão no n8n (WhatsApp)."
        );
      }
      const res = await fetch(`/api/evolution/instances?id=${encodeURIComponent(inst.id)}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao remover no banco");
      setInstances((prev) => prev.filter((i) => i.id !== inst.id));
      setStatusResult((prev) => {
        const next = { ...prev };
        delete next[inst.id];
        return next;
      });
      setOk("Instância removida.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setRemovingId(null);
    }
  };

  const reconnectInstance = async (inst: EvolutionInstance) => {
    if (!inst.hash) {
      setError("Esta instância ainda não tem hash. Use Conectar para gerar o QR code primeiro.");
      return;
    }
    setReconnectingId(inst.id);
    setError(null);
    setOk(null);
    try {
      const res = await fetch("/api/evolution/n8n-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipoAcao: "reconectar",
          nomeInstancia: inst.nome_instancia,
          hash: inst.hash,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof json?.error === "string" ? json.error : "Falha ao solicitar reconexão no n8n.");
      }
      setOk("Reconexão realizada, leia novamente o QR Code!.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setReconnectingId(null);
    }
  };

  const openQrModal = async (inst: EvolutionInstance) => {
    if (!inst.numero_whatsapp) {
      setError("Número WhatsApp é obrigatório para conectar. Edite a instância e informe o número.");
      return;
    }
    setQrInstance(inst);
    setQrCodeBase64(null);
    setQrError(null);
    setQrLoading(true);
    try {
      // Instância nova (sem hash): criar no Evolution via n8n.
      // Já com hash: o fluxo que devolve QR costuma ser reconectar — criar_instancia duplicaria ou não retorna QR.
      const body = inst.hash
        ? {
            tipoAcao: "reconectar" as const,
            nomeInstancia: inst.nome_instancia,
            hash: inst.hash,
            getParticipants: inst.get_participants,
          }
        : {
            tipoAcao: "criar_instancia" as const,
            nomeInstancia: inst.nome_instancia,
            numeroWhatsApp: inst.numero_whatsapp,
            getParticipants: inst.get_participants,
          };

      const res = await fetch("/api/evolution/n8n-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const rawJson = await res.json();
      if (!res.ok) {
        const errObj = normalizeN8nBody(rawJson);
        const msg =
          typeof errObj?.error === "string"
            ? errObj.error
            : typeof (rawJson as { error?: string })?.error === "string"
              ? (rawJson as { error: string }).error
              : "Falha ao gerar QR code";
        setQrError(msg);
        return;
      }
      const payload = normalizeN8nBody(rawJson);
      const qr = extractQrFromN8nPayload(payload);
      const newHash = extractHashFromN8nPayload(payload);

      if (qr) {
        setQrCodeBase64(qr);
        if (newHash && inst.id) {
          await fetch("/api/evolution/instances", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: inst.id, hash: newHash }),
          });
          setInstances((prev) => prev.map((i) => (i.id === inst.id ? { ...i, hash: newHash } : i)));
        }
        // Iniciar polling a cada 5s até a instância ficar "open"
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        pollingInstanceNameRef.current = inst.nome_instancia;
        pollingInstanceIdRef.current = inst.id;
        pollingIntervalRef.current = setInterval(async () => {
          const nome = pollingInstanceNameRef.current;
          if (!nome) return;
          try {
            const r = await fetch("/api/evolution/n8n-action", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ tipoAcao: "verificar_status", nomeInstancia: nome }),
            });
            const data = await r.json();
            const connected = data?.status === "open" || data?.conectado === true;
            if (connected && pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
              const id = pollingInstanceIdRef.current;
              pollingInstanceNameRef.current = null;
              pollingInstanceIdRef.current = null;
              if (id) setStatusResult((prev) => ({ ...prev, [id]: { conectado: true } }));
              setQrInstance(null);
              setQrCodeBase64(null);
              setQrError(null);
              setOk("Instância conectada com êxito!");
            }
          } catch {
            // mantém o polling em caso de erro de rede
          }
        }, 5000);
      } else {
        setQrError(
          "Resposta do n8n sem QR code. Verifique o fluxo (campos aceitos: qrcode, qrCode, data.qrcode ou array [{ json: { qrcode } }])."
        );
      }
    } catch {
      setQrError("Erro ao chamar o webhook. Tente de novo.");
    } finally {
      setQrLoading(false);
    }
  };

  const closeQrModal = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    pollingInstanceNameRef.current = null;
    pollingInstanceIdRef.current = null;
    setQrInstance(null);
    setQrCodeBase64(null);
    setQrError(null);
  };

  const checkStatus = async (inst: EvolutionInstance) => {
    setStatusLoading(inst.id);
    setStatusResult((prev) => ({ ...prev, [inst.id]: {} }));
    setError(null);
    try {
      const res = await fetch("/api/evolution/n8n-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipoAcao: "verificar_status",
          nomeInstancia: inst.nome_instancia,
          hash: inst.hash ?? undefined,
          getParticipants: inst.get_participants,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setStatusResult((prev) => ({ ...prev, [inst.id]: { erro: json?.error ?? "Falha ao verificar" } }));
        return;
      }
      const conectado = json?.status === "open" || json?.conectado === true;
      setStatusResult((prev) => ({
        ...prev,
        [inst.id]: { status: json?.status, conectado },
      }));
    } catch {
      setStatusResult((prev) => ({ ...prev, [inst.id]: { erro: "Erro de rede" } }));
    } finally {
      setStatusLoading(null);
    }
  };

  return (
    <section className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
      <div className="bg-dark-bg/40 border-b border-dark-border px-5 py-4">
        <h2 className="text-base sm:text-lg font-semibold text-text-primary font-heading flex items-center gap-2">
          <Image src="/whatsapp.png" alt="WhatsApp" width={32} height={32} className="h-5 w-5 object-contain" />
          Integração WhatsApp 
        </h2>
        <p className="text-xs text-text-secondary mt-1">
        Ao adicionar uma nova instância, você deve clicar em &quot;Conectar&quot; para gerar o QR code e escanear no celular.
        </p>
      </div>

      <div className="px-5 py-5 space-y-5">
        {/* Lista de instâncias */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-text-primary">Instâncias conectadas</h3>
            <button
              type="button"
              onClick={openNewForm}
              className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/50 bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-400 hover:bg-emerald-500/20 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Nova instância
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-sm mb-3">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}
          {ok && (
            <div className="flex items-center gap-2 p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-sm mb-3">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              {ok}
            </div>
          )}

          {loading ? (
            <div className="flex items-center gap-2 text-text-secondary py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando...
            </div>
          ) : instances.length === 0 && !showForm ? (
            <p className="text-sm text-text-secondary py-4">
              Nenhuma instância ainda. Clique em &quot;Nova instância&quot; e preencha nome e número.
            </p>
          ) : (
            <ul className="space-y-2">
              {instances.map((inst) => (
                <li
                  key={inst.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dark-border bg-dark-bg p-3"
                >
                  <div>
                    <p className="font-medium text-text-primary">{inst.nome_instancia}</p>
                    {inst.numero_whatsapp && (
                      <p className="text-xs text-text-secondary">WhatsApp: {inst.numero_whatsapp}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {statusResult[inst.id]?.conectado ? (
                      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Conectado
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openQrModal(inst)}
                        disabled={!inst.numero_whatsapp}
                        className="inline-flex items-center gap-1 rounded-md border border-emerald-500/50 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50"
                        title="Gerar QR code para conectar"
                      >
                        <QrCode className="h-3.5 w-3.5" />
                        Conectar
                      </button>
                    )}
                    {inst.hash ? (
                      <button
                        type="button"
                        onClick={() => reconnectInstance(inst)}
                        disabled={reconnectingId === inst.id}
                        className="inline-flex items-center gap-1 rounded-md border border-amber-500/50 bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-400 hover:bg-amber-500/20 disabled:opacity-50"
                        title="Reenvia reconexão para o n8n (nome + hash)"
                      >
                        {reconnectingId === inst.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
                        Reconectar
                      </button>
                    ) : null}
                    <button
                        type="button"
                        onClick={() => checkStatus(inst)}
                        disabled={statusLoading === inst.id}
                        className="rounded-md border border-dark-border px-2 py-1 text-xs font-medium text-text-secondary hover:text-text-primary disabled:opacity-50"
                        title="Atualizar status"
                      >
                        {statusLoading === inst.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
                      </button>
                    <button
                      type="button"
                      onClick={() => openEditForm(inst)}
                      className="rounded-md border border-dark-border px-2 py-1 text-xs font-medium text-text-secondary hover:text-text-primary"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => removeInstance(inst)}
                      disabled={removingId === inst.id}
                      className="rounded-md border border-red-500/40 px-2 py-1 text-xs font-medium text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                    >
                      {removingId === inst.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  {statusResult[inst.id] && (
                    <div className="w-full mt-2 pt-2 border-t border-dark-border flex items-center gap-2 text-xs">
                      {statusResult[inst.id].erro ? (
                        <span className="text-red-400 flex items-center gap-1">
                          <XCircle className="h-3.5 w-3.5" />
                          Erro
                        </span>
                      ) : statusResult[inst.id].conectado ? (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Conectado
                        </span>
                      ) : (
                        <span className="text-amber-400 flex items-center gap-1">
                          Não conectado
                        </span>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* Form nova/edição */}
          {showForm && (
            <div className="mt-4 p-4 rounded-lg border border-dark-border bg-dark-bg space-y-3">
              <h4 className="text-sm font-semibold text-text-primary">
                {editingId ? "Editar instância" : "Nova instância"}
              </h4>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Nome da instância *</label>
                <input
                  type="text"
                  value={nomeInstancia}
                  onChange={(e) => setNomeInstancia(e.target.value)}
                  placeholder="Ex: atendimento1"
                  className="w-full rounded-md border border-dark-border bg-dark-bg py-2 px-3 text-text-primary text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Número WhatsApp</label>
                <input
                  type="text"
                  value={numeroWhatsApp}
                  onChange={(e) => setNumeroWhatsApp(e.target.value)}
                  placeholder="5599999999999"
                  className="w-full rounded-md border border-dark-border bg-dark-bg py-2 px-3 text-text-primary text-sm"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={saveInstance}
                  disabled={savingInstance}
                  className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60"
                >
                  {savingInstance ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {editingId ? "Salvar" : "Adicionar"}
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

          {/* Modal QR code */}
          {qrInstance && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={closeQrModal}>
              <div
                className="rounded-xl border border-dark-border bg-dark-card p-5 shadow-xl max-w-sm w-full"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-base font-semibold text-text-primary">
                    Conectar: {qrInstance.nome_instancia}
                  </h4>
                  <button
                    type="button"
                    onClick={closeQrModal}
                    className="rounded p-1 text-text-secondary hover:bg-dark-bg hover:text-text-primary"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <p className="text-xs text-text-secondary mb-4">
                  Abra o WhatsApp no celular → Dispositivos conectados → Conectar dispositivo e escaneie o QR abaixo.
                </p>
                {qrLoading && (
                  <div className="flex flex-col items-center justify-center py-12 gap-2">
                    <Loader2 className="h-10 w-10 animate-spin text-emerald-500" />
                    <span className="text-sm text-text-secondary">Gerando QR code...</span>
                  </div>
                )}
                {qrError && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400 flex items-center gap-2">
                    <XCircle className="h-4 w-4 flex-shrink-0" />
                    {qrError}
                  </div>
                )}
                {qrCodeBase64 && !qrLoading && (
                  <div className="flex flex-col items-center">
                    <img
                      src={qrCodeBase64.startsWith("data:") ? qrCodeBase64 : `data:image/png;base64,${qrCodeBase64}`}
                      alt="QR Code WhatsApp"
                      className="rounded-lg border border-dark-border bg-white p-2 w-64 h-64 object-contain"
                    />
                    <p className="text-xs text-emerald-400 mt-3">Escaneie com o WhatsApp para vincular.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
