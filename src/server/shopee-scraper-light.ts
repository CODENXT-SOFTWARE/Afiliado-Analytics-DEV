/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
/**
 * Shopee product scraper — works on localhost AND Vercel serverless.
 *
 * Stack:
 *   puppeteer-extra + stealth  → anti-bot bypass
 *   puppeteer                  → peer for puppeteer-extra
 *   puppeteer-core             → lightweight launch API
 *   @sparticuz/chromium        → serverless Chromium binary
 *
 * All listed in next.config.ts → serverExternalPackages so
 * Next.js does NOT try to bundle them (avoids CJS resolution errors).
 *
 * On Vercel: set env var  PUPPETEER_SKIP_DOWNLOAD = 1
 */

const VIDEO_RE = /\.(mp4|m3u8|webm|ts)(\?|$)/i;

type MediaItem = { url: string; type: "image" | "video"; label: string };
type ScrapeResult = { productName: string; media: MediaItem[]; error?: string };

function fullSize(url: string): string {
  return url.replace(/@resize_w\d+[^.]*/g, "").replace(/_tn(\.\w+)$/, "$1");
}

function isJunk(url: string): boolean {
  return /icon|logo|badge|payment|pix|boleto|qrcode|banner|sprite|favicon|placeholder|seller_avatar|shop_avatar|flag|social|facebook|instagram|tiktok|twitter/i.test(url);
}

async function getBrowser(): Promise<any> {
  const puppeteer = require("puppeteer-extra");
  const StealthPlugin = require("puppeteer-extra-plugin-stealth");
  puppeteer.use(StealthPlugin());

  const isVercel = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

  if (isVercel) {
    const chromium = require("@sparticuz/chromium");
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      defaultViewport: { width: 1280, height: 800 },
    });
  }

  const fs = require("fs");
  const paths = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    process.env.CHROME_EXECUTABLE_PATH ?? "",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter(Boolean);

  let exe = "";
  for (const p of paths) {
    if (fs.existsSync(p)) { exe = p; break; }
  }
  if (!exe) throw new Error("Chrome não encontrado. Instale Google Chrome ou defina CHROME_EXECUTABLE_PATH.");

  return puppeteer.launch({
    executablePath: exe,
    headless: "shell",
    args: [
      "--no-sandbox", "--disable-setuid-sandbox",
      "--disable-dev-shm-usage", "--disable-gpu",
      "--disable-blink-features=AutomationControlled",
      "--window-size=1280,800",
    ],
    defaultViewport: { width: 1280, height: 800 },
  });
}

