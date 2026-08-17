console.log(' v1.8.1 fix CORS - use DOM images');
async function scrape(){
  const title=document.querySelector('h1')?.innerText?.trim()||'';
  const desc=document.querySelector('[data-testid="item-description"]')?.innerText||'';

  // on prend les vraies balises img déjà affichées (pas de crossOrigin)
  let domImgs=[...document.querySelectorAll('img')].filter(i=>{
    const s=i.src||'';
    return s.includes('vinted') && (s.includes('/f800/')||s.includes('/f640/')||s.includes('/w800/')||s.includes('/t/')) &&!s.includes('avatar') && i.naturalWidth>200;
  });

  // dedup par src
  const seen=new Set();
  let uniqImgs=[];
  for(let im of domImgs){
    const clean=im.src.split('?')[0];
    if(!seen.has(clean)){ seen.add(clean); uniqImgs.push(im); }
    if(uniqImgs.length>=5) break;
  }
  console.log(' DOM images',uniqImgs.length);

  let b64=[];
  for(let imgEl of uniqImgs){
    try{
      const w=imgEl.naturalWidth, h=imgEl.naturalHeight;
      const max=1600;
      let nw=w, nh=h;
      if(w>max||h>max){ const r=Math.min(max/w,max/h); nw=w*r; nh=h*r; }
      const canvas=document.createElement('canvas'); canvas.width=nw; canvas.height=nh;
      canvas.getContext('2d').drawImage(imgEl,0,0,nw,nh);
      b64.push(canvas.toDataURL('image/jpeg',0.85));
    }catch(e){ console.warn('canvas fail',e); }
  }

  if(b64.length===0){
    alert('0 photos - fais défiler les photos du carrousel manuellement puis re-clique (Vinted charge en lazy)');
    return;
  }

  const item={title,description:desc,imageBase64:b64,imageUrls:uniqImgs.map(i=>i.src.split('?')[0]),url:location.href};
  const r=await chrome.storage.local.get(['history']); let h=r.history||[]; h.push(item); h=h.slice(-10); await chrome.storage.local.set({history:h});
  alert(b64.length+' photos converties - va sur LBC');
}
function addBtn(){ if(document.getElementById('v2l-btn')) return; const h1=document.querySelector('h1'); if(!h1) return; const b=document.createElement('button'); b.id='v2l-btn'; b.textContent='⚡ Importer FIX v1.8.1 BASE64'; b.style.cssText='background:#ff6e14;color:#fff;padding:14px;border-radius:12px;font-weight:800;margin:12px 0;display:block;border:none;cursor:pointer'; b.onclick=scrape; h1.parentElement.appendChild(b); }
setInterval(addBtn,1500);
