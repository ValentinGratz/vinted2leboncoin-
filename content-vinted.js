console.log(' v1.8.2 fetch via background');
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
    const img=new Image();
    const url=URL.createObjectURL(blob);
    img.onload=()=>{
      const max=1600; let w=img.width, h=img.height;
      if(w>max||h>max){const ratio=Math.min(max/w,max/h); w*=ratio; h*=ratio;}
      const c=document.createElement('canvas'); c.width=w; c.height=h;
      c.getContext('2d').drawImage(img,0,0,w,h);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg',0.85));
    };
    img.onerror=()=>{ URL.revokeObjectURL(url); resolve(null); };
    img.src=url;
  });
}
async function scrape(){
  const title=document.querySelector('h1')?.innerText?.trim()||'';
  const desc=document.querySelector('[data-testid="item-description"]')?.innerText||'';
  let imgs=[...document.querySelectorAll('img')].map(i=>i.src).filter(s=>s && s.includes('vinted')).filter(s=>!s.includes('avatar'));
  let uniq=[...new Set(imgs.map(u=>u.split('?')[0]))].filter(s=>s.includes('/f800/')||s.includes('/f640/')||s.includes('/w800/')||s.includes('/t/')||s.includes('/f300/')).slice(0,5);
  if(uniq.length===0) uniq=[...document.querySelectorAll('img')].map(i=>i.currentSrc||i.src).filter(Boolean).slice(0,5).map(u=>u.split('?')[0]);
  console.log(' urls',uniq);
  let b64=[];
  for(let u of uniq){
    try{
      const blob=await fetchViaBG(u);
      const jpegBase64=await blobToBase64(blob);
      if(jpegBase64) b64.push(jpegBase64);
    }catch(e){ console.warn(e); }
  }
  if(b64.length===0){ alert('0 photos - Vinted bloque encore, ouvre la photo en grand (clic dessus) puis re-clique'); return; }
  const item={title,description:desc,imageBase64:b64,imageUrls:uniq,url:location.href};
  const r=await chrome.storage.local.get(['history']); let h=r.history||[]; h.push(item); h=h.slice(-10); await chrome.storage.local.set({history:h});
  alert(b64.length+' photos converties - va sur LBC');
}
function addBtn(){ if(document.getElementById('v2l-btn')) return; const h1=document.querySelector('h1'); if(!h1) return; const b=document.createElement('button'); b.id='v2l-btn'; b.textContent='⚡ Importer FIX v1.8.2'; b.style.cssText='background:#ff6e14;color:#fff;padding:14px;border-radius:12px;font-weight:800;margin:12px 0;display:block;border:none;cursor:pointer'; b.onclick=scrape; h1.parentElement.appendChild(b); }
setInterval(addBtn,1500);
