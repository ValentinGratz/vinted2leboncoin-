// content-vinted.js - v3.3 FINAL FIX #6 + single photo
(() => {
  if (window.__VINTED2LEBONCOIN_INJECTED__) return;
  window.__VINTED2LEBONCOIN_INJECTED__ = true;

  function getVintedItemId() {
    return window.location.pathname.match(/\/items\/(\d+)/)?.[1] || null;
  }

  async function getVintedPhotosViaAPI(itemId) {
    try {
      const res = await fetch(`https://www.vinted.fr/api/v2/items/${itemId}`, {
        headers: { 'Accept': 'application/json' },
        credentials: 'include'
      });
      if (!res.ok) return null;
      const json = await res.json();
      const photos = json.item?.photos || json.photos || [];
      if (!photos.length) return null;
      return photos.map(p => (p.full_size_url || p.url || '').split('?')[0]).filter(Boolean);
    } catch { return null; }
  }

  function getCleanPhotosFromDOM() {
    // Sélecteurs Vinted - pas de filtre /products/ obligatoire, blacklist seulement
    const selectors = [
      '[data-testid="item-photo"] img',
      '[data-testid="carousel"] img',
      '.item-photos img',
      '[data-testid="image-gallery"] img',
      'div[data-testid="item-photo"] div[style*="background-image"]'
    ];
    
    let raw = [];
    
    // 1. img classiques
    raw = [...document.querySelectorAll(selectors.join(','))]
      .map(el => {
        if (el.tagName === 'IMG') return el.src || el.dataset.src || el.currentSrc || '';
        // div avec background-image
        const style = el.getAttribute('style') || '';
        const m = style.match(/url\(["']?(.*?)["']?\)/);
        return m ? m[1] : '';
      })
      .filter(Boolean);

    // 2. Si 0 => fallback large pour annonces 1 photo
    if (raw.length === 0) {
      raw = [...document.querySelectorAll('img')]
        .filter(img => {
          const src = (img.src || '').toLowerCase();
          if (!src.includes('vinted')) return false;
          if ((img.naturalWidth||img.width) < 150) return false;
          return true;
        })
        .map(i => i.src);
    }

    // 3. og:image en dernier recours (toujours présent sur Vinted)
    if (raw.length === 0) {
      const og = document.querySelector('meta[property="og:image"]')?.content;
      if (og) raw = [og];
    }

    const blacklist = ['avatar','logo','icon','app-store','google-play','badge','profile','user-avatar','dots','placeholder','notification'];
    return raw
      .map(u => u.split('?')[0])
      .filter(u => !blacklist.some(b => u.toLowerCase().includes(b)))
      .filter((u,i,s) => s.indexOf(u) === i)
      .map(u => u.replace(/\/s\d+\//, '/f800/'))
      .slice(0, 20);
  }

  async function getCleanPhotos() {
    const id = getVintedItemId();
    if (id) {
      const api = await getVintedPhotosViaAPI(id);
      if (api?.length) {
        console.log(`[V2L] ${api.length} photos via API`);
        return api;
      }
    }
    const dom = getCleanPhotosFromDOM();
    console.log(`[V2L] ${dom.length} photos via DOM`, dom);
    return dom;
  }

  function extractData() {
    const title = document.querySelector('[data-testid="item-title"]')?.innerText?.trim() || document.querySelector('h1')?.innerText?.trim() || '';
    const desc = document.querySelector('[data-testid="item-description"]')?.innerText?.trim() || '';
    const priceText = document.querySelector('[data-testid="item-price"]')?.innerText || '';
    const price = parseFloat(priceText.replace(/[^\d.,]/g,'').replace(',','.')) || 0;
    return { title, description: desc, price, priceText, url: location.href, itemId: getVintedItemId() };
  }

  function injectButton() {
    if (document.getElementById('vinted2leboncoin-btn')) return;
    const anchor = document.querySelector('[data-testid="item-title"]') || document.querySelector('h1');
    if (!anchor) return;
    const btn = document.createElement('button');
    btn.id = 'vinted2leboncoin-btn';
    btn.textContent = '⚡️ Importer sur Leboncoin';
    btn.style.cssText = 'background:#ff6e14;color:white;border:none;padding:12px 20px;border-radius:8px;font-weight:700;cursor:pointer;margin:12px 0;width:100%;font-size:15px;z-index:9999;position:relative;';
    btn.onclick = handleImport;
    anchor.parentElement?.insertAdjacentElement('afterend', btn);
  }

  async function handleImport() {
    const btn = document.getElementById('vinted2leboncoin-btn');
    btn.textContent = '⏳ Récupération...';
    btn.disabled = true;
    try {
      const data = extractData();
      const photos = await getCleanPhotos();
      if (!photos.length) {
        alert('Aucune photo trouvée. Ouvre F12 et copie les logs.');
        btn.textContent = '⚡️ Importer sur Leboncoin';
        btn.disabled = false;
        return;
      }
      const payload = { ...data, photos, date: Date.now() };
      // 1. Stockage pour content-leboncoin.js
      await chrome.storage.local.set({ lastImport: payload });
      const { history = [] } = await chrome.storage.local.get('history');
      history.unshift(payload);
      await chrome.storage.local.set({ history: history.slice(0,50) });
      // 2. Envoi au background pour téléchargement fallback
      try { chrome.runtime.sendMessage({ action: 'downloadPhotos', photos, itemId: payload.itemId }); } catch {}
      try { chrome.runtime.sendMessage({ action: 'importVinted', payload }); } catch {}
      
      btn.textContent = `✅ ${photos.length} photo(s) prête(s) - ouverture Leboncoin...`;
      setTimeout(() => {
        window.open('https://www.leboncoin.fr/deposer-une-annonce', '_blank');
        btn.textContent = '⚡️ Importer sur Leboncoin';
        btn.disabled = false;
      }, 600);
    } catch(e) {
      console.error(e);
      btn.textContent = '❌ Erreur';
      btn.disabled = false;
    }
  }

  new MutationObserver(injectButton).observe(document.body, {childList:true, subtree:true});
  injectButton();
})();
