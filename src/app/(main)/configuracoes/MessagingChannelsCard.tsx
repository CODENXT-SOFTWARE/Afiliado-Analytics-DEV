"use client";

import { useState } from "react";
import Image from "next/image";
import EvolutionIntegrationCard from "./EvolutionIntegrationCard";
import TelegramIntegrationCard from "./TelegramIntegrationCard";

type Channel = "whatsapp" | "telegram";

export default function MessagingChannelsCard() {
  const [active, setActive] = useState<Channel>("whatsapp");

  return (
    <div className="space-y-3">
      {/* Sub-abas */}
      <div role="tablist" className="flex gap-1 border-b border-dark-border">
        <TabButton
          active={active === "whatsapp"}
          onClick={() => setActive("whatsapp")}
          icon={<Image src="/whatsapp.png" alt="WhatsApp" width={32} height={32} className="h-4 w-4 object-contain" />}
          label="WhatsApp"
        />
        <TabButton
          active={active === "telegram"}
          onClick={() => setActive("telegram")}
          icon={<Image src="/telegram.png" alt="Telegram" width={32} height={32} className="h-4 w-4 object-contain" />}
          label="Telegram"
        />
      </div>

      <div className="animate-in fade-in duration-150">
        {active === "whatsapp" ? <EvolutionIntegrationCard /> : <TelegramIntegrationCard />}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
        active
          ? "text-text-primary border-shopee-orange"
          : "text-text-secondary border-transparent hover:text-text-primary"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
