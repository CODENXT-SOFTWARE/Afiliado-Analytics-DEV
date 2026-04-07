import type { OfertCarouselPosition } from "@/lib/capture-ofert-carousel";

export type OfertCarouselPersistInput = {
  siteId: string;
  ofertCarouselEnabled: boolean;
  ofertCarouselPosition: OfertCarouselPosition;
  carouselSlotPath: (string | null)[];
  carouselSlotFile: (File | null)[];
  initialCarouselPaths: (string | null)[];
};

export type OfertCarouselPersistResult = {
  ofert_carousel_enabled: boolean;
  ofert_carousel_position: OfertCarouselPosition;
  ofert_carousel_image_paths: (string | null)[];
};

async function deletePath(siteId: string, path: string) {
  const r = await fetch("/api/captura/ofert-carousel-delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ site_id: siteId, path }),
  });
  const j = (await r.json()) as { error?: string };
  if (!r.ok) throw new Error(j?.error || "Erro ao remover imagem do carrossel.");
}

/**
 * Uploads, remove e devolve os 4 slots para gravar em `ofert_carousel_image_paths` (jsonb).
 */
export async function persistOfertCarouselSlots(
  input: OfertCarouselPersistInput,
): Promise<OfertCarouselPersistResult> {
  const {
    siteId,
    ofertCarouselEnabled,
    ofertCarouselPosition,
    carouselSlotPath,
    carouselSlotFile,
    initialCarouselPaths,
  } = input;

  if (!ofertCarouselEnabled) {
    const toDelete = new Set<string>();
    for (let i = 0; i < 4; i++) {
      const was = initialCarouselPaths[i];
      if (was) toDelete.add(was);
      const cur = carouselSlotPath[i];
      if (cur) toDelete.add(cur);
    }
    for (const p of toDelete) {
      await deletePath(siteId, p);
    }
    return {
      ofert_carousel_enabled: false,
      ofert_carousel_position: ofertCarouselPosition,
      ofert_carousel_image_paths: [null, null, null, null],
    };
  }

  const hasAny =
    carouselSlotFile.some(Boolean) ||
    carouselSlotPath.some((x) => !!x) ||
    initialCarouselPaths.some((x) => !!x);
  if (!hasAny) {
    throw new Error("Ative o carrossel e envie pelo menos uma imagem, ou desative o carrossel.");
  }

  const next: (string | null)[] = [null, null, null, null];

  for (let i = 0; i < 4; i++) {
    const file = carouselSlotFile[i];
    const path = carouselSlotPath[i];
    const was = initialCarouselPaths[i];

    if (file) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("site_id", siteId);
      fd.append("slot", String(i));
      if (path) fd.append("old_path", path);
      const r = await fetch("/api/captura/ofert-carousel-upload", { method: "POST", body: fd });
      const j = (await r.json()) as { error?: string; path?: string };
      if (!r.ok) throw new Error(j?.error || "Erro no upload do carrossel.");
      if (!j.path) throw new Error("Resposta inválida do upload do carrossel.");
      next[i] = j.path;
    } else if (path) {
      next[i] = path;
    } else if (was) {
      await deletePath(siteId, was);
      next[i] = null;
    }
  }

  const anyFilled = next.some((x) => !!x);
  if (!anyFilled) {
    throw new Error("Envie pelo menos uma imagem no carrossel ou desative a opção.");
  }

  return {
    ofert_carousel_enabled: true,
    ofert_carousel_position: ofertCarouselPosition,
    ofert_carousel_image_paths: next,
  };
}
