/**
 * Standalone Shopee scraper using puppeteer-extra + stealth.
 * Usage: node scripts/shopee-scraper.cjs <url>
 * Outputs JSON: { productName, media: [{ url, type, label }] }
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const VIDEO_RE = /\.(mp4|m3u8|webm|ts)(\?|$)/i;
const CDN_RE = /susercontent\.com|cv\.shopee|cvf\.shopee|down-.*\.img|down-.*\.vod|shopee\.(com|com\.br)|vod\.shopee/i;

function fullSizeUrl(url) {
  return url.replace(/@resize_w\d+[^.]*/g, '').replace(/_tn(\.\w+)$/, '$1');
}

async function scrape(url) {
  const videos = new Set();
  const images = new Set();
  const apiVideoUrls = [];

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1280,800'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setRequestInterception(true);

    // Intercept network requests
    page.on('request', (req) => {
      const u = req.url();
      const t = req.resourceType();
      if (t === 'font') { req.abort(); return; }

      if (CDN_RE.test(u) || u.includes('shopee')) {
        if (VIDEO_RE.test(u) || t === 'media' || u.includes('/video/') || u.includes('.vod.') || u.includes('vod.')) {
          videos.add(u.split('?')[0]);
        } else if (u.includes('/file/') && /\.(jpg|jpeg|png|webp|gif)/i.test(u) && !u.includes('icon') && !u.includes('favicon')) {
          images.add(fullSizeUrl(u));
        }
      }
      req.continue();
    });

    // Intercept API responses for video URLs (vários formatos da Shopee)
    function extractVideosFromData(data) {
      if (!data || typeof data !== 'object') return;
      const list = data.video_info_list || data.video_info || data.videos || data.video_list || [];
      const arr = Array.isArray(list) ? list : [list].filter(Boolean);
      for (const vi of arr) {
        const vUrl = (vi.default_format && vi.default_format.url) || vi.video_url || vi.url || vi.src || '';
        if (vUrl && VIDEO_RE.test(vUrl)) apiVideoUrls.push(vUrl.startsWith('//') ? 'https:' + vUrl : vUrl);
        const thumbUrl = vi.thumb_url || vi.cover || vi.thumbnail || '';
        if (thumbUrl) images.add(fullSizeUrl(thumbUrl.startsWith('//') ? 'https:' + thumbUrl : thumbUrl));
      }
      if (data.video_url) {
        const v = data.video_url;
        if (typeof v === 'string' && VIDEO_RE.test(v)) apiVideoUrls.push(v.startsWith('//') ? 'https:' + v : v);
        else if (v && v.url) apiVideoUrls.push(v.url.startsWith('//') ? 'https:' + v.url : v.url);
      }
      if (data.images) {
        for (const imgHash of data.images) {
          const imgUrl = `https://down-br.img.susercontent.com/file/${imgHash}`;
          images.add(imgUrl);
        }
      }
    }

    page.on('response', async (response) => {
      const u = response.url();
      const isItemApi = /item\/get|pdp\/get|product\/detail|v4\/item|v2\/item|api\.shopee|get_item|item_detail/i.test(u) ||
        (u.includes('shopee') && (u.includes('item') || u.includes('pdp') || u.includes('product')));
      if (!isItemApi) return;
      try {
        const json = await response.json();
        const data = json.data ?? json;
        extractVideosFromData(data);
        if (data.item_detail) extractVideosFromData(data.item_detail);
        if (data.item) extractVideosFromData(data.item);
      } catch { /* not JSON */ }
    });

    // Navigate
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 25000 });
    } catch { /* partial load ok */ }

    // Wait for images to render
    try {
      await page.waitForSelector('img[src*="susercontent"]', { timeout: 10000 });
    } catch { /* best effort */ }

    // Extrair vídeos de dados pré-carregados na página (Shopee usa dados embutidos)
    try {
      const embeddedVideos = await page.evaluate(() => {
        const out = [];
        const scripts = document.querySelectorAll('script[type="application/json"], script#__NEXT_DATA__');
        for (const script of scripts) {
          try {
            const data = JSON.parse(script.textContent || '{}');
            const walk = (obj) => {
              if (!obj || typeof obj !== 'object') return;
              if (Array.isArray(obj)) { obj.forEach(walk); return; }
              if (obj.video_info_list) {
                (obj.video_info_list || []).forEach(vi => {
                  const u = vi.default_format?.url || vi.video_url || vi.url;
                  if (u && /\.(mp4|m3u8|webm)/i.test(u)) out.push(u.startsWith('//') ? 'https:' + u : u);
                });
              }
              if (obj.video_url && typeof obj.video_url === 'string' && /\.(mp4|m3u8|webm)/i.test(obj.video_url)) {
                out.push(obj.video_url.startsWith('//') ? 'https:' + obj.video_url : obj.video_url);
              }
              Object.values(obj).forEach(walk);
            };
            walk(data);
          } catch {}
        }
        return [...new Set(out)];
      });
      embeddedVideos.forEach(v => apiVideoUrls.push(v));
    } catch { /* best effort */ }

    // Click on thumbnails to trigger video loading
    await page.evaluate(() => {
      // Click first carousel thumbnail (video thumb is usually first)
      const allImgs = Array.from(document.querySelectorAll('img[src*="susercontent"]'));
      if (allImgs.length > 0) allImgs[0].click();
    });
    await new Promise(r => setTimeout(r, 2000));

    // Try clicking play button / video element e qualquer thumbnail do carrossel
    await page.evaluate(() => {
      const playElements = document.querySelectorAll('video, [class*="play"], [class*="video-player"], [aria-label*="video"], [aria-label*="play"], [class*="ProductVideo"]');
      playElements.forEach(el => { try { el.click(); } catch {} });
      const svgs = document.querySelectorAll('svg');
      svgs.forEach(svg => {
        if (svg.closest('[class*="video"]') || svg.closest('[class*="play"]') || svg.closest('button')) {
          try { svg.click(); svg.parentElement?.click(); } catch {}
        }
      });
      document.querySelectorAll('[class*="carousel"] img, [class*="thumbnail"] img, [class*="gallery"] img').forEach((img, i) => { if (i < 3) try { img.click(); } catch {} });
    });
    await new Promise(r => setTimeout(r, 3000));
    await page.evaluate(() => {
      document.querySelectorAll('video').forEach(v => { try { v.play(); } catch {} });
    });
    await new Promise(r => setTimeout(r, 3000));

    // Gather DOM images
    const domImgs = await page.evaluate(() =>
      Array.from(document.querySelectorAll('img[src*="susercontent"]'))
        .map(i => i.src)
        .filter(s => s.includes('/file/'))
    );
    for (const img of domImgs) images.add(fullSizeUrl(img));

    // Gather DOM video sources
    const domVids = await page.evaluate(() =>
      Array.from(document.querySelectorAll('video, video source'))
        .map(el => el.src || el.getAttribute('src'))
        .filter(s => s && !s.startsWith('blob:'))
    );
    for (const v of domVids) videos.add(v);

    // Add API-found videos
    for (const v of apiVideoUrls) videos.add(v);

    // Product name
    const productName = await page.evaluate(() => {
      for (const sel of ['[data-sqe="name"]', 'h1', '[class*="AttrsTitle"]', '[class*="product-title"]']) {
        const el = document.querySelector(sel);
        if (el?.textContent && el.textContent.trim().length > 3) return el.textContent.trim();
      }
      return '';
    });

    // Build result
    const media = [];
    [...videos].forEach((u, i) => media.push({ url: u, type: 'video', label: `Vídeo ${i + 1}` }));
    [...images].slice(0, 20).forEach((u, i) => media.push({ url: u, type: 'image', label: `Imagem ${i + 1}` }));

    return { productName: productName || 'Produto Shopee', media };
  } finally {
    await browser.close();
  }
}

const url = process.argv[2];
if (!url) {
  process.stdout.write(JSON.stringify({ error: 'URL required' }));
  process.exit(1);
}

scrape(url)
  .then(r => { process.stdout.write(JSON.stringify(r)); process.exit(0); })
  .catch(e => { process.stdout.write(JSON.stringify({ error: e.message || 'Falha' })); process.exit(0); });
