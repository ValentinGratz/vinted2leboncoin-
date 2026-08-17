console.log(' v1.8.4 permissive');
function fetchViaBG(url){
  return new Promise((res,rej)=>{
    chrome.runtime.sendMessage({type:'FETCH_IMAGE', url}, r=>{
      if(!r||!r.ok) return rej('bg fail');
      res(new Blob([new Uint8Array(r.buffer)],{type:r.type||'image/jpeg'}));
    });
  });
}
function blobToBase64(blob){
  return new Promise(resolve=>{
    const img=new Image(); const url=URL.createObjectURL(blob);
    img.onload=()=>{
      const c=document.createElement('canvas'); c.width=img.width; c.height=img.height;
      c.getContext('2d').drawImage(img,0,0);
      URL.revokeObjectURL(url); resolve(c.toDataURL('image/jpeg',0.85));
    }; img.onerror=()=>{ URL.revokeObjectURL(url); resolve(null); }; img.src=url;
  });
}
async function scrape(){
  // PREND TOUT sans filtrer /f800/ etc
  let all=[...document.querySelectorAll('img')].map(i=>i.src||'').filter(s=>s.includes('vinted.net')||s.includes('vinted.fr')||s.includes('vinted.com')||s.includes('vinted'));
  console.log(' raw found',all);
  let uniq=[...new Set(all.map(u=>u.split('?')[0]))].slice(0,5);
  console.log(' uniq',uniq);
  if(uniq.length===0){
    // dernier fallback : prend les images visibles même petites
    uniq=[...document.querySelectorAll('img')].map(i=>i.currentSrc||i.src).filter(s=>s.startsWith('http')).slice(0,5).map(u=>u.split('?')[0]);
  }
  let b64=[];
  for(let u of uniq){
    try{ const blob=await fetchViaBG(u); const j=await blobToBase64(blob); if(j) b64.push(j); }catch(e){ console.warn(e); }
  }
  if(b64.length===0){ alert('0 photos - ouvre la console F12 et envoie moi ce qui est écrit  raw found'); return; }
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
  d.textContent='⚡ Importer (même en grand)';
  d.onclick=scrape;
  document.body.appendChild(d);
}
setInterval(addFloating,1000);
