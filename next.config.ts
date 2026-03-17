// next.config.ts
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

// __dirname compatível com ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Raiz do projeto
const root = __dirname;

// Subdomínio que vai servir apenas páginas de captura
const CAPTURE_HOST = "s.afiliadoanalytics.com.br";

// slug = 1 segmento só (sem /) e bloqueando prefixes reservados
const SLUG_SOURCE =
  "/:slug((?!api|_next|favicon\\.ico|robots\\.txt|sitemap\\.xml|manifest\\.json|capture|dashboard)[^/]+)";

const nextConfig: NextConfig = {
  turbopack: { root },
  outputFileTracingRoot: root,

  webpack: (config) => {
    config.module ??= {};
    (config.module as { exprContextCritical?: boolean }).exprContextCritical = false;
    return config;
  },

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.pravatar.cc", port: "", pathname: "/**" },
      { protocol: "https", hostname: "i.imgur.com", port: "", pathname: "/**" },
      // Supabase Storage
      { protocol: "https", hostname: "odydavjdtnoozcrcohfi.supabase.co", port: "", pathname: "/storage/**" },
    ],
  },

  async rewrites() {
    return {
      beforeFiles: [
        // Proxy FFmpeg UMD (mesma origem para Worker evitar CORS no editor de vídeo)
        {
          source: "/ffmpeg/:path*",
          destination: "https://unpkg.com/@ffmpeg/ffmpeg@0.12.6/dist/umd/:path*",
        },
        {
          source: "/ffmpeg-core/:path*",
          destination: "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/:path*",
        },
        // Fonte para legendas no export (evita CORS)
        {
          source: "/fonts/subtitle-font.ttf",
          destination: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/roboto/Roboto-Regular.ttf",
        },
        // https://s.afiliadoanalytics.com.br/<slug>/go  ->  /capture/<slug>/go
        {
          source: `${SLUG_SOURCE}/go`,
          has: [{ type: "host", value: CAPTURE_HOST }],
          destination: "/capture/:slug/go",
        },

        // https://s.afiliadoanalytics.com.br/<slug>  ->  /capture/<slug>
        {
          source: SLUG_SOURCE,
          has: [{ type: "host", value: CAPTURE_HOST }],
          destination: "/capture/:slug",
        },
      ],
    };
  },

  async redirects() {
    return [
      // Opcional: se alguém acessar /capture/<slug> no subdomínio, manda para URL limpa
      {
        source: "/capture/:slug",
        has: [{ type: "host", value: CAPTURE_HOST }],
        destination: "/:slug",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
