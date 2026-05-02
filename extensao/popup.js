"use strict";

function encodeSessionToken(input) {
  return btoa(unescape(encodeURIComponent(input)));
}

function fetchCookie(siteUrl, cookieName) {
  return new Promise((resolve) => {
    chrome.cookies.get({ url: siteUrl, name: cookieName }, (result) => {
      resolve(result ?? null);
    });
  });
}

async function fetchMultipleCookies(siteUrl, names) {
  const entries = await Promise.all(
    names.map(async (name) => {
      const cookie = await fetchCookie(siteUrl, name);
      return [name, cookie?.value ?? null];
    })
  );
  return Object.fromEntries(entries.filter(([, v]) => v !== null));
}

const ui = {
  status:   document.getElementById("statusMsg"),
  domain:   document.getElementById("domainText"),
  dot:      document.getElementById("domainDot"),
  output:   document.getElementById("tokenOutput"),
  copyBtn:  document.getElementById("btnCopyToken"),
  navLinks: document.getElementById("navLinks"),
};

// Helpers para controlar a bolinha
function setDotGreen() {
  ui.dot.classList.remove("dot-error");
}

function setDotRed() {
  ui.dot.classList.add("dot-error");
}

ui.copyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(ui.output.value);
    ui.status.textContent = "✓ Token copiado para a área de transferência.";
  } catch {
    ui.status.textContent = "✗ Não foi possível copiar o token.";
  }
});

async function init() {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!activeTab?.url) {
    setDotRed();
    ui.status.textContent = "Não foi possível identificar a aba ativa.";
    return;
  }

  const currentUrl = activeTab.url;

  // ── Mercado Livre ──────────────────────────────────────────────────
  if (currentUrl.includes("mercadolivre.com.br")) {
    setDotGreen();
    ui.domain.textContent = "Mercado Livre detectado";
    ui.status.textContent = "Buscando sessão...";
    ui.navLinks.style.display = "none";

    const sessionCookie = await fetchCookie("https://www.mercadolivre.com.br/", "ssid");

    if (!sessionCookie?.value) {
      setDotRed();
      ui.status.textContent = "Sessão não encontrada. Você está logado?";
      ui.output.value = "";
      ui.copyBtn.disabled = true;
      return;
    }

    const rawSession = `ssid=${sessionCookie.value}`;
    ui.output.value  = encodeSessionToken(rawSession);
    ui.copyBtn.disabled = false;
    ui.status.textContent = "✓ Token gerado com sucesso.";
    return;
  }

  // ── Amazon ─────────────────────────────────────────────────────────
  if (currentUrl.includes("amazon.com.br")) {
    setDotGreen();
    ui.domain.textContent = "Amazon detectada";
    ui.status.textContent = "Buscando sessão...";
    ui.navLinks.style.display = "none";

    // Cookies necessários pro app:
    //   - SERP (busca de produtos): basta `at-acbbr` + `ubid-acbbr` + `x-acbbr`.
    //   - SiteStripe (encurtador `amzn.to`): precisa também de `session-id`,
    //     `session-token` e `sst-acbbr` (server-side token); senão a Amazon
    //     deixa a request pendurada até o timeout.
    const TARGET_COOKIES = [
      "session-id",
      "session-id-time",
      "session-token",
      "ubid-acbbr",
      "x-acbbr",
      "at-acbbr",
      "sess-at-acbbr",
      "sst-acbbr",
      "lc-acbbr",
      "i18n-prefs",
      "sso-state-acbbr",
    ];
    const found = await fetchMultipleCookies("https://www.amazon.com.br/", TARGET_COOKIES);

    if (!found["ubid-acbbr"] && !found["at-acbbr"]) {
      setDotRed();
      ui.status.textContent = "Sessão não encontrada. Você está logado na Amazon?";
      ui.output.value = "";
      ui.copyBtn.disabled = true;
      return;
    }

    // Alguns cookies vêm com aspas no value original (x-acbbr, session-token).
    // Mantemos as aspas pra que o header `Cookie:` reflita exatamente o que a
    // Amazon devolveu — caso contrário a validação CSRF do SiteStripe falha.
    const QUOTE_VALUE = new Set(["x-acbbr", "session-token"]);
    const parts = [];
    for (const name of TARGET_COOKIES) {
      const v = found[name];
      if (!v) continue;
      const value = QUOTE_VALUE.has(name) && !v.startsWith('"') ? `"${v}"` : v;
      parts.push(`${name}=${value}`);
    }

    const missingForSitestripe = ["session-id", "session-token", "sst-acbbr"].filter(
      (n) => !found[n],
    );
    ui.output.value     = encodeSessionToken(parts.join("; "));
    ui.copyBtn.disabled = false;
    if (missingForSitestripe.length > 0) {
      ui.status.textContent =
        "✓ Token gerado, mas faltam cookies (" +
        missingForSitestripe.join(", ") +
        "). Encurtador amzn.to pode falhar — re-logue na Amazon.";
    } else {
      ui.status.textContent = "✓ Token completo da Amazon gerado.";
    }
    return;
  }

  // ── Site não suportado ─────────────────────────────────────────────
  setDotRed();
  ui.domain.textContent   = "Site não suportado";
  ui.status.textContent   = "Para capturar seu token, acesse o Mercado Livre ou a Amazon.";
  ui.output.value         = "";
  ui.copyBtn.disabled     = true;
  ui.navLinks.style.display = "flex";
}

document.addEventListener("DOMContentLoaded", init);