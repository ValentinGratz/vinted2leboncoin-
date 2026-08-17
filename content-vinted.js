// content-vinted.js - FIX kQuotaBytes quota exceeded
// On ne stocke PLUS les images en base64, uniquement les URLs

async function scrapeVintedData() {
  const title = document.querySelector('h1')?.innerText?.trim() || "";
  const priceEl = document.querySelector('[data-testid*="price"]') || document.querySelector('.c-box__price');
  const price = priceEl?.innerText?.trim() || "";
  const description = document.querySelector('[itemprop="description"]')?.innerText || document.querySelector('[data-testid="description"]')?.innerText || "";

  // Récupère uniquement les URLs HD (pas les blobs)
  const imageUrls = [...document.querySelectorAll('img')].map(i => i.src).filter(src => src.includes('vinted') && src.includes('f800')).slice(0, 8);
  // fallback si pas de f800
  const finalUrls = imageUrls.length ? imageUrls : [...document.querySelectorAll('[data-testid="photo"] img')].map(i=>i.src).slice(0,8);

  const item = {
    id: Date.now(),
    title: title,
    price: price,
    description: description,
    imageUrls: finalUrls, // <--- 2 Ko au lieu de 10 Mo
    url: window.location.href,
    date: Date.now()
  };

  const { history = [] } = await chrome.storage.local.get("history");
  history.push(item);
  // On garde 10 max, pas 50 -> plus de quota
  const trimmed = history.slice(-10);

  await chrome.storage.local.set({ history: trimmed });
  console.log("[V2L] Scrapé sans quota:", item);
  return item;
}

// Ton bouton existant appelle scrapeVintedData()
