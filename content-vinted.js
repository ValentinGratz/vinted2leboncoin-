console.log(' v1.8.3 floating button');
function fetchViaBG(url){
  return new Promise((res,rej)=>{
    chrome.runtime.sendMessage({type:'FETCH_IMAGE', url}, r=>{
      if(!r||!r.ok) return rej();
      res(new Blob([new Uint8Array(r.buffer)],{type:r.type||'image/jpeg'}));
    });
  });
}
function blobToBase64(blob){
  return new Promise(resolve=>{
    const img=new Image(); const url=URL.createObjectURL(blob);
    img.onload=()=>{
      const max=1600; let w=img.width,h=img.height;
      if(w>max||h>max){const ra=Math.min(max/w,max/h); w*=ra; h*=ra;}
      const c=document.createElement('canvas'); c.width=w; c.height=h;
      c.getContext('2d').drawImage(img,0,0,w,h);
      URL.revokeObjectURL(url); resolve(c.toDataURL('image/jpeg',0.85));
    }; img.onerror=()=>{ URL.revokeObjectURL(url); resolve(null); }; img.src=url;
  });
}
async function scrape(){
  // on prend TOUTES les images vinted même dans la lightbox
  let imgs=[...document.querySelectorAll('img')].map(i=>i.src||i.currentSrc||'').filter(s=>s.includes('vinted'));
  let uniq=[...new Set(imgs.map(u=>u.split('?')[0]))].filter(s=>s.match(/\/(f800|f640|w800|w1280|f300|o\/)/)).slice(0,5);
  console.log(' urls',uniq);
  let b64=[];
  for(let u of uniq){ try{ const blob=await fetchViaBG(u); const j=await blobToBase64(blob); if(j) b64.push(j); }catch(e){} }
  if(b64.length===0){ alert('0 photos - reste dans la grande photo et re-clique sur le bouton flottant orange en haut à droite'); return; }
  const title=document.querySelector('h1')?.innerText||document.title;
  const desc=document.querySelector('[data-testid="item-description"]')?.innerText||'';
  const item={title,description:desc,imageBase64:b64,imageUrls:uniq};
  const r=await chrome.storage.local.get(['history']); let h=r.history||[]; h.push(item); h=h.slice(-10); await chrome.storage.local.set({history:h});
  alert(b64.length+' photos converties - va sur LBC');
}
function addFloating(){
  if(document.getElementById('v2l-float')) return;
  const d=document.createElement('div'); d.id='v2l-float';
  d.style.cssText='position:fixed!important;top:80px!important;right:20px!important;z-index:2147483647!important;background:#ff6e14!important;color:white!important;padding:14px 20px!important;border-radius:12px!important;font-weight:900!important;cursor:pointer!important;box-shadow:0 4px 20px rgba(0,0,0,.4)!important;font-family:sans-serif!important';
  d.textContent='⚡ Importer (même en grand)';
  d.onclick=scrape;
  document.body.appendChild(d);
}
setInterval(addFloating,1000);
