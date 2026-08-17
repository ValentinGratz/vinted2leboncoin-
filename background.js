// background.js - v3.5 FIX CORS
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg.action === 'downloadPhotos') {
      const photos = msg.photos || [];
      const itemId = msg.itemId || Date.now();
      for (let i = 0; i < photos.length; i++) {
        try {
          await chrome.downloads.download({
            url: photos[i],
            filename: `vinted-import/${itemId}_${i+1}.jpg`,
            conflictAction: 'overwrite'
          });
        } catch {}
      }
      sendResponse({ ok: true });
    }

    if (msg.action === 'fetchBlob') {
      try {
        const res = await fetch(msg.url);
        if (!res.ok) throw new Error('fetch failed ' + res.status);
        const blob = await res.blob();
        const buf = await blob.arrayBuffer();
        // chunk base64 pour éviter stack overflow
        let binary = '';
        const bytes = new Uint8Array(buf);
        for (let i=0;i<bytes.length;i++) binary += String.fromCharCode(bytes[i]);
        const base64 = btoa(binary);
        sendResponse({ ok: true, base64, type: blob.type || 'image/jpeg' });
      } catch(e) {
        sendResponse({ ok: false, error: String(e) });
      }
    }
  })();
  return true;
});
