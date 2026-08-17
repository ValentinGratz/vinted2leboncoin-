// content-vinted.js - v4.0 - CAPTURE DOM DIRECT - no refetch
(() => {
  if (window.__VINTED2LEBONCOIN_INJECTED__) return;
  window.__VINTED2LEBONCOIN_INJECTED__ = true;
  console.log('[v2l] v4.0 capture mode loaded');

  function getPhotoElements() {
    // 1. Sélecteurs stricts Vinted
    let els = [...document.querySelectorAll('[data-testid="item-photo"] img, [data-testid="item-photos"] img, [data-testid="carousel-item"] img, [data-testid="image-gallery"] img')];
    
    // 2. Si 0, cherche large dans main mais gros seulement
    if (els.length === 0) {
      els = [...document.querySelectorAll('main img, article img, [data-testid="item-detail"] img')]
        .filter(img => {
          if (img.closest('footer')) return false;
          if ((img.naturalWidth||img.width) < 250) return false;
          if ((img.naturalHeight||img.height) < 250) return false;
          const src = (img.currentSrc||img.src||'').toLowerCase();
          if (src.includes('avatar')||src.includes('logo')||src.includes('app-store')||src.includes('google-play')||src.includes('badge')) return false;
          // Doit être visible
          const rect = img.getBoundingClientRect();
          if (rect.width < 100) return false;
          return true;
        });
    }

    // 3. Dernier recours: toutes les img vinted visibles > 200px
    if (els.length === 0) {
      els = [...document.querySelectorAll('img')]
        .filter(img => {
          const src = (img.currentSrc||img.src||'').toLowerCase();
          return src.includes('vinted.net') && (img.naturalWidth||300) >= 200 && !img.closest('footer');
        });
    }

    console.log('[v2l] photo elements found', els.length, els);
    return els.slice(0,20);
  }

  function elementToBase64(imgEl) {
    return new Promise((resolve) => {
      try {
        // Si l'image est déjà chargée, on la dessine direct
        if (!imgEl.complete || imgEl.naturalWidth === 0) {
          // attend un peu
          setTimeout(() => elementToBase64(imgEl).then(resolve), 200);
          return;
        }
        const canvas = document.createElement('canvas');
        canvas.width = imgEl.naturalWidth;
        canvas.height = imgEl.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(imgEl, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        console.log('[v2l] captured via element', imgEl.naturalWidth, 'x', imgEl.naturalHeight);
        resolve(dataUrl);
      } catch(e) {
        console.warn('[v2l] element capture tainted', e);
        // Fallback: essaie background fetch avec l'URL originale
        const url = imgEl.currentSrc || imgEl.src;
        chrome.runtime.sendMessage({ action: 'fetchBlob', url }, (resp) => {
          if (chrome.runtime.lastError || !resp || !resp.ok) { resolve(null); return; }
          resolve(`data:${resp.type||'image/jpeg'};base64,${resp.base64}`);
        });
      }
    });
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
    if (!anchor) return;
    const btn = document.createElement('button');
    btn.id = 'vinted2leboncoin-btn';
    btn.textContent = '⚡️ Importer sur Leboncoin';
    btn.style.cssText = 'background:#ff6e14;color:white;border:none;padding:12px 20px;border-radius:8px;font-weight:700;cursor:pointer;margin:12px 0;width:100%;font-size:15px;z-index:9999;display:block;';
    btn.onclick = handleImport;
    (anchor.parentElement||anchor).insertAdjacentElement('afterend', btn);
    console.log('[v2l] btn injected');
  }

  async function handleImport() {
    const btn = document.getElementById('vinted2leboncoin-btn');
    btn.textContent = '⏳ Capture...';
    btn.disabled = true;
    try {
      const data = extractData();
      const elements = getPhotoElements();
      if (!elements.length) { 
        alert('Aucune photo trouvée - scroll un peu puis re-clique'); 
        btn.textContent='⚡️ Importer'; btn.disabled=false; return; 
      }

      btn.textContent = `⏳ Capture ${elements.length}...`;
      const photosBase64 = [];
      const photosUrls = [];
      for (let i=0;i<elements.length;i++) {
        btn.textContent = `⏳ ${i+1}/${elements.length}...`;
        const b64 = await elementToBase64(elements[i]);
        if (b64) {
          photosBase64.push(b64);
          photosUrls.push(elements[i].currentSrc||elements[i].src);
        }
      }

      if (!photosBase64.length) { alert('Capture échouée - refresh la page'); btn.textContent='⚡️ Importer'; btn.disabled=false; return; }

      const payload = { ...data, photos: photosUrls, photosBase64, date: Date.now() };
      await chrome.storage.local.set({ lastImport: payload });
      const { history=[] } = await chrome.storage.local.get('history');
      history.unshift(payload);
      await chrome.storage.local.set({ history: history.slice(0,50) });

      btn.textContent = `✅ ${photosBase64.length} photo(s) prête(s)`;
      console.log('[v2l] payload ready', payload.photosBase64.length);
      setTimeout(() => { window.open('https://www.leboncoin.fr/deposer-une-annonce','_blank'); btn.textContent='⚡️ Importer'; btn.disabled=false; }, 600);
    } catch(e){ console.error(e); btn.textContent='❌ Erreur '+e.message; btn.disabled=false; }
  }

  let tries=0;
  const iv=setInterval(()=>{ injectButton(); tries++; if(tries>20||document.getElementById('vinted2leboncoin-btn')) clearInterval(iv); }, 500);
  new MutationObserver(injectButton).observe(document.body,{childList:true, subtree:true});
})();
