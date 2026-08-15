
async function render(){
  const {listings=[]}=await chrome.storage.local.get('listings');
  const list=document.getElementById('list');
  if(!listings.length){ list.innerHTML='<div class=empty>Aucune annonce. Va sur Vinted.</div>'; return; }
  list.innerHTML=listings.map(l=>`<div class=card><img src="${l.images?.[0]||''}"><div><b>${l.title.slice(0,48)}</b><br><span>${l.price} EUR</span></div></div>`).join('');
}
document.getElementById('goLBC').onclick=()=>chrome.tabs.create({url:'https://www.leboncoin.fr/deposer-une-annonce'});
document.getElementById('clear').onclick=async()=>{ await chrome.storage.local.set({listings:[]}); render(); };
render();
