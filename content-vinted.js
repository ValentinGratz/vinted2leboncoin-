
console.log("[Vinted->LBC] charge");
function extractVintedData(){
  const title = document.querySelector('h1[data-testid="item-title"]')?.innerText || document.querySelector('h1')?.innerText || "";
  const descEl = document.querySelector('[data-testid="item-description"]') || document.querySelector('[itemprop="description"]');
  const description = descEl?.innerText || "";
  const priceText = document.querySelector('[data-testid="item-price"]')?.innerText || "";
  const price = parseFloat(priceText.replace(/[^0-9.,]/g,'').replace(',','.')) || 0;
  const imgNodes = [...document.querySelectorAll('img')];
  const images = [...new Set(imgNodes.map(i=>i.src).filter(s=>s && s.includes('vinted') && s.startsWith('http')).slice(0,10))];
  let brand="", size="", condition="", color="";
  document.querySelectorAll('[data-testid*="attribute"], .details-list__item, [class*="details"]').forEach(row=>{
    const txt=row.innerText.toLowerCase();
    if(txt.includes('marque')) brand=row.innerText.split('\n').pop();
    if(txt.includes('taille')) size=row.innerText.split('\n').pop();
    if(txt.includes('etat') || txt.includes('état')) condition=row.innerText.split('\n').pop();
  });
  return {title, description, price, images, brand, size, condition, color, url: location.href, createdAt: Date.now()};
}
function injectButton(){
  if(document.getElementById('vinted-to-lbc-btn')) return;
  const anchor = document.querySelector('h1[data-testid="item-title"]') || document.querySelector('h1');
  if(!anchor) return;
  const btn=document.createElement('button');
  btn.id='vinted-to-lbc-btn';
  btn.innerHTML='⚡️ Importer sur Leboncoin';
  btn.style.cssText='background:#ff6e14;color:white;border:none;padding:12px 18px;border-radius:12px;font-weight:800;font-size:15px;cursor:pointer;margin:12px 0;box-shadow:0 4px 12px rgba(255,110,20,.4);z-index:99999;display:flex;align-items:center;gap:8px;';
  btn.onclick=async()=>{
    btn.innerHTML='⏳ Extraction...';
    const data=extractVintedData();
    if(!data.title){ alert('Impossible de lire. Recharge.'); btn.innerHTML='⚡️ Importer'; return; }
    const {listings=[]}=await chrome.storage.local.get('listings');
    listings.unshift(data);
    await chrome.storage.local.set({listings:listings.slice(0,50), lastImport:data});
    btn.innerHTML='✅ Importé !';
    const toast=document.createElement('div');
    toast.innerText='"'+data.title+'" pret';
    toast.style.cssText='position:fixed;bottom:20px;right:20px;background:#111;color:#fff;padding:14px 18px;border-radius:12px;z-index:9999999;font-weight:600;';
    document.body.appendChild(toast);
    setTimeout(()=>toast.remove(),4000);
    window.open('https://www.leboncoin.fr/deposer-une-annonce','_blank');
  };
  anchor.parentElement.insertBefore(btn, anchor.nextSibling);
}
setInterval(injectButton,1500);
