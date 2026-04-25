import ChannelTabs from "../ChannelTabs";
import TelegramListasClient from "./TelegramListasClient";

export const dynamic = "force-dynamic";

export default function TelegramGruposVendaPage() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto">
      <ChannelTabs />
      <TelegramListasClient />
    </div>
  );
}
