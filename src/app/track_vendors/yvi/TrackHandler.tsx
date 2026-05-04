"use client";

/**
 * Lê o parâmetro `?track=<nome>` da URL e grava como cookie
 * `signup_track` (TTL 30 dias). O cookie depois é lido pelo backend
 * no POST `/api/auth/signup-trial`, que persiste o valor em
 * `profiles.user_track` no momento da criação da conta.
 *
 * - Roda só client-side (cookie precisa do `document.cookie`).
 * - Usa `useSearchParams`, que em Next 15 exige `<Suspense>` no caller.
 * - Validação: aceita apenas `^[a-zA-Z0-9_-]{1,40}$` pra evitar que
 *   alguém injete payload arbitrário no cookie via URL.
 * - Não faz nada se a URL não tem `?track=` — preserva cookie anterior
 *   (a pessoa pode ter visitado outra página da Yvi antes; manter o
 *   tracking ativo até expirar é o comportamento esperado).
 *
 * Render: nada. Componente puramente funcional.
 */

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

const SAFE_TRACK = /^[a-zA-Z0-9_-]{1,40}$/;
const COOKIE_NAME = "signup_track";
const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 dias

export default function TrackHandler() {
  const searchParams = useSearchParams();
  const rawTrack = searchParams.get("track")?.trim() ?? "";

  useEffect(() => {
    if (!rawTrack || !SAFE_TRACK.test(rawTrack)) return;
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(rawTrack)}; path=/; max-age=${TTL_SECONDS}; SameSite=Lax`;
  }, [rawTrack]);

  return null;
}
