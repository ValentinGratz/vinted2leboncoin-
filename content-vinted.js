// content-vinted.js - v3.9 ULTRA SIMPLE - no API, no /f800/ transform
(() => {
  if (window.__VINTED2LEBONCOIN_INJECTED__) return;
  window.__VINTED2LEBONCOIN_INJECTED__ = true;
  console.log('[v2l] v3.9 loaded');

  function getCleanPhotosFromDOM() {
    // 1. Vraies photos produit - sélecteurs Vinted 2024/2025
    const selectors = [
      '[data-testid="item-photo"] img',
      '[data-testid="item-photos"] img',
      '[data-testid="carousel-item"] img',
      '[data-testid="image-gallery"] img'
    ];

    let raw = [...document.querySelectorAll(selectors.join(','))]
      .map(img => img.currentSrc || img.src || '')
      .filter(Boolean);

    console.log('[v2l] raw from selectors', raw.length, raw);

    // 2. Si 0, fallback mais STRICT sans footer
    if (raw.length === 0) {
      raw = [...document.querySelectorAll('main img, [data-testid="item-detail"] img, article img')]
        .filter(img => {
          const s = (img.currentSrc || img.src || '').toLowerCase();
          if (!s.includes('vinted.net')) return false;
          // Exclude footer badges: ils sont petits et en bas de page
          const rect = img.getBoundingClientRect();
          if (rect.width < 200 || rect.height < 200) return false;
          if (img.closest('footer')) return false;
          return true;
        })
        .map(img => img.currentSrc || img.src);
      console.log('[v2l] raw fallback main', raw.length);
    }

    // 3. Dernier recours og:image (toujours bon)
    if (raw.length === 0) {
      const og = document.querySelector('meta[property="og:image"]')?.content;
      console.log('[v2l] og:image', og);
      if (og) raw = [og];
    }

    // 4. Nettoyage final - PAS de replace /f800/ qui casse tout en 404
    const blacklist = ['avatar','logo','icon','app-store','google-play','badge','profile','dots','trust','store','footer','apple','google','payment'];
    const clean = raw
      .map(u => u.split('?')[0]) // enlève juste les params ?...
      .filter(u => {
        const l = u.toLowerCase();
        if (blacklist.some(b => l.includes(b))) return false;
        return l.includes('vinted.net') || l.includes('vinted.fr');
      })
      .filter((u,i,s) => s.indexOf(u)===i)
      .slice(0,20);

    console.log('[v2l] clean final', clean);
    return clean;
  }

  function urlToBase64ViaCanvas(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          if (img.naturalWidth < 100) { resolve(null); return; }
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/jpeg', 0.9));
        } catch(e) { 
          console.warn('canvas tainted', e); 
          resolve(null); 
        }
      };
      img.onerror = () => { console.warn('canvas error', url); resolve(null); };
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
    console.log('[v2l] canvas fail, background', url);
    return await urlToBase64ViaBackground(url);
  }

  function extractData() {
    const title = document.querySelector('[data-testid="item-title"]')?.innerText?.trim() || document.querySelector('h1')?.innerText?.trim() || '';
    const desc = document.querySelector('[data-testid="item-description"]')?.innerText?.trim() || '';
    const priceText = document.querySelector('[data-testid="item-price"]')?.innerText || '';
    const price = parseFloat(priceText.replace(/[^\d.,]/g,'').replace(',','.')) || 0;
    return { title, description: desc, price, priceText, url: location.href, itemId: location.pathname.match(/\/items\/(\d+)/)?.[1]||Date.now() };
  }

  function injectButton() {
    if (document.getElementById('vinted2leboncoin-btn')) return;
    const anchor = document.querySelector('[data-testid="item-title"]') || document.querySelector('h1') || document.querySelector('main');
    if (!anchor) { console.log('[v2l] no anchor'); return; }
    const btn = document.createElement('button');
    btn.id = 'vinted2leboncoin-btn';
    btn.textContent = '⚡️ Importer sur Leboncoin';
    btn.style.cssText = 'background:#ff6e14;color:white;border:none;padding:12px 20px;border-radius:8px;font-weight:700;cursor:pointer;margin:12px 0;width:100%;font-size:15px;z-index:9999;display:block;';
    btn.onclick = handleImport;
    // essaie plusieurs endroits
    const parent = anchor.parentElement || anchor;
    parent.insertAdjacentElement('afterend', btn);
    console.log('[v2l] btn injected');
  }

  async function handleImport() {
    const btn = document.getElementById('vinted2leboncoin-btn');
    btn.textContent = '⏳ Récupération...';
    btn.disabled = true;
    try {
      const data = extractData();
      const urls = getCleanPhotosFromDOM();
      if (!urls.length) { alert('Aucune photo - ouvre F12 et envoie la console [v2l]'); btn.textContent='⚡️ Importer'; btn.disabled=false; return; }

      btn.textContent = `⏳ Conversion ${urls.length}...`;
      const photosBase64 = [];
      for (let i=0;i<urls.length;i++) {
        btn.textContent = `⏳ ${i+1}/${urls.length}...`;
        const b64 = await urlToBase64(urls[i]);
        if (b64) photosBase64.push(b64);
        else console.warn('[v2l] skip b64', urls[i]);
      }

      if (!photosBase64.length) { alert('Conversion échouée - Vinted bloque. Essaie refresh page.'); btn.textContent='⚡️ Importer'; btn.disabled=false; return; }

      const payload = { ...data, photos: urls, photosBase64, date: Date.now() };
      await chrome.storage.local.set({ lastImport: payload });
      const { history=[] } = await chrome.storage.local.get('history');
      history.unshift(payload);
      await chrome.storage.local.set({ history: history.slice(0,50) });

      btn.textContent = `✅ ${photosBase64.length} photo(s)`;
      setTimeout(() => { window.open('https://www.leboncoin.fr/deposer-une-annonce','_blank'); btn.textContent='⚡️ Importer'; btn.disabled=false; }, 600);
    } catch(e){ console.error(e); btn.textContent='❌ Erreur'; btn.disabled=false; }
  }

  // Injection avec retry
  let tries = 0;
  const iv = setInterval(() => {
    injectButton();
    tries++;
    if (tries > 20 || document.getElementById('vinted2leboncoin-btn')) clearInterval(iv);
  }, 500);
  new MutationObserver(injectButton).observe(document.body, {childList:true, subtree:true});
})();
