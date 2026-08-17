// content-leboncoin.js - FIX 0 photos -> canvas method (contourne CORS)
console.log('[V2L LBC] FIX CORS loaded');

async function urlToFile(url, i) {
  return new Promise(async (resolve, reject) => {
    try {
      // Tentative 1: fetch direct (si CORS ok)
      const r = await fetch(url);
      const b = await r.blob();
      resolve(new File([b], `vinted-${i}.jpg`, { type: b.type || 'image/jpeg' }));
    } catch (e) {
      // Tentative 2: canvas (contourne CORS)
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = url;
        await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(blob => {
          if (blob) resolve(new File([blob], `vinted-${i}.jpg`, { type: 'image/jpeg' }));
          else reject(e);
        }, 'image/jpeg', 0.9);
      } catch (e2) { reject(e2); }
    }
  });
}

async function injectFromHistory() {
  const { history } = await chrome.storage.local.get('history');
  if (!history?.length) return alert('Pas d annonce Vinted - va sur Vinted et clique sur Importer');
  const last = history[history.length - 1];
  const urls = last.imageUrls || last.images || [];
  if (!urls.length) return alert('0 photos - Re-importe depuis Vinted');

  const input = document.querySelector('input[type="file"]');
  if (!input) return alert('Scroll jusqu aux photos Leboncoin');

  const dt = new DataTransfer();
  let ok = 0;
  for (let i = 0; i < urls.length; i++) {
    try {
      const u = typeof urls[i] === 'string' ? urls[i] : urls[i].url;
      const f = await urlToFile(u, i);
      dt.items.add(f); ok++;
    } catch (e) { console.error('fail', urls[i], e); }
  }

  if (ok === 0) {
    alert('0 photos - CORS bloque. Glisse manuellement les miniatures orange sur la zone "Ajouter 20 photos" (ça marche à 100%)');
    return;
  }

  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.dispatchEvent(new Event('input', { bubbles: true }));
  
  // Simule drag & drop pour contourner anti-bot LBC
  const zone = document.querySelector('[class*="drop"]') || document.querySelector('input[type="file"]').parentElement;
  if (zone) {
    const dragEvent = new DragEvent('drop', { bubbles: true, dataTransfer: dt });
    zone.dispatchEvent(dragEvent);
  }

  alert(ok + ' photos injectées ! Si LBC les refuse, glisse les miniatures à la main.');
}

function addPanel() {
  if (document.getElementById('v2l-panel')) return;
  const d = document.createElement('div'); d.id = 'v2l-panel';
  d.innerHTML = `<div style="font-weight:800;margin-bottom:8px">Vinted -> Leboncoin FIX</div><button id="v2l-fill" style="background:#111;color:white">1. Remplir texte + prix</button><button id="v2l-photos" style="background:#ff6e14;color:white">2. Injecter photos FIX</button><div id="v2l-thumbs" style="display:flex;flex-wrap:wrap;margin-top:10px"></div><div style="font-size:10px;color:#666;margin-top:6px">Si 0 photos -> glisse les miniatures sur la zone de gauche</div>`;
  document.body.appendChild(d);
  document.getElementById('v2l-photos').onclick = injectFromHistory;
  document.getElementById('v2l-fill').onclick = async () => {
    const { history } = await chrome.storage.local.get('history');
    const last = history?.[history.length - 1]; if (!last) return;
    const t = document.querySelector('input[name="subject"]') || document.querySelector('#subject') || document.querySelector('textarea[name="subject"]');
    if (t) { t.value = last.title; t.dispatchEvent(new Event('input', { bubbles: true })); t.dispatchEvent(new Event('change', { bubbles: true })); }
    const desc = document.querySelector('textarea[name="body"]') || document.querySelector('textarea');
    if (desc && last.description) { desc.value = last.description; desc.dispatchEvent(new Event('input', { bubbles: true })); }
    const thumbs = document.getElementById('v2l-thumbs'); thumbs.innerHTML = '';
    (last.imageUrls || []).forEach((u, i) => {
      const img = document.createElement('img'); img.src = typeof u === 'string' ? u : u.url; img.title = 'Glisse-moi sur la gauche';
      img.addEventListener('dragstart', async e => { try { const f = await urlToFile(img.src, i); e.dataTransfer.items.add(f); } catch (err) {} });
      thumbs.appendChild(img);
    });
  };
}
setInterval(addPanel, 2000);
