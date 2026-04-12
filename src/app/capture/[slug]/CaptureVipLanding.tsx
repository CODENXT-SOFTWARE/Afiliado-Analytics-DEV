"use client";

import type { PageTemplate } from "@/app/(main)/dashboard/captura/_lib/types";
import type { CaptureVipLandingProps } from "./capture-vip-types";
import CaptureVipRosa from "./CaptureVipRosa";
import CaptureVipTerroso from "./CaptureVipTerroso";
import CaptureVipVinhoRose from "./CaptureVipVinhoRose";
import CaptureTheNewChance from "./CaptureTheNewChance";
import CaptureAuroraLedger from "./CaptureAuroraLedger";
import CaptureJardimFloral from "./CaptureJardimFloral";

export type { CaptureVipLandingProps } from "./capture-vip-types";

type Props = CaptureVipLandingProps & {
  variant: Exclude<PageTemplate, "classic" | "em_branco">;
};

/**
 * Roteador fino: cada template VIP vive no seu ficheiro (`CaptureVipRosa`, `CaptureVipTerroso`).
 * Para um novo modelo, cria `CaptureVipNovo.tsx` e acrescenta o `case` aqui + `PageTemplate` na base/dashboard.
 */
export default function CaptureVipLanding({ variant, ...rest }: Props) {
  if (variant === "vip_terroso") {
    return <CaptureVipTerroso {...rest} />;
  }
  if (variant === "vinho_rose") {
    return <CaptureVipVinhoRose {...rest} />;
  }
  if (variant === "the_new_chance") {
    return <CaptureTheNewChance {...rest} />;
  }
  if (variant === "aurora_ledger") {
    return <CaptureAuroraLedger {...rest} />;
  }
  if (variant === "jardim_floral") {
    return <CaptureJardimFloral {...rest} />;
  }
  return <CaptureVipRosa {...rest} />;
}
