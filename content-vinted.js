console.log(' v1.8.5 no canvas');
function fetchViaBG(url){
  return new Promise((res,rej)=>{
    chrome.runtime.sendMessage({type:'FETCH_IMAGE', url}, r=>{
      if(!r||!r.ok) return rej('bg fail');
      res(new Blob([new Uint8Array(r.buffer)],{type:r.type||'image/jpeg'}));
    });
  });
}
function blobToBase64Direct(blob){
  return new Promise(resolve=>{
    const reader=new FileReader();
    reader.onloadend=()=>resolve(reader.result);
    reader.onerror=()=>resolve(null);
    reader.readAsDataURL(blob);
  });
}
async function scrape(){
  let all=[...document.querySelectorAll('img')].map(i=>i.src||'').filter(s=>s.includes('vinted'));
  console.log(' raw found',all);
  let uniq=[...new Set(all.map(u=>u.split('?')[0]))].slice(0,5);
  console.log(' uniq',uniq);
  let b64=[];
  for(let u of uniq){
    try{
      const blob=await fetchViaBG(u);
      const base64=await blobToBase64Direct(blob);
      if(base64) b64.push(base64);
    }catch(e){ console.warn('fail',u,e); }
  }
  if(b64.length===0){ alert('0 photos'); return; }
  const title=document.querySelector('h1')?.innerText||document.title;
  const desc=document.querySelector('[data-testid="item-description"]')?.innerText||'';
  const item={title,description:desc,imageBase64:b64,imageUrls:uniq};
  const r=await chrome.storage.local.get(['history']); let h=r.history||[]; h.push(item); h=h.slice(-10); await chrome.storage.local.set({history:h});
  alert(b64.length+' photos converties - va sur LBC');
}
function addFloating(){
  if(document.getElementById('v2l-float')) return;
  const d=document.createElement('div'); d.id='v2l-float';
  d.style.cssText='position:fixed!important;top:80px!important;right:20px!important;z-index:2147483647!important;background:#ff6e14!important;color:white!important;padding:14px 20px!important;border-radius:12px!important;font-weight:900!important;cursor:pointer!important;box-shadow:0 4px 20px rgba(0,0,0,.4)!important;';
  d.textContent='⚡ Importer v1.8.5';
  d.onclick=scrape;
  document.body.appendChild(d);
}
setInterval(addFloating,1000);
