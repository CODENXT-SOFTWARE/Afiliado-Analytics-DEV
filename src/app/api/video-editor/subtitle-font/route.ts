import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const FONT_SOURCES = [
  "https://raw.githubusercontent.com/google/fonts/main/apache/roboto/Roboto-Regular.ttf",
  "https://raw.githubusercontent.com/googlefonts/roboto-3-classic/main/src/hinted/Roboto-Regular.ttf",
];

/** Fonte TTF para legendas no export (FFmpeg WASM); busca no servidor evita 403 no cliente. */
export async function GET() {
  for (const url of FONT_SOURCES) {
    try {
      const res = await fetch(url, { next: { revalidate: 86400 } });
      if (!res.ok) continue;
      const buf = await res.arrayBuffer();
      if (buf.byteLength < 1000) continue;
      return new NextResponse(buf, {
        headers: {
          "Content-Type": "font/ttf",
          "Cache-Control": "public, max-age=86400",
        },
      });
    } catch {
      /* próxima URL */
    }
  }
  return NextResponse.json({ error: "Fonte indisponível" }, { status: 502 });
}
