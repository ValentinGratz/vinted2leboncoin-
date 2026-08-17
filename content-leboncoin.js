// content-leboncoin.js - v3.6 FINAL - no CORS, uses base64 from Vinted
(() => {
  if (window.__LEBONCOIN_INJECTED__) return;
  window.__LEBONCOIN_INJECTED__ = true;
  console.log('[v2l] leboncoin v3.6');

  async function getLastImport() {
    const { lastImport } = await chrome.storage.local.get('lastImport');
    return lastImport || null;
  }

  function base64ToFile(dataUrl, index) {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while(n--) u8arr[n] = bstr.charCodeAt(n);
    return new File([u8arr], `vinted-${index}.jpg`, { type: mime || 'image/jpeg' });
  }

  async function createPanel(payload) {
    if (document.getElementById('vinted-panel')) document.getElementById('vinted-panel').remove();

    const panel = document.createElement('div');
    panel.id = 'vinted-panel';
    panel.style.cssText = 'position:fixed;top:90px;right:20px;width:360px;background:white;border:2px solid #ff6e14;border-radius:12px;padding:16px;z-index:2147483647;box-shadow:0 4px 20px rgba(0,0,0,.2);font-family:sans-serif;';

    const b64 = payload.photosBase64 || [];
    const count = b64.length;

    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <b style="color:#ff6e14;">⚡️ Annonce Vinted (${count} photos)</b>
        <button id="vinted-close" style="border:none;background:none;cursor:pointer;font-size:18px;">✕</button>
      </div>
      <div style="font-size:13px;margin-bottom:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${(payload.title||'').slice(0,55)}<br><b>${payload.price||'?'} EUR</b></div>
      <div id="vinted-thumbs" style="display:flex;flex-wrap:wrap;min-height:70px;max-height:260px;overflow:auto;margin-bottom:12px;background:#fff7f2;padding:8px;border-radius:8px;gap:6px;"></div>
      <button id="vinted-fill" style="width:100%;background:#ff6e14;color:white;border:none;padding:10px;border-radius:8px;font-weight:700;cursor:pointer;margin-bottom:8px;">1. Remplir texte + prix</button>
      <button id="vinted-drag" style="width:100%;background:#0f172a;color:white;border:none;padding:10px;border-radius:8px;font-weight:700;cursor:pointer;">2. Injecter les ${count} photos auto</button>
      <div style="font-size:11px;color:#666;margin-top:8px;">Glisse manuel possible si l'auto échoue</div>
    `;
    document.body.appendChild(panel);
    document.getElementById('vinted-close').onclick = () => panel.remove();
    document.getElementById('vinted-fill').onclick = () => fillForm(payload);
    document.getElementById('vinted-drag').onclick = () => autoDrag(b64);

    const thumbs = document.getElementById('vinted-thumbs');
    b64.forEach((dataUrl, i) => {
      const img = document.createElement('img');
      img.src = dataUrl;
      img.draggable = true;
      img.style.cssText = 'width:70px;height:70px;object-fit:cover;border-radius:8px;border:2px solid #ff6e14;cursor:grab;';
      img.addEventListener('dragstart', (e) => {
        const file = base64ToFile(dataUrl, i);
        const dt = new DataTransfer();
        dt.items.add(file);
        e.dataTransfer.setData('text/plain', payload.photos[i]||'');
        window.__VINTED_DT__ = dt;
      });
      thumbs.appendChild(img);
    });
  }

  function fillForm(payload) {
    const titleInput = document.querySelector('input[name="subject"]');
    if (titleInput) {
      titleInput.focus();
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, (payload.title||'').slice(0,80));
      titleInput.dispatchEvent(new Event('input', { bubbles: true }));
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

  async function autoDrag(b64Array) {
    const btn = document.getElementById('vinted-drag');
    const fileInput = document.querySelector('input[type="file"]');
    if (!fileInput) { alert('Input file non trouvé'); return; }

    const dt = new DataTransfer();
    b64Array.forEach((dataUrl, i) => {
      const file = base64ToFile(dataUrl, i);
      dt.items.add(file);
    });

    fileInput.files = dt.files;
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    fileInput.dispatchEvent(new Event('input', { bubbles: true }));
    
    btn.textContent = `✅ ${b64Array.length} photos injectées !`;
    btn.style.background = '#16a34a';
  }

  async function init() {
    const payload = await getLastImport();
    if (!payload?.photosBase64?.length) return;
    if (!location.href.includes('deposer') && !location.href.includes('nouvelle')) return;
    setTimeout(() => createPanel(payload), 1000);
  }

  init();
})();
