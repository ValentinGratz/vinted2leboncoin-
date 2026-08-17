// content-leboncoin.js - v3.3 FIX compatibilité avec le nouveau content-vinted
(() => {
  if (window.__LEBONCOIN_INJECTED__) return;
  window.__LEBONCOIN_INJECTED__ = true;
  console.log('[vinted2leboncoin] leboncoin content loaded');

  async function getLastImport() {
    const { lastImport } = await chrome.storage.local.get('lastImport');
    return lastImport || null;
  }

  function createPanel(payload) {
    if (document.getElementById('vinted-panel')) return;
    
    const panel = document.createElement('div');
    panel.id = 'vinted-panel';
    panel.style.cssText = 'position:fixed;top:100px;right:20px;width:320px;background:white;border:2px solid #ff6e14;border-radius:12px;padding:16px;z-index:99999;box-shadow:0 4px 20px rgba(0,0,0,.2);font-family:sans-serif;';
    
    const photosHtml = (payload.photos || []).map((url, i) => `
      <img src="${url}" data-url="${url}" draggable="true" 
           style="width:70px;height:70px;object-fit:cover;border-radius:8px;border:2px solid #ff6e14;cursor:grab;margin:4px;" 
           title="Glisse vers la zone photo Leboncoin" />
    `).join('');

    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <b style="color:#ff6e14;">⚡️ Annonce Vinted détectée</b>
        <button id="vinted-close" style="border:none;background:none;cursor:pointer;font-size:18px;">✕</button>
      </div>
      <div style="font-size:13px;margin-bottom:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${payload.title||'Sans titre'}<br><b>${payload.price?payload.price+' EUR':''}</b> • ${payload.photos?.length||0} photo(s)</div>
      
      <div style="display:flex;flex-wrap:wrap;max-height:200px;overflow:auto;margin-bottom:12px;background:#fff7f2;padding:6px;border-radius:8px;" id="vinted-thumbs">
        ${photosHtml || '<i>Aucune photo trouvée</i>'}
      </div>

      <button id="vinted-fill" style="width:100%;background:#ff6e14;color:white;border:none;padding:10px;border-radius:8px;font-weight:700;cursor:pointer;margin-bottom:8px;">1. Remplir texte + prix</button>
      <button id="vinted-drag" style="width:100%;background:#0f172a;color:white;border:none;padding:10px;border-radius:8px;font-weight:700;cursor:pointer;">2. Drag & Drop auto des photos</button>
      <div style="font-size:11px;color:#666;margin-top:8px;">💡 Si l'auto échoue, glisse manuellement les miniatures orange sur "Ajouter 20 photos"</div>
    `;

    document.body.appendChild(panel);

    document.getElementById('vinted-close').onclick = () => panel.remove();
    
    // Drag manuel
    panel.querySelectorAll('img[draggable]').forEach(img => {
      img.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/uri-list', img.dataset.url);
        e.dataTransfer.setData('text/plain', img.dataset.url);
        // Créer un vrai fichier pour Leboncoin
        fetch(img.dataset.url)
          .then(r => r.blob())
          .then(blob => {
            const file = new File([blob], `vinted-${Date.now()}.jpg`, { type: 'image/jpeg' });
            e.dataTransfer.items.add(file);
          });
      });
    });

    document.getElementById('vinted-fill').onclick = () => fillForm(payload);
    document.getElementById('vinted-drag').onclick = () => autoDrag(payload.photos);
  }

  function fillForm(payload) {
    // Titre
    const titleInput = document.querySelector('input[name="subject"], input[placeholder*="titre" i], textarea[name="subject"]');
    if (titleInput) {
      titleInput.focus();
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, payload.title?.slice(0,80) || '');
      titleInput.dispatchEvent(new Event('input', {bubbles:true}));
      titleInput.dispatchEvent(new Event('change', {bubbles:true}));
    }
    // Description
    const descInput = document.querySelector('textarea[name="body"], textarea[placeholder*="description" i]');
    if (descInput) {
      descInput.focus();
      descInput.value = (payload.description || '') + '\n\n' + (payload.url ? `Annonce originale: ${payload.url}` : '');
      descInput.dispatchEvent(new Event('input', {bubbles:true}));
    }
    // Prix
    const priceInput = document.querySelector('input[name="price"], input[type="number"]');
    if (priceInput && payload.price) {
      priceInput.focus();
      priceInput.value = payload.price;
      priceInput.dispatchEvent(new Event('input', {bubbles:true}));
    }
    alert('Texte + prix remplis ! Passe aux photos.');
  }

  async function autoDrag(photoUrls) {
    const dropZone = document.querySelector('[data-testid="photo-upload"], div:has(> span:contains("Ajouter"))') 
      || document.querySelector('div[role="button"]') 
      || document.querySelector('input[type="file"]')?.parentElement;

    if (!dropZone) {
      alert('Zone photo Leboncoin non trouvée. Glisse manuellement les miniatures orange.');
      return;
    }

    for (let i = 0; i < Math.min(photoUrls.length, 20); i++) {
      try {
        const url = photoUrls[i];
        const res = await fetch(url);
        const blob = await res.blob();
        const file = new File([blob], `vinted-${i}.jpg`, { type: 'image/jpeg' });
        
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        
        const dragEnter = new DragEvent('dragenter', { bubbles: true, dataTransfer });
        const dragOver = new DragEvent('dragover', { bubbles: true, dataTransfer });
        const drop = new DragEvent('drop', { bubbles: true, dataTransfer });
        
        dropZone.dispatchEvent(dragEnter);
        dropZone.dispatchEvent(dragOver);
        dropZone.dispatchEvent(drop);
        
        await new Promise(r => setTimeout(r, 800));
      } catch(e) { console.warn('drag fail', e); }
    }
  }

  // Init
  async function init() {
    const payload = await getLastImport();
    if (!payload) return;
    // Vérifie qu'on est bien sur la page dépôt
    if (!location.href.includes('deposer-une-annonce') && !location.href.includes('nouvelle-annonce')) return;
    
    // Attend que la page charge
    setTimeout(() => createPanel(payload), 1500);
  }

  init();
  // Re-check si navigation SPA
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(init, 1500);
    }
  }).observe(document.body, { childList: true, subtree: true });

})();
