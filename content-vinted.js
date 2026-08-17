console.log('[V2L] FIX loaded');
function scrape(){
  const title=document.querySelector('h1')?.innerText?.trim()||"";
  const price=document.querySelector('[data-testid="item-price"]')?.innerText||document.querySelector('[itemprop="price"]')?.content||"";
  const desc=document.querySelector('[data-testid="item-description"]')?.innerText||"";
  let urls=[...document.querySelectorAll('img')].map(i=>i.src).filter(s=>s.includes('vinted') && (s.includes('f800')||s.includes('f640')||s.includes('f300'))).slice(0,8);
  if(urls.length===0) urls=[...document.querySelectorAll('img')].map(i=>i.src).filter(s=>s.includes('images')).slice(0,8);
  const item={title,price,description:desc,imageUrls:urls,url:location.href,date:Date.now()};
  chrome.storage.local.get(['history'], res=>{ let h=res.history||[]; h.push(item); h=h.slice(-10); chrome.storage.local.set({history:h}); });
}
function addBtn(){ if(document.getElementById('v2l-btn')) return; const h1=document.querySelector('h1'); if(!h1) return; const b=document.createElement('button'); b.id='v2l-btn'; b.textContent='⚡️ Importer sur Leboncoin (FIX)'; b.onclick=()=>{scrape(); window.open('https://www.leboncoin.fr/deposer-une-annonce','_blank')}; h1.parentElement?.appendChild(b); }
setInterval(addBtn,2000);
