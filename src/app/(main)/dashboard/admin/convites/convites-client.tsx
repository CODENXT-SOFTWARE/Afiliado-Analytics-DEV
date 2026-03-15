// src/app/(main)/dashboard/admin/convites/convites-client.tsx
"use client";

import { useSupabase } from "@/app/components/auth/AuthProvider";
import { useState, useEffect, useCallback } from "react";
import { UserPlus, Mail, Trash2, CheckCircle, AlertCircle } from "lucide-react";
import LoadingOverlay from "@/app/components/ui/LoadingOverlay";
import ConfirmModal from "@/app/components/ui/ConfirmModal";

interface InvitedAffiliate {
  id: string;
  email: string;
  name: string;
  invited_at: string;
}

export default function ConvitesClient() {
  const context = useSupabase();
  const session = context?.session;
  const supabase = context?.supabase;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [invites, setInvites] = useState<InvitedAffiliate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchInvites = useCallback(async () => {
    if (!session) return;

    setIsFetching(true);
    try {
      const response = await fetch("/api/admin/invited-affiliates", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        setInvites(result.data || []);
      }
    } catch (err) {
      console.error("Erro ao buscar convites:", err);
    } finally {
      setIsFetching(false);
    }
  }, [session]);

  useEffect(() => {
    if (session && supabase) {
      fetchInvites();
    }
  }, [session, supabase, fetchInvites]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;

    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/invite-affiliate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ name, email }),
      });

      const result = await response.json();

      if (response.ok) {
        setMessage({ type: "success", text: result.message || "Convite enviado com sucesso!" });
        setName("");
        setEmail("");
        fetchInvites();
      } else {
        setMessage({ type: "error", text: result.error || "Erro ao enviar convite" });
      }
    } catch (err) {
      console.error("Erro ao enviar convite:", err);
      setMessage({ type: "error", text: "Erro ao enviar convite" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = (emailToDelete: string) => {
    if (!session) return;
    setDeleteConfirmEmail(emailToDelete);
  };

  const handleDeleteConfirm = useCallback(async () => {
    if (!session || !deleteConfirmEmail) return;

    setDeleteLoading(true);
    try {
      const response = await fetch("/api/admin/invited-affiliates", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ email: deleteConfirmEmail }),
      });

      if (response.ok) {
        setMessage({ type: "success", text: "Afiliado excluído com sucesso!" });
        setDeleteConfirmEmail(null);
        fetchInvites();
      } else {
        setMessage({ type: "error", text: "Erro ao excluir afiliado" });
      }
    } catch (err) {
      console.error("Erro ao excluir afiliado:", err);
      setMessage({ type: "error", text: "Erro ao excluir afiliado" });
    } finally {
      setDeleteLoading(false);
    }
  }, [session, deleteConfirmEmail, fetchInvites]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isFetching) {
    return <LoadingOverlay message="Carregando..." />;
  }

  return (
    <>
      {isLoading && <LoadingOverlay message="Processando..." />}

      <div className="px-4 sm:px-0">
        {/* HEADER SIMPLES */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-text-primary font-heading mb-2">
            Convites de Afiliados
          </h1>
          <p className="text-sm sm:text-base text-text-secondary">
            Envie convites para afiliados com acesso gratuito e vitalício.
          </p>
        </div>

        {/* Mensagem de Feedback */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-lg border flex items-center gap-3 ${
              message.type === "success"
                ? "bg-green-500/10 border-green-500/50 text-green-500"
                : "bg-red-500/10 border-red-500/50 text-red-500"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle className="h-5 w-5 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
            )}
            <p className="text-sm font-medium">{message.text}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Formulário de Convite */}
          <div className="bg-dark-card p-4 sm:p-6 rounded-lg border border-dark-border">
            <h2 className="text-lg sm:text-xl font-semibold text-text-primary mb-4 flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-shopee-orange" />
              Enviar Novo Convite
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-text-primary mb-2">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: João Silva"
                  className="w-full px-4 py-3 bg-[#18181B] border border-[#27272A] rounded-md text-text-primary placeholder-[#52525B] focus:outline-none focus:ring-2 focus:ring-shopee-orange focus:border-shopee-orange transition-all"
                  required
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-text-primary mb-2">
                  E-mail *
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="joao@exemplo.com"
                  className="w-full px-4 py-3 bg-[#18181B] border border-[#27272A] rounded-md text-text-primary placeholder-[#52525B] focus:outline-none focus:ring-2 focus:ring-shopee-orange focus:border-shopee-orange transition-all"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full px-6 py-3 bg-shopee-orange text-white rounded-md hover:bg-[#F97316] transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center justify-center gap-2"
              >
                <Mail className="h-5 w-5" />
                Enviar Convite
              </button>
            </form>
          </div>

          {/* Preview */}
          <div className="bg-dark-card p-4 sm:p-6 rounded-lg border border-dark-border">
            <h2 className="text-lg sm:text-xl font-semibold text-text-primary mb-4">
              Como Funciona
            </h2>
            <div className="space-y-3 text-sm text-text-secondary">
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-shopee-orange/20 flex items-center justify-center text-shopee-orange font-bold text-xs">
                  1
                </div>
                <p>Digite o nome e email do afiliado convidado</p>
              </div>
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-shopee-orange/20 flex items-center justify-center text-shopee-orange font-bold text-xs">
                  2
                </div>
                <p>Um email automático será enviado com o link de primeiro acesso</p>
              </div>
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-shopee-orange/20 flex items-center justify-center text-shopee-orange font-bold text-xs">
                  3
                </div>
                <p>O afiliado cria sua senha e tem acesso gratuito e vitalício</p>
              </div>
            </div>

            <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-md">
              <p className="text-sm text-blue-400">
                💡 <strong>Importante:</strong> Este convite não passa pela Kiwify e não requer pagamento.
              </p>
            </div>
          </div>
        </div>

        {/* Lista de Convites */}
        <div className="mt-6 bg-dark-card p-4 sm:p-6 rounded-lg border border-dark-border">
          <h2 className="text-lg sm:text-xl font-semibold text-text-primary mb-4">
            Afiliados Convidados ({invites.length})
          </h2>

          {invites.length === 0 ? (
            <div className="text-center py-12">
              <UserPlus className="h-12 w-12 text-text-secondary/30 mx-auto mb-3" />
              <p className="text-text-secondary">Nenhum afiliado convidado ainda.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {invites.map((invite) => (
                <div
                  key={invite.id}
                  className="bg-dark-bg p-4 rounded-lg border border-dark-border flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex-grow min-w-0">
                    <h3 className="text-base font-semibold text-text-primary break-words">
                      {invite.name}
                    </h3>
                    <p className="text-sm text-text-secondary break-all">{invite.email}</p>
                    <p className="text-xs text-text-secondary mt-1">
                      Convidado em: {formatDate(invite.invited_at)}
                    </p>
                  </div>

                  <button
                    onClick={() => handleDeleteClick(invite.email)}
                    className="p-2 rounded-md bg-dark-bg text-text-secondary hover:text-red-500 hover:bg-red-500/10 transition-colors self-end sm:self-auto"
                    title="Excluir"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {deleteConfirmEmail && (
        <ConfirmModal
          open={!!deleteConfirmEmail}
          title="Excluir convite"
          message="Tem certeza que deseja excluir este convite?"
          confirmLabel="Excluir"
          cancelLabel="Cancelar"
          variant="danger"
          loading={deleteLoading}
          onConfirm={handleDeleteConfirm}
          onCancel={() => !deleteLoading && setDeleteConfirmEmail(null)}
        />
      )}
    </>
  );
}
