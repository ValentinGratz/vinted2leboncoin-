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
