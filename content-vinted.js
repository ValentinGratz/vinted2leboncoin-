// content-vinted.js - v1.7.4 - ZERO erreur syntaxe
console.log(' v1.7.4 loaded');

async function scrapeVinted(){
  const title = document.querySelector('h1')?.innerText?.trim() || document.title.split(' - ')[0] || "Pull enfant";
  const price = document.querySelector('[data-testid="item-price"]')?.innerText || "";
  const desc = document.querySelector('[data-testid="item-description"]')?.innerText || "";

  let urls = [...document.querySelectorAll('img')]
   .map(i=>i.src)
   .filter(s=>s.includes('vinted') && s.length>30)
   .filter((v,i,a)=>a.indexOf(v)===i)
   .slice(0,8);

  console.log(' urls', urls.length);

  const item = {
    title: title,
    price: price,
    description: desc,
    imageUrls: urls,
    url: location.href,
    date: Date.now()
  };

  const res = await chrome.storage.local.get(['history']);
  let h = res.history || [];
  h.push(item);
  h = h.slice(-10);
  await chrome.storage.local.set({history: h});
  console.log(' saved', h.length);
}

function addBtn(){
  if(document.getElementById('v2l-btn')) return;
  const h1 = document.querySelector('h1');
  if(!h1) return;
  const btn = document.createElement('button');
  btn.id = 'v2l-btn';
  btn.textContent = '⚡ Importer sur Leboncoin (FIX v1.7.4)';
  btn.style.cssText = 'background:#ff6e14;color:white;border:none;padding:12px 16px;border-radius:12px;font-weight:800;cursor:pointer;margin:12px 0;display:block';
  btn.onclick = async () => {
    btn.textContent = '⏳ Extraction...';
    await scrapeVinted();
    window.open('https://www.leboncoin.fr/deposer-une-annonce','_blank');
    btn.textContent = '⚡ Importer sur Leboncoin (FIX v1.7.4)';
  };
  h1.parentElement.appendChild(btn);
}

setInterval(addBtn, 1500);
