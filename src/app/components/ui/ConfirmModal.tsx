"use client";

import { AlertCircle } from "lucide-react";

type ConfirmModalProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "default",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null;

  const isDanger = variant === "danger";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fade-in_0.2s_ease-out]"
      onClick={loading ? undefined : onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      aria-describedby="confirm-modal-desc"
    >
      <div
        className="w-full max-w-md bg-dark-card border border-dark-border rounded-xl shadow-2xl animate-[zoom-in-95_0.2s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-dark-border flex items-center gap-3">
          <div
            className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${isDanger ? "bg-red-500/20" : "bg-shopee-orange/20"}`}
          >
            <AlertCircle className={`h-5 w-5 ${isDanger ? "text-red-400" : "text-shopee-orange"}`} />
          </div>
          <h2 id="confirm-modal-title" className="text-lg font-semibold text-text-primary">
            {title}
          </h2>
        </div>

        <div className="p-5">
          <p id="confirm-modal-desc" className="text-sm text-text-secondary leading-relaxed">
            {message}
          </p>
        </div>

        <div className="p-5 border-t border-dark-border flex flex-col-reverse sm:flex-row gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-2.5 bg-dark-bg border border-dark-border text-text-secondary rounded-lg hover:border-shopee-orange hover:text-shopee-orange transition-colors font-medium disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 px-4 py-2.5 rounded-lg font-semibold text-white transition-colors disabled:opacity-50 ${
              isDanger
                ? "bg-red-600 hover:bg-red-500"
                : "bg-shopee-orange hover:opacity-90"
            }`}
          >
            {loading ? "Aguarde..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
