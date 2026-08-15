
chrome.runtime.onMessage.addListener((msg)=>{
  if(msg.type==="DOWNLOAD_IMAGES" && msg.images){
    msg.images.forEach((url,i)=>{
      try{ chrome.downloads.download({url, filename:`vinted-import/image-${i+1}.jpg`}); }catch(e){}
    });
  }
});
