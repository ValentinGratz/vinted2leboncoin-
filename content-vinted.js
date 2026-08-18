// content-vinted.js - v1.7.4 (fix)

function sendToBackground(type, payload) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, payload }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!response) {
        reject(new Error("Pas de réponse du background"));
        return;
      }
      resolve(response);
    });
  });
}

// Insertion sûre : jamais d'appendChild avec une string (SyntaxError sinon).
function safeInsert(targetEl, nodeOrHtml) {
  if (!targetEl) return;
  if (typeof nodeOrHtml === "string") {
    targetEl.insertAdjacentHTML("beforeend", nodeOrHtml);
  } else {
    targetEl.appendChild(nodeOrHtml);
  }
}

function extractId(url) {
  if (url) {
    const match = url.match(/\/items\/(\d+)/);
    if (match) return match[1];
  }
  return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString() + Math.random().toString(36).slice(2);
}

function extractItemFromArticle(article) {
  const link =
    article.querySelector('a[href*="/items/"]') ||
    (article.tagName === "A" && article.href ? article : null);

  if (!link) return null;

  const rawHref = link.getAttribute("href") || link.href;
  const url = rawHref.startsWith("http") ? rawHref : new URL(rawHref, location.origin).href;
  const id = extractId(url); // jamais undefined -> plus de put rejeté par IndexedDB

  const titleEl =
    article.querySelector('[data-testid$="--description-title"]') ||
    article.querySelector("h3, h2, [title]");
  const title = ((titleEl && (titleEl.getAttribute("title") || titleEl.textContent)) || "").trim().slice(0, 200);

  const priceEl = article.querySelector('[data-testid$="--price-text"]') || article.querySelector('[class*="price"]');
  const price = ((priceEl && priceEl.textContent) || "").trim().slice(0, 20);

  return { id, url, title, price, ts: Date.now() };
}

function scrapeArticles() {
  const nodes = document.querySelectorAll(
    'article[data-testid], a[href*="/items/"], div[data-testid*="item-box"]'
  );

  const items = [];
  const seen = new Set();

  nodes.forEach((node) => {
    const item = extractItemFromArticle(node);
    if (item && !seen.has(item.id)) {
      seen.add(item.id);
      items.push(item);
    }
  });

  return items;
}

async function updateVintedIdsIndex(newIds) {
  if (!newIds || newIds.length === 0) return;

  try {
    const existing = await new Promise((resolve) => {
      chrome.storage.local.get(["vintedIds"], (res) => resolve(res.vintedIds || []));
    });

    const idSet = new Set(existing);
    let changed = false;
    newIds.forEach((id) => {
      if (!idSet.has(id)) {
        idSet.add(id);
        changed = true;
      }
    });

    if (!changed) return;

    await sendToBackground("SAFE_SET", {
      vintedIds: Array.from(idSet),
      lastSync: Date.now(),
    });
  } catch (err) {
    console.error("[vinted2leboncoin] Échec mise à jour index vintedIds", err);
  }
}

async function syncScrapedItems() {
  const items = scrapeArticles();
  if (items.length === 0) return;

  const results = await Promise.allSettled(items.map((item) => sendToBackground("IDB_PUT", item)));

  const successfulIds = items
    .filter((_, idx) => results[idx].status === "fulfilled" && results[idx].value.success)
    .map((item) => item.id);

  const failedCount = items.length - successfulIds.length;
  if (failedCount > 0) {
    results.forEach((r, idx) => {
      if (r.status === "rejected") {
        console.error(`[vinted2leboncoin] IDB_PUT rejeté pour item ${items[idx].id}:`, r.reason);
      } else if (!r.value.success) {
        console.error(`[vinted2leboncoin] IDB_PUT échoué pour item ${items[idx].id}:`, r.value.error);
      }
    });
  }

  await updateVintedIdsIndex(successfulIds);

  // Log uniquement une fois les résultats connus, jamais avant.
  console.log(`[vinted2leboncoin] Sync: ${successfulIds.length}/${items.length} items sauvegardés en IndexedDB`);
}

async function getAllItems() {
  const response = await sendToBackground("IDB_GET_ALL");
  return response.success ? response.data : [];
}

// ---------------------------------------------------------------------------
// Transfert d'une fiche unique vers Leboncoin (pré-remplissage, pas de publication auto)
// ---------------------------------------------------------------------------

function isSingleItemPage() {
  return /^\/items\/\d+/.test(location.pathname);
}

function parseJsonLdProduct() {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent);
      const candidates = Array.isArray(data) ? data : [data];
      for (const c of candidates) {
        if (c && (c["@type"] === "Product" || c["@type"] === "Offer")) return c;
      }
    } catch (e) {
      // JSON-LD malformé, on ignore et on retombe sur le DOM
    }
  }
  return null;
}

