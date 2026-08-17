chrome.runtime.onMessage.addListener((msg,s,sendResponse)=>{
  if(msg.type==='FETCH_IMAGE'){
    fetch(msg.url).then(r=>r.blob()).then(async blob=>{
      const buf=await blob.arrayBuffer();
      sendResponse({ok:true,buffer:Array.from(new Uint8Array(buf)),type:blob.type});
    }).catch(()=>sendResponse({ok:false}));
    return true;
  }
});
