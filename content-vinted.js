// content-vinted.js - v3.6 FINAL CORS FIX - convert to base64 on Vinted side
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
      return photos.map(p => (p.full_size_url || p.url || '').split('?')[0]).filter(Boolean);
    } catch { return null; }
  }

  function getCleanPhotosFromDOM() {
    let raw = [...document.querySelectorAll('[data-testid="item-photo"] img, [data-testid="carousel"] img, .item-photos img, [data-testid="image-gallery"] img, figure img')]
      .map(el => el.src || el.dataset.src || el.currentSrc || el.getAttribute('srcset')?.split(' ')[0] || '')
      .filter(Boolean);

    if (raw.length === 0) {
      raw = [...document.querySelectorAll('img')]
        .filter(img => {
          const src = (img.src||'').toLowerCase();
          return src.includes('vinted') && (img.naturalWidth||img.width) >= 120;
        })
        .map(i => i.src);
    }
    if (raw.length === 0) {
      const og = document.querySelector('meta[property="og:image"]')?.content;
      if (og) raw = [og];
    }

    const blacklist = ['avatar','logo','icon','app-store','google-play','badge','profile','dots','placeholder','notification'];
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

  async function urlToBase64(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('fetch '+res.status);
      const blob = await res.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result); // data:image/jpeg;base64,...
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch(e) {
      console.warn('urlToBase64 fail', url, e);
      return null;
    }
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
    btn.style.cssText = 'background:#ff6e14;color:white;border:none;padding:12px 20px;border-radius:8px;font-weight:700;cursor:pointer;margin:12px 0;width:100%;font-size:15px;position:relative;z-index:9999;';
    btn.onclick = handleImport;
    anchor.parentElement?.insertAdjacentElement('afterend', btn);
  }

  async function handleImport() {
    const btn = document.getElementById('vinted2leboncoin-btn');
    btn.textContent = '⏳ Récupération photos...';
    btn.disabled = true;
    try {
      const data = extractData();
      const urls = await getCleanPhotos();
      if (!urls.length) { alert('Aucune photo trouvée'); btn.textContent='⚡️ Importer'; btn.disabled=false; return; }

      btn.textContent = `⏳ Conversion ${urls.length} photos...`;
      const photosBase64 = [];
      for (let i=0;i<urls.length;i++) {
        const b64 = await urlToBase64(urls[i]);
        if (b64) photosBase64.push(b64);
      }

      if (!photosBase64.length) { alert('Conversion échouée (Vinted bloque)'); btn.textContent='⚡️ Importer'; btn.disabled=false; return; }

      const payload = { ...data, photos: urls, photosBase64, date: Date.now() };
      await chrome.storage.local.set({ lastImport: payload });
      const { history=[] } = await chrome.storage.local.get('history');
      history.unshift(payload);
      await chrome.storage.local.set({ history: history.slice(0,50) });

      btn.textContent = `✅ ${photosBase64.length} photo(s) prête(s)`;
      setTimeout(() => {
        window.open('https://www.leboncoin.fr/deposer-une-annonce','_blank');
        btn.textContent='⚡️ Importer sur Leboncoin';
        btn.disabled=false;
      }, 600);
    } catch(e){
      console.error(e);
      btn.textContent='❌ Erreur'; btn.disabled=false;
    }
  }

  new MutationObserver(injectButton).observe(document.body, {childList:true, subtree:true});
  injectButton();
})();
