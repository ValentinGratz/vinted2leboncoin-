// content-leboncoin.js - v3.5 FIX #6 + FIX CORS + FIX selector invalide
(() => {
  if (window.__LEBONCOIN_INJECTED__) return;
  window.__LEBONCOIN_INJECTED__ = true;
  console.log('[vinted2leboncoin] leboncoin v3.5 loaded');

  function fetchViaBackground(url) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ action: 'fetchBlob', url }, (resp) => {
          if (chrome.runtime.lastError) { resolve(null); return; }
          if (!resp || !resp.ok) { resolve(null); return; }
          try {
            const binary = atob(resp.base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            const blob = new Blob([bytes], { type: resp.type || 'image/jpeg' });
            resolve(blob);
          } catch { resolve(null); }
        });
      } catch { resolve(null); }
    });
  }

  async function getLastImport() {
    const { lastImport } = await chrome.storage.local.get('lastImport');
    return lastImport || null;
  }

  async function createPanel(payload) {
    if (document.getElementById('vinted-panel')) document.getElementById('vinted-panel').remove();

    const panel = document.createElement('div');
    panel.id = 'vinted-panel';
    panel.style.cssText = 'position:fixed;top:90px;right:20px;width:340px;background:white;border:2px solid #ff6e14;border-radius:12px;padding:16px;z-index:2147483647;box-shadow:0 4px 20px rgba(0,0,0,.2);font-family:sans-serif;';

    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <b style="color:#ff6e14;">⚡️ Annonce Vinted</b>
        <button id="vinted-close" style="border:none;background:none;cursor:pointer;font-size:18px;">✕</button>
      </div>
      <div style="font-size:13px;margin-bottom:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${(payload.title||'').slice(0,55)}<br><b>${payload.price||'?'} EUR</b> • ${payload.photos?.length||0} photo(s)</div>
      <div id="vinted-thumbs" style="display:flex;flex-wrap:wrap;min-height:70px;max-height:240px;overflow:auto;margin-bottom:12px;background:#fff7f2;padding:8px;border-radius:8px;gap:6px;align-items:center;justify-content:center;">
        <span style="font-size:12px;">Chargement ${payload.photos.length} photos...</span>
      </div>
      <button id="vinted-fill" style="width:100%;background:#ff6e14;color:white;border:none;padding:10px;border-radius:8px;font-weight:700;cursor:pointer;margin-bottom:8px;">1. Remplir texte + prix</button>
      <button id="vinted-drag" style="width:100%;background:#0f172a;color:white;border:none;padding:10px;border-radius:8px;font-weight:700;cursor:pointer;">2. Drag & Drop auto des photos</button>
      <div style="font-size:11px;color:#666;margin-top:8px;">Si l'auto échoue, glisse les miniatures orange sur "Ajouter 20 photos"</div>
    `;
    document.body.appendChild(panel);
    document.getElementById('vinted-close').onclick = () => panel.remove();
    document.getElementById('vinted-fill').onclick = () => fillForm(payload);
    document.getElementById('vinted-drag').onclick = () => autoDrag(payload.photos);

    const thumbs = document.getElementById('vinted-thumbs');
    thumbs.innerHTML = '';

    // Charge via background pour éviter CORS + broken image
    for (let i = 0; i < payload.photos.length; i++) {
      const url = payload.photos[i];
      const blob = await fetchViaBackground(url);
      if (!blob) {
        console.warn('blob fail', url);
        continue;
      }
      const objectUrl = URL.createObjectURL(blob);
      const img = document.createElement('img');
      img.src = objectUrl;
      img.dataset.url = url;
      img.draggable = true;
      img.title = 'Glisse vers Ajouter 20 photos';
      img.style.cssText = 'width:70px;height:70px;object-fit:cover;border-radius:8px;border:2px solid #ff6e14;cursor:grab;';

      img.addEventListener('dragstart', (e) => {
        // On stocke le blob pour le drop
        e.dataTransfer.setData('text/plain', url);
        window.__VINTED_FILE__ = { blob, index: i };
      });

      thumbs.appendChild(img);
    }

    if (thumbs.children.length === 0) {
      thumbs.innerHTML = '<span style="color:red;font-size:12px;">Photos bloquées par Vinted. Clique droit sur Vinted > Enregistrer l\'image puis glisse depuis ton dossier.</span>';
    }
  }

  function fillForm(payload) {
    const titleInput = document.querySelector('input[name="subject"]');
    if (titleInput) {
      titleInput.focus();
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, (payload.title||'').slice(0,80));
      titleInput.dispatchEvent(new Event('input', { bubbles: true }));
      titleInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const descInput = document.querySelector('textarea[name="body"]');
    if (descInput) {
      descInput.focus();
      descInput.value = (payload.description||'') + '\n\nOrigine: ' + (payload.url||'');
      descInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const priceInput = document.querySelector('input[name="price"]');
    if (priceInput && payload.price) {
      priceInput.focus();
      priceInput.value = String(payload.price);
      priceInput.dispatchEvent(new Event('input', { bubbles: true }));
      priceInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  async function autoDrag(photoUrls) {
    const btn = document.getElementById('vinted-drag');
    if (!btn) return;
    btn.textContent = '⏳ Récupération via background...';

    // Cherche le vrai input file de Leboncoin (sélecteur simple, pas de :has)
    const fileInput = document.querySelector('input[type="file"]');
    if (!fileInput) {
      alert('Input file Leboncoin non trouvé. Glisse manuellement.');
      btn.textContent = '2. Drag & Drop auto des photos';
      return;
    }

    const dtAll = new DataTransfer();
    let okCount = 0;

    for (let i = 0; i < Math.min(photoUrls.length, 20); i++) {
      btn.textContent = `⏳ Photo ${i+1}/${photoUrls.length}...`;
      const blob = await fetchViaBackground(photoUrls[i]);
      if (!blob) continue;
      const file = new File([blob], `vinted-${i+1}.jpg`, { type: blob.type || 'image/jpeg' });
      dtAll.items.add(file);
      okCount++;
      await new Promise(r => setTimeout(r, 200));
    }

    if (okCount === 0) {
      btn.textContent = '❌ Aucune photo récupérée (CORS)';
      return;
    }

    // Injection directe dans l'input file - c'est ce que Leboncoin écoute
    fileInput.files = dtAll.files;
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    fileInput.dispatchEvent(new Event('input', { bubbles: true }));

    btn.textContent = `✅ ${okCount} photos injectées !`;
  }

  async function init() {
    const payload = await getLastImport();
    if (!payload?.photos?.length) return;
    if (!location.href.includes('deposer') && !location.href.includes('nouvelle')) return;
    setTimeout(() => createPanel(payload), 1200);
  }

  init();
})();
