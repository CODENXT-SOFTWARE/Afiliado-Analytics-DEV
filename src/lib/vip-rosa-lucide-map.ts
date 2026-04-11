import type { LucideIcon } from "lucide-react";
import {
  Bell,
  CheckCircle,
  Flame,
  Gift,
  Heart,
  Home,
  Megaphone,
  Percent,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Star,
  Tag,
  Ticket,
  Truck,
  Wallet,
  Zap,
} from "lucide-react";
import type { VipRosaIconKey } from "@/lib/capture-promo-icons";

/** Mapa único: página pública + dashboard (picker). */
export const VIP_ROSA_LUCIDE_MAP: Record<VipRosaIconKey, LucideIcon> = {
  Ticket,
  Home,
  ShoppingBag,
  Zap,
  CheckCircle,
  Gift,
  Star,
  Heart,
  Flame,
  Sparkles,
  Tag,
  Percent,
  Truck,
  ShieldCheck,
  Megaphone,
  Bell,
  Wallet,
  Smartphone,
};

export function vipRosaLucideIcon(key: VipRosaIconKey): LucideIcon {
  return VIP_ROSA_LUCIDE_MAP[key] ?? Ticket;
}
