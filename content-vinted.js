// content-vinted.js - v1.7.4
// Ne touche jamais IndexedDB ni storage.local directement : passe par le background.

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

function extractIdFromUrl(url) {
  if (!url) return null;
  const match = url.match(/\/items\/(\d+)/);
  return match ? match[1] : null;
}

function extractItemFromArticle(article) {
  const link =
    article.querySelector('a[href*="/items/"]') ||
    (article.tagName === "A" && article.href ? article : null);

  if (!link) return null;

  const url = link.href.startsWith("http") ? link.href : new URL(link.getAttribute("href"), location.origin).href;
  const id = extractIdFromUrl(url);
  if (!id) return null;

  const titleEl =
    article.querySelector('[data-testid$="--description-title"]') ||
    article.querySelector("h3, h2, [title]");
  const title = (titleEl && (titleEl.getAttribute("title") || titleEl.textContent) || "").trim();

  const priceEl = article.querySelector('[data-testid$="--price-text"]') || article.querySelector('[class*="price"]');
  const price = (priceEl && priceEl.textContent || "").trim();

  return { id, url, title, price };
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

  const putResults = await Promise.allSettled(items.map((item) => sendToBackground("IDB_PUT", item)));

  const successfulIds = items
    .filter((_, idx) => putResults[idx].status === "fulfilled" && putResults[idx].value.success)
    .map((item) => item.id);

  await updateVintedIdsIndex(successfulIds);

  console.log(`[vinted2leboncoin] Sync: ${successfulIds.length}/${items.length} items sauvegardés en IndexedDB`);
}

async function getAllItems() {
  const response = await sendToBackground("IDB_GET_ALL");
  return response.success ? response.data : [];
}

// Lancement initial + observation des changements DOM (chargement infini / pagination dynamique)
function init() {
  syncScrapedItems();

  const observer = new MutationObserver(() => {
    clearTimeout(init._debounce);
    init._debounce = setTimeout(syncScrapedItems, 800);
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
