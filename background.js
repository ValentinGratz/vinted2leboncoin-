// background.js - v3.6 - plus de fetchBlob, juste download optionnel
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
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
  }
  return true;
});
