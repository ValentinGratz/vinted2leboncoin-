// content-vinted.js - v3.1 FIX ISSUE #6
// Fix: le scraper ne télécharge plus logo, avatar, boutons store

(() => {
  if (window.__VINTED2LEBONCOIN_INJECTED__) return;
  window.__VINTED2LEBONCOIN_INJECTED__ = true;

  console.log('[vinted2leboncoin] content-vinted loaded');

  // ---------- 1. UTILS FIX #6 ----------
  function getVintedItemId() {
    return window.location.pathname.match(/\/items\/(\d+)/)?.[1] || null;
  }

  async function getVintedPhotosViaAPI(itemId) {
    try {
      const urls = [
        `https://www.vinted.fr/api/v2/items/${itemId}`,
        `https://www.vinted.fr/api/v2/items/${itemId}?localize=false`
      ];
      for (const apiUrl of urls) {
        const res = await fetch(apiUrl, {
          headers: { 'Accept': 'application/json' },
          credentials: 'include'
        });
        if (!res.ok) continue;
        const json = await res.json();
        const photos = json.item?.photos || json.photos || [];
        if (photos.length) {
          return photos.map(p => (p.full_size_url || p.url || '').split('?')[0]).filter(Boolean);
        }
      }
      return null;
    } catch (e) {
      console.warn('[vinted2leboncoin] API fail', e);
      return null;
    }
  }

  function getCleanPhotosFromDOM() {
    const selectors = [
      '[data-testid="item-photo"] img',
      '[data-testid="carousel"] img',
      '.item-photos img',
      '[data-testid="item-detail"] img',
      'figure img',
      '[data-testid="image-gallery"] img'
    ];
    let raw = [...document.querySelectorAll(selectors.join(','))]
      .map(img => img.src || img.dataset.src || img.currentSrc || img.getAttribute('srcset')?.split(' ')[0] || '')
      .filter(Boolean);

    // Fallback pour annonces 1 photo : Vinted met parfois des images < 200px filtrées trop agressivement
    if (raw.length === 0) {
      raw = [...document.querySelectorAll('img')]
        .filter(img => {
          const w = img.naturalWidth || img.width || 0;
          const h = img.naturalHeight || img.height || 0;
          if (w > 0 && w < 180) return false;
          if (h > 0 && h < 180) return false;
          const src = (img.src || '').toLowerCase();
          if (!src) return false;
          if (!src.includes('vinted')) return false;
          return true;
        })
        .map(img => img.src);
    }

    const blacklist = ['avatar', 'logo', 'icon', 'app-store', 'google-play', 'badge', 'profile', 'user-avatar', 'dots-'];
    let clean = raw
      .map(u => u.split('?')[0])
      .filter(u => !blacklist.some(b => u.toLowerCase().includes(b)))
      .filter((u, i, s) => s.indexOf(u) === i)
      .map(u => u.replace(/\/s\d+\//, '/f800/').replace(/\/thumbs\/s/, '/thumbs/f800/'))
      .slice(0, 20);

    if (clean.length === 0) {
      const og = document.querySelector('meta[property="og:image"]')?.content;
      if (og) clean = [og.split('?')[0]];
    }
    return clean;
  }

  async function getCleanPhotos() {
    const id = getVintedItemId();
    if (id) {
      const apiPhotos = await getVintedPhotosViaAPI(id);
      if (apiPhotos?.length) {
        console.log(`[vinted2leboncoin] ${apiPhotos.length} photos via API`);
        return apiPhotos;
      }
    }
    const domPhotos = getCleanPhotosFromDOM();
    console.log(`[vinted2leboncoin] ${domPhotos.length} photos via DOM filtré`);
    return domPhotos;
  }

  // ---------- 2. EXTRACTION DATA ----------
  function extractData() {
    const title = document.querySelector('[data-testid="item-title"]')?.innerText?.trim() 
      || document.querySelector('h1')?.innerText?.trim() || '';

    const description = document.querySelector('[data-testid="item-description"]')?.innerText?.trim() || '';
    const priceText = document.querySelector('[data-testid="item-price"]')?.innerText || '';
    const price = parseFloat(priceText.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;

    // détails supplémentaires (marque, taille, état...)
    const details = {};
    document.querySelectorAll('[data-testid="item-attributes"] span').forEach(el => {
      details[el.innerText] = true;
    });

    return { title, description, price, priceText, details, url: window.location.href, itemId: getVintedItemId() };
  }

  // ---------- 3. BOUTON ----------
  function injectButton() {
    if (document.getElementById('vinted2leboncoin-btn')) return;
    
    const titleEl = document.querySelector('[data-testid="item-title"]') || document.querySelector('h1');
    if (!titleEl) return;

    const btn = document.createElement('button');
    btn.id = 'vinted2leboncoin-btn';
    btn.innerHTML = '⚡️ Importer sur Leboncoin';
    btn.style.cssText = 'background:#ff6e14;color:white;border:none;padding:12px 20px;border-radius:8px;font-weight:700;cursor:pointer;margin:12px 0;width:100%;font-size:15px;';
    btn.onclick = handleImport;

    titleEl.parentElement?.insertAdjacentElement('afterend', btn);
  }

  // ---------- 4. IMPORT ----------
  async function handleImport() {
    const btn = document.getElementById('vinted2leboncoin-btn');
    btn.innerText = '⏳ Récupération photos...';
    btn.disabled = true;

    try {
      const data = extractData();
      const photos = await getCleanPhotos();

      if (!photos.length) {
        alert('Aucune photo produit trouvée (fix #6 actif)');
        btn.innerText = '⚡️ Importer sur Leboncoin';
        btn.disabled = false;
        return;
      }

      const payload = { ...data, photos, date: Date.now() };

      // Sauvegarde pour leboncoin + historique
      await chrome.storage.local.set({ lastImport: payload });
      const { history = [] } = await chrome.storage.local.get('history');
      history.unshift(payload);
      await chrome.storage.local.set({ history: history.slice(0, 50) });

      // Envoie au background pour download + ouverture leboncoin
      chrome.runtime.sendMessage({ action: 'importVinted', payload });

      btn.innerText = `✅ ${photos.length} photos prêtes`;
      setTimeout(() => {
        window.open('https://www.leboncoin.fr/deposer-une-annonce', '_blank');
        btn.innerText = '⚡️ Importer sur Leboncoin';
        btn.disabled = false;
      }, 500);

    } catch (e) {
      console.error(e);
      btn.innerText = '❌ Erreur';
      btn.disabled = false;
    }
  }

  // Init
  const observer = new MutationObserver(() => injectButton());
  observer.observe(document.body, { childList: true, subtree: true });
  injectButton();
})();
