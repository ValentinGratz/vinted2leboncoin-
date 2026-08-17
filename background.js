// background.js - FIX CORS - fetch via background (a les permissions)
chrome.runtime.onInstalled.addListener(()=>{ chrome.storage.local.clear(); console.log('[V2L] storage cleared'); });

chrome.runtime.onMessage.addListener((msg, sender, sendResponse)=>{
  if(msg.type === 'FETCH_IMAGE'){
    fetch(msg.url)
      .then(r=>r.blob())
      .then(async blob=>{
        const buffer = await blob.arrayBuffer();
        sendResponse({ok:true, buffer: Array.from(new Uint8Array(buffer)), type: blob.type});
      })
      .catch(err=> sendResponse({ok:false, error: err.toString()}));
    return true; // async
  }
  if(msg.type === 'CLEAR_STORAGE'){
    chrome.storage.local.clear(()=> sendResponse({ok:true}));
    return true;
  }
});