export async function scrape(url: string): Promise<ScrapeResult> {
  let browser: any = null;

  try {
    browser = await getBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setRequestInterception(true);

    const videos = new Set<string>();
    const images = new Set<string>();
    const apiVideoUrls: string[] = [];

    const extractFromData = (data: any) => {
      if (!data || typeof data !== "object") return;
      const list = data.video_info_list ?? data.video_info ?? data.videos ?? data.video_list ?? [];
      const arr = Array.isArray(list) ? list : [list].filter(Boolean);
      for (const vi of arr) {
        const vUrl = vi?.default_format?.url || vi?.video_url || vi?.url || vi?.src || "";
        if (vUrl && VIDEO_RE.test(vUrl))
          apiVideoUrls.push(vUrl.startsWith("//") ? "https:" + vUrl : vUrl);
        const thumb = vi?.thumb_url || vi?.cover || vi?.thumbnail || "";
        if (thumb)
          images.add(fullSize(thumb.startsWith("//") ? "https:" + thumb : thumb));
      }
      if (data.video_url) {
        const v = data.video_url;
        if (typeof v === "string" && VIDEO_RE.test(v))
          apiVideoUrls.push(v.startsWith("//") ? "https:" + v : v);
        else if (v?.url)
          apiVideoUrls.push(v.url.startsWith("//") ? "https:" + v.url : v.url);
      }
      if (Array.isArray(data.images)) {
        for (const h of data.images) {
          if (typeof h !== "string") continue;
          const u = h.startsWith("http") ? h : `https://down-br.img.susercontent.com/file/${h}`;
          if (!isJunk(u)) images.add(u);
        }
      }
    };

    const CDN_RE = /susercontent\.com|cv\.shopee|cvf\.shopee|down-.*\.img|down-.*\.vod|shopee\.(com|com\.br)|vod\.shopee/i;

    page.on("request", (req: any) => {
      const u: string = req.url();
      const t: string = req.resourceType();
      if (t === "font") { req.abort(); return; }
      if (CDN_RE.test(u) || u.includes("shopee")) {
        if (VIDEO_RE.test(u) || t === "media" || u.includes("/video/") || u.includes(".vod.")) {
          videos.add(u.split("?")[0]);
        } else if (u.includes("/file/") && /\.(jpg|jpeg|png|webp|gif)/i.test(u) && !isJunk(u)) {
          images.add(fullSize(u));
        }
      }
      req.continue();
    });

    page.on("response", async (response: any) => {
      const u: string = response.url();
      const isItem = /item\/get|pdp\/get|product\/detail|v4\/item|v2\/item|get_item|item_detail/i.test(u) ||
        (u.includes("shopee") && (u.includes("item") || u.includes("pdp") || u.includes("product")));
      if (!isItem) return;
      try {
        const json = await response.json();
        const data = json.data ?? json;
        extractFromData(data);
        if (data.item_detail) extractFromData(data.item_detail);
        if (data.item) extractFromData(data.item);
      } catch { /* not JSON */ }
    });

    try { await page.goto(url, { waitUntil: "networkidle2", timeout: 25000 }); }
    catch { /* partial load OK */ }

    try { await page.waitForSelector('img[src*="susercontent"]', { timeout: 10000 }); }
    catch { /* best effort */ }

    try {
      const embedded: string[] = await page.evaluate(() => {
        const out: string[] = [];
        for (const s of document.querySelectorAll('script[type="application/json"], script#__NEXT_DATA__')) {
          try {
            const walk = (o: any): void => {
              if (!o || typeof o !== "object") return;
              if (Array.isArray(o)) { o.forEach(walk); return; }
              if (o.video_info_list) for (const vi of o.video_info_list) {
                const u = vi.default_format?.url || vi.video_url || vi.url;
                if (u && /\.(mp4|m3u8|webm)/i.test(u)) out.push(u.startsWith("//") ? "https:" + u : u);
              }
              if (typeof o.video_url === "string" && /\.(mp4|m3u8|webm)/i.test(o.video_url))
                out.push(o.video_url.startsWith("//") ? "https:" + o.video_url : o.video_url);
              Object.values(o).forEach(walk);
            };
            walk(JSON.parse(s.textContent || "{}"));
          } catch { /* skip */ }
        }
        return [...new Set(out)];
      });
      embedded.forEach((v) => apiVideoUrls.push(v));
    } catch { /* best effort */ }

    await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img[src*="susercontent"]'));
      if (imgs[0]) (imgs[0] as HTMLElement).click();
    });
    await new Promise((r) => setTimeout(r, 2000));

    await page.evaluate(() => {
      document.querySelectorAll('video, [class*="play"], [class*="video-player"], [aria-label*="video"]')
        .forEach((el: any) => { try { el.click(); } catch {} });
      document.querySelectorAll('[class*="carousel"] img, [class*="thumbnail"] img, [class*="gallery"] img')
        .forEach((el: any, i: number) => { if (i < 3) try { el.click(); } catch {} });
    });
    await new Promise((r) => setTimeout(r, 3000));

    const domImgs: string[] = await page.evaluate(() =>
      Array.from(document.querySelectorAll('img[src*="susercontent"]'))
        .map((i: any) => i.src).filter((s: string) => s.includes("/file/"))
    );
    for (const img of domImgs) { const u = fullSize(img); if (!isJunk(u)) images.add(u); }

    const domVids: string[] = await page.evaluate(() =>
      Array.from(document.querySelectorAll("video, video source"))
        .map((el: any) => el.src || el.getAttribute("src") || "")
        .filter((s: string) => s && !s.startsWith("blob:"))
    );
    for (const v of domVids) videos.add(v);
    for (const v of apiVideoUrls) videos.add(v);

    const productName: string = await page.evaluate(() => {
      for (const sel of ['[data-sqe="name"]', "h1", '[class*="AttrsTitle"]', '[class*="product-title"]']) {
        const el = document.querySelector(sel);
        if (el?.textContent && el.textContent.trim().length > 3) return el.textContent.trim();
      }
      return "";
    });

    const media: MediaItem[] = [];
    [...videos].forEach((u, i) => media.push({ url: u, type: "video", label: `Vídeo ${i + 1}` }));
    [...images].filter((u) => !isJunk(u)).slice(0, 20)
      .forEach((u, i) => media.push({ url: u, type: "image", label: `Imagem ${i + 1}` }));

    return { productName: productName || "Produto Shopee", media };
  } catch (e: any) {
    return { productName: "Produto Shopee", media: [], error: e?.message ?? "Erro ao acessar Shopee" };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
