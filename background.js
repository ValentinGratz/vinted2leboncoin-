// background.js - v3.4 FIX CORS + download
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg.action === 'downloadPhotos' || msg.action === 'importVinted') {
      const photos = msg.photos || msg.payload?.photos || [];
      const itemId = msg.itemId || msg.payload?.itemId || Date.now();
      
      // 1. Téléchargement fallback dans Téléchargements/vinted-import/
      for (let i = 0; i < photos.length; i++) {
        try {
          await chrome.downloads.download({
            url: photos[i],
            filename: `vinted-import/${itemId}_${i+1}.jpg`,
            conflictAction: 'overwrite'
          });
        } catch(e) { console.warn('download fail', e); }
      }
      sendResponse({ ok: true });
    }

    if (msg.action === 'fetchBlob') {
      // Appelé par content-leboncoin pour contourner CORS
      try {
        const res = await fetch(msg.url);
        const blob = await res.blob();
        const arrayBuffer = await blob.arrayBuffer();
        // Convert to base64 pour passer via messaging
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        sendResponse({ ok: true, base64, type: blob.type || 'image/jpeg' });
      } catch(e) {
        console.error('fetchBlob fail', e);
        sendResponse({ ok: false, error: e.message });
      }
      return true; // keep channel open
    }
  })();
  return true; // important pour sendResponse async
});
