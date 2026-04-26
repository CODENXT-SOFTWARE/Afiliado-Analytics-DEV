"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

const TABS: { href: string; label: string; icon: React.ReactNode; matchPrefix: string }[] = [
  {
    href: "/dashboard/grupos-venda",
    label: "WhatsApp",
    icon: <Image src="/whatsapp.png" alt="WhatsApp" width={32} height={32} className="h-4 w-4 object-contain" />,
    matchPrefix: "/dashboard/grupos-venda",
  },
  {
    href: "/dashboard/grupos-venda/telegram",
    label: "Telegram",
    icon: <Image src="/telegram.png" alt="Telegram" width={32} height={32} className="h-4 w-4 object-contain" />,
    matchPrefix: "/dashboard/grupos-venda/telegram",
  },
];

export default function ChannelTabs() {
  const pathname = usePathname() ?? "";
  // Telegram tem prefixo mais específico — checa primeiro
  const isTelegram = pathname.startsWith("/dashboard/grupos-venda/telegram");

  return (
    <div role="tablist" className="flex gap-1 border-b border-dark-border mb-4">
      {TABS.map((t) => {
        const active = t.label === "Telegram" ? isTelegram : !isTelegram;
        return (
          <Link
            key={t.href}
            href={t.href}
            role="tab"
            aria-selected={active}
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              active
                ? "text-text-primary border-shopee-orange"
                : "text-text-secondary border-transparent hover:text-text-primary"
            }`}
          >
            {t.icon}
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
