console.log(' v1.8.0 BASE64');
function toJpeg(url){return new Promise((res,rej)=>{
  const i=new Image(); i.crossOrigin='anonymous';
  i.onload=()=>{
    let w=i.width,h=i.height; const max=1600;
    if(w>max||h>max){const r=Math.min(max/w,max/h); w*=r; h*=r;}
    const c=document.createElement('canvas'); c.width=w; c.height=h;
    c.getContext('2d').drawImage(i,0,0,w,h);
    res(c.toDataURL('image/jpeg',0.85));
  }; i.onerror=()=>rej(); i.src=url;
});}
async function scrape(){
  const title=document.querySelector('h1')?.innerText?.trim()||'';
  const desc=document.querySelector('[data-testid="item-description"]')?.innerText||'';
  let imgs=[...document.querySelectorAll('img')].map(x=>x.src).filter(s=>s.includes('vinted')).filter(s=>!s.includes('avatar')&&!s.includes('logo'));
  let uniq=[...new Set(imgs.map(u=>u.split('?')[0]).filter(s=>s.includes('/f800/')||s.includes('/f640/')||s.includes('/t/')))].slice(0,5);
  let b64=[];
  for(let u of uniq){ try{ const d=await toJpeg(u); b64.push(d);}catch(e){} }
  const item={title,description:desc,imageBase64:b64,imageUrls:uniq,url:location.href};
  const r=await chrome.storage.local.get(['history']); let h=r.history||[]; h.push(item); h=h.slice(-10); await chrome.storage.local.set({history:h});
  alert(b64.length+' photos converties - va sur LBC');
}
function addBtn(){ if(document.getElementById('v2l-btn')) return; const h1=document.querySelector('h1'); if(!h1) return; const b=document.createElement('button'); b.id='v2l-btn'; b.textContent='⚡ Importer FIX v1.8.0 BASE64'; b.style.cssText='background:#ff6e14;color:#fff;padding:14px;border-radius:12px;font-weight:800;margin:12px 0;display:block;border:none;cursor:pointer'; b.onclick=scrape; h1.parentElement.appendChild(b); }
setInterval(addBtn,1500);
