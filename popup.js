document.addEventListener('DOMContentLoaded', async () => {
  const { history = [] } = await chrome.storage.local.get("history");
  const list = document.getElementById('list');
  if(!list) return;
  if(history.length===0){ list.innerHTML='<div class="empty">Aucune annonce<br>Va sur Vinted</div>'; return; }
  list.innerHTML="";
  history.slice().reverse().forEach(item=>{
    const div=document.createElement('div'); div.className='card';
    const thumb=item.imageUrls?.[0]||item.images?.[0]||'';
    div.innerHTML=`<img src="${thumb}"><div><div style="font-weight:700;font-size:13px">${(item.title||'Sans titre').slice(0,60)}</div><div style="color:#666;font-size:12px;margin-top:4px">${item.price||''} - ${item.imageUrls?.length||item.images?.length||0} photos</div></div>`;
    list.appendChild(div);
  });
});
document.getElementById('clear')?.addEventListener('click', async()=>{ await chrome.storage.local.clear(); location.reload(); });
document.getElementById('clear-storage')?.addEventListener('click', async()=>{ await chrome.storage.local.clear(); alert('Cache vide !'); location.reload(); });
document.getElementById('goLBC')?.addEventListener('click',()=>{ chrome.tabs.create({url:"https://www.leboncoin.fr/deposer-une-annonce"}); });
