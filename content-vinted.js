// content-vinted.js - v3.8 FINAL STRICT - Fix #6 badges footer
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
      const photos = json.item?.photos || [];
      if (!photos.length) return null;
      return photos.map(p => (p.full_size_url || p.url || '').split('?')[0]).filter(Boolean);
    } catch { return null; }
  }

  function getCleanPhotosFromDOM() {
    // STRICT: uniquement les vraies photos produit Vinted
    const selectors = [
      '[data-testid="item-photo"] img',
      '[data-testid="carousel-item"] img',
      '[data-testid="image-gallery"] img',
      'div[data-testid="item-photos"] img',
      'img[data-testid="item-photo"]'
    ];

    let raw = [...document.querySelectorAll(selectors.join(','))]
      .map(img => img.currentSrc || img.src || img.dataset.src || '')
      .filter(Boolean);

    // Si 0, on tente og:image (toujours la vraie photo produit)
    if (raw.length === 0) {
      const og = document.querySelector('meta[property="og:image"]')?.content;
      if (og && og.includes('vinted')) raw = [og];
    }

    // Filtre ultra strict anti-footer
    const blacklist = [
      'avatar','logo','icon','app-store','google-play','badge','profile','dots',
      'placeholder','notification','trust','footer','store','apple','google',
      'payment','paypal','visa','mastercard'
    ];

    return raw
      .map(u => u.split('?')[0])
      .filter(u => {
        const l = u.toLowerCase();
        // Doit être une vraie image Vinted produit
        if (!l.includes('vinted')) return false;
        if (l.includes('data:')) return false;
        // Blacklist badges footer
        if (blacklist.some(b => l.includes(b))) return false;
        // Les badges font < 200px de haut, les produits > 300
        return true;
      })
      .filter((u,i,s) => s.indexOf(u)===i)
      .map(u => {
        // Passe en haute résolution
        if (u.includes('/s') && u.includes('/f')) return u;
        return u.replace(/\/s\d+\//, '/f800/');
      })
      .slice(0,20);
  }

  async function getCleanPhotos() {
    const id = getVintedItemId();
    if (id) {
      const api = await getVintedPhotosViaAPI(id);
      if (api?.length) {
        console.log(`[v2l] ${api.length} via API`);
        return api;
      }
    }
    const dom = getCleanPhotosFromDOM();
    console.log(`[v2l] ${dom.length} via DOM strict`, dom);
    return dom;
  }

  function urlToBase64ViaCanvas(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          if (img.naturalWidth < 200 || img.naturalHeight < 200) {
            console.warn('skip small image', url, img.naturalWidth);
            resolve(null); return;
          }
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/jpeg', 0.92));
        } catch { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  function urlToBase64ViaBackground(url) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'fetchBlob', url }, (resp) => {
        if (chrome.runtime.lastError || !resp || !resp.ok) { resolve(null); return; }
        resolve(`data:${resp.type||'image/jpeg'};base64,${resp.base64}`);
      });
    });
  }

  async function urlToBase64(url) {
    let b64 = await urlToBase64ViaCanvas(url);
    if (b64) return b64;
    return await urlToBase64ViaBackground(url);
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
    btn.style.cssText = 'background:#ff6e14;color:white;border:none;padding:12px 20px;border-radius:8px;font-weight:700;cursor:pointer;margin:12px 0;width:100%;font-size:15px;z-index:9999;';
    btn.onclick = handleImport;
    anchor.parentElement?.insertAdjacentElement('afterend', btn);
  }

  async function handleImport() {
    const btn = document.getElementById('vinted2leboncoin-btn');
    btn.textContent = '⏳ Récupération...';
    btn.disabled = true;
    try {
      const data = extractData();
      const urls = await getCleanPhotos();
      if (!urls.length) { alert('Aucune photo produit trouvée'); btn.textContent='⚡️ Importer'; btn.disabled=false; return; }

      btn.textContent = `⏳ Conversion ${urls.length}...`;
      const photosBase64 = [];
      for (let i=0;i<urls.length;i++) {
        btn.textContent = `⏳ ${i+1}/${urls.length}...`;
        const b64 = await urlToBase64(urls[i]);
        if (b64) photosBase64.push(b64);
      }

      if (!photosBase64.length) { alert('Vinted bloque la conversion'); btn.textContent='⚡️ Importer'; btn.disabled=false; return; }

      const payload = { ...data, photos: urls, photosBase64, date: Date.now() };
      await chrome.storage.local.set({ lastImport: payload });
      const { history=[] } = await chrome.storage.local.get('history');
      history.unshift(payload);
      await chrome.storage.local.set({ history: history.slice(0,50) });

      btn.textContent = `✅ ${photosBase64.length} photo(s)`;
      setTimeout(() => { window.open('https://www.leboncoin.fr/deposer-une-annonce','_blank'); btn.textContent='⚡️ Importer'; btn.disabled=false; }, 600);
    } catch(e){ console.error(e); btn.textContent='❌ Erreur'; btn.disabled=false; }
  }

  new MutationObserver(injectButton).observe(document.body, {childList:true, subtree:true});
  injectButton();
})();