function getImgUrl(img) {
  const candidate =
    img.currentSrc ||
    img.getAttribute("data-src") ||
    img.getAttribute("data-original") ||
    img.src ||
    (img.getAttribute("data-srcset") && img.getAttribute("data-srcset").split(",")[0].trim().split(" ")[0]) ||
    (img.srcset && img.srcset.split(",")[0].trim().split(" ")[0]);

  if (!candidate || candidate.startsWith("data:")) return null; // placeholder lazy-load, pas une vraie image
  return candidate;
}

function extractSingleItemData() {
  const ld = parseJsonLdProduct();

  let title = ld && ld.name;
  let description = ld && ld.description;
  let price =
    ld && ld.offers && (ld.offers.price || (Array.isArray(ld.offers) && ld.offers[0] && ld.offers[0].price));

  if (!title) {
    const titleEl = document.querySelector('h1, [data-testid="item-page-summary-plugin"] h1, [itemprop="name"]');
    title = (titleEl && titleEl.textContent || "").trim();
  }

  if (!description) {
    const descEl = document.querySelector(
      '[data-testid="item-description-content"], [itemprop="description"], [class*="description"]'
    );
    description = (descEl && descEl.textContent || "").trim();
  }

  if (!price) {
    const priceEl = document.querySelector('[data-testid$="price"], [itemprop="price"], [class*="price"]');
    price = (priceEl && (priceEl.getAttribute("content") || priceEl.textContent) || "").trim();
  }

  // Sélecteur exact confirmé sur le DOM Vinted (data-testid="item-photo-N--img"),
  // en priorité absolue avant le fallback générique.
  const exactImages = Array.from(document.querySelectorAll('img[data-testid^="item-photo-"]'))
    .map(getImgUrl)
    .filter(Boolean);

  // Le JSON-LD ne contient souvent qu'une seule image "principale" -> on
  // fusionne toujours avec les vignettes du DOM (galerie/carrousel), en
  // gérant le lazy-loading (data-src) qui piège un scrape src-only.
  const domImages = Array.from(
    document.querySelectorAll(
      '[data-testid*="gallery"] img, [data-testid*="photo"] img, [class*="gallery"] img, ' +
        '[class*="carousel"] img, [class*="thumbnail"] img, [role="listitem"] img, ' +
        'button img, li img, img[srcset], img[data-src]'
    )
  )
    .map(getImgUrl)
    .filter(Boolean);

  const ldImages = ld && ld.image ? (Array.isArray(ld.image) ? ld.image : [ld.image]) : [];

  const images = Array.from(new Set([...exactImages, ...domImages, ...ldImages])).slice(0, 20);

  console.log(`[vinted2leboncoin] Extraction images: ${exactImages.length} exact, ${domImages.length} générique, ${images.length} au total après dédup`);

  return {
    sourceUrl: location.href,
    title: String(title || "").trim().slice(0, 200),
    description: String(description || "").trim().slice(0, 4000),
    price: String(price || "").replace(/[^\d,.\s€]/g, "").trim(),
    images,
    ts: Date.now(),
  };
}

function injectLeboncoinTransferButton() {
  if (document.getElementById("vc-lbc-transfer-btn")) return; // déjà injecté

  const anchor =
    document.querySelector('[data-testid="item-page-summary-plugin"]') ||
    document.querySelector("h1")?.closest("div") ||
    document.body;

  if (!anchor) return;

  safeInsert(
    anchor,
    `<button id="vc-lbc-transfer-btn" style="
        margin:10px 0;padding:10px 14px;background:#ff6e14;color:#fff;border:none;
        border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;
      ">Envoyer vers Leboncoin</button>`
  );

  const btn = document.getElementById("vc-lbc-transfer-btn");
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    btn.textContent = "Préparation...";

    try {
      const payload = extractSingleItemData();
      if (!payload.title) {
        throw new Error("Impossible d'extraire le titre de l'annonce");
      }

      const res = await sendToBackground("LBC_PREPARE", payload);
      if (!res.success) throw new Error(res.error || "Échec préparation");

      btn.textContent = "Ouverture Leboncoin...";
      window.open("https://www.leboncoin.fr/deposer-une-annonce", "_blank");

      setTimeout(() => {
        btn.textContent = "Envoyer vers Leboncoin";
        btn.disabled = false;
      }, 2000);
    } catch (err) {
      console.error("[vinted2leboncoin] Échec transfert vers Leboncoin", err);
      btn.textContent = "Erreur, réessayer";
      btn.disabled = false;
    }
  });
}

function init() {
  syncScrapedItems();

  if (isSingleItemPage()) {
    injectLeboncoinTransferButton();
  }

  const observer = new MutationObserver(() => {
    clearTimeout(init._debounce);
    init._debounce = setTimeout(() => {
      syncScrapedItems();
      if (isSingleItemPage()) injectLeboncoinTransferButton();
    }, 800);
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
