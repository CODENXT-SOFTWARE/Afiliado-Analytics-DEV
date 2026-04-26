import Image from "next/image";
import ChannelTabs from "../ChannelTabs";
import TelegramAutomacoesClient from "./TelegramAutomacoesClient";

export const dynamic = "force-dynamic";

export default function TelegramGruposVendaPage() {
  return (
    <div className="flex flex-col w-full text-[#f0f0f2] rounded-lg p-3 sm:p-6 gap-4 sm:gap-5">
      <ChannelTabs />

      <header>
        <h1 className="text-lg sm:text-xl font-bold flex items-center gap-2.5 text-white">
          <Image src="/telegram.png" alt="Telegram" width={32} height={32} className="w-7 h-7 object-contain shrink-0" />
          Grupos de Venda
        </h1>
        <p className="text-[11px] text-[#a0a0a0] mt-1 leading-relaxed max-md:hidden">
          Dispare ofertas automaticamente em grupos do Telegram dentro de uma janela de até 14 horas por dia.
        </p>
      </header>

      <TelegramAutomacoesClient />
    </div>
  );
}
