// content-vinted.js - v3.5 FINAL - FIX #6 + single photo
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
      return photos.map(p => (p.full_size_url || p.url || '').split('?')[0]).filter(Boolean);
    } catch { return null; }
  }

  function getCleanPhotosFromDOM() {
    let raw = [...document.querySelectorAll('[data-testid="item-photo"] img, [data-testid="carousel"] img, .item-photos img, [data-testid="image-gallery"] img')]
      .map(el => el.src || el.dataset.src || el.currentSrc || '')
      .filter(Boolean);

    if (raw.length === 0) {
      raw = [...document.querySelectorAll('img')]
        .filter(img => (img.src||'').toLowerCase().includes('vinted') && (img.naturalWidth||img.width) >= 150)
        .map(i => i.src);
    }
    if (raw.length === 0) {
      const og = document.querySelector('meta[property="og:image"]')?.content;
      if (og) raw = [og];
    }

    const blacklist = ['avatar','logo','icon','app-store','google-play','badge','profile','dots'];
    return raw.map(u => u.split('?')[0])
      .filter(u => !blacklist.some(b => u.toLowerCase().includes(b)))
      .filter((u,i,s) => s.indexOf(u)===i)
      .map(u => u.replace(/\/s\d+\//, '/f800/'))
      .slice(0,20);
  }

  async function getCleanPhotos() {
    const id = getVintedItemId();
    if (id) {
      const api = await getVintedPhotosViaAPI(id);
      if (api?.length) return api;
    }
    return getCleanPhotosFromDOM();
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
    btn.style.cssText = 'background:#ff6e14;color:white;border:none;padding:12px 20px;border-radius:8px;font-weight:700;cursor:pointer;margin:12px 0;width:100%;font-size:15px;';
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
      if (!photos.length) { alert('Aucune photo'); btn.textContent='⚡️ Importer'; btn.disabled=false; return; }
      const payload = { ...data, photos, date: Date.now() };
      await chrome.storage.local.set({ lastImport: payload });
      const { history=[] } = await chrome.storage.local.get('history');
      history.unshift(payload);
      await chrome.storage.local.set({ history: history.slice(0,50) });
      try { chrome.runtime.sendMessage({ action: 'downloadPhotos', photos, itemId: payload.itemId }); } catch {}
      btn.textContent = `✅ ${photos.length} photo(s)`;
      setTimeout(() => { window.open('https://www.leboncoin.fr/deposer-une-annonce','_blank'); btn.textContent='⚡️ Importer sur Leboncoin'; btn.disabled=false; }, 600);
    } catch(e){ btn.textContent='❌ Erreur'; btn.disabled=false; }
  }

  new MutationObserver(injectButton).observe(document.body, {childList:true, subtree:true});
  injectButton();
})();
