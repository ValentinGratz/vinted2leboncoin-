// background.js - v3.7 - fetchBlob robuste pour Vinted CDN
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'fetchBlob') {
    (async () => {
      try {
        // Important: pas de credentials pour images*.vinted.net
        const res = await fetch(msg.url, { 
          method: 'GET',
          credentials: 'omit',
          headers: { 'Accept': 'image/*,*/*' }
        });
        if (!res.ok) throw new Error('status '+res.status);
        const blob = await res.blob();
        const buf = await blob.arrayBuffer();
        // base64 par chunks pour éviter stack overflow
        let binary = '';
        const bytes = new Uint8Array(buf);
        const chunkSize = 8192;
        for (let i=0;i<bytes.length;i+=chunkSize) {
          const chunk = bytes.subarray(i, i+chunkSize);
          binary += String.fromCharCode.apply(null, chunk);
        }
        const base64 = btoa(binary);
        sendResponse({ ok: true, base64, type: blob.type || 'image/jpeg' });
      } catch(e) {
        console.error('[background] fetchBlob fail', msg.url, e);
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true;
  }

  if (msg.action === 'downloadPhotos') {
    (async () => {
      const photos = msg.photos || [];
      const itemId = msg.itemId || Date.now();
      for (let i=0;i<photos.length;i++) {
        try {
          await chrome.downloads.download({
            url: photos[i],
            filename: `vinted-import/${itemId}_${i+1}.jpg`,
            conflictAction: 'overwrite'
          });
        } catch {}
      }
    })();
    return true;
  }
});
