import { CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default function CheckoutSuccessPage() {
  return (
    <div className="min-h-screen bg-[#18181b] text-[#f0f0f2] flex items-center justify-center px-4">
      <div className="max-w-md w-full rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-8 text-center">
        <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto mb-4" />
        <h1 className="text-xl font-bold">Pagamento confirmado!</h1>
        <p className="mt-2 text-sm text-[#c8c8ce] leading-relaxed">
          Seu pedido foi recebido. Em breve o vendedor entrará em contato pelo WhatsApp com os detalhes do envio.
        </p>
      </div>
    </div>
  );
}
