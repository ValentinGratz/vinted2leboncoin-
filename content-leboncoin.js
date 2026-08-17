// content-leboncoin.js v1.7.7 STABLE - no reload loop
console.log('[V2L LBC] v1.7.7 stable');

function injectCSS(){
  if(document.getElementById('v2l-style')) return;
  const s=document.createElement('style'); s.id='v2l-style';
  s.textContent=`#v2l-panel{position:fixed!important;top:100px!important;right:20px!important;z-index:2147483647!important;background:white!important;border:2px solid #ff6e14!important;border-radius:14px!important;padding:14px!important;width:280px!important;box-shadow:0 8px 30px rgba(0,0,0,.25)!important}`;
  document.head.appendChild(s);
}

async function fetchViaBackground(url){
  return new Promise((res,rej)=>{
    chrome.runtime.sendMessage({type:'FETCH_IMAGE', url}, r=>{
      if(!r||!r.ok) return rej('fail');
      res(new Blob([new Uint8Array(r.buffer)],{type:r.type||'image/jpeg'}));
    });
  });
}

let thumbsLoaded = false; // <- ANTI-BOUCLE

async function loadThumbs(){
  if(thumbsLoaded) return; // ne charge qu'une fois
  const {history}=await chrome.storage.local.get('history');
  const last=history?.[history.length-1]; if(!last) return;
  const container=document.getElementById('v2l-thumbs'); if(!container) return;

  thumbsLoaded = true; // bloque les prochains appels
  container.innerHTML='Chargement...';
  container.innerHTML='';

  for(let i=0;i<last.imageUrls.length;i++){
    try{
      const blob=await fetchViaBackground(last.imageUrls[i]);
      const url=URL.createObjectURL(blob);
      const img=document.createElement('img');
      img.src=url;
      img.style.cssText='width:70px;height:70px;object-fit:cover;border-radius:8px;margin:4px;border:1px solid #eee';
      container.appendChild(img);
    }catch(e){ console.error(e); }
  }
}

function addPanel(){
  injectCSS();
  if(document.getElementById('v2l-panel')) return; // <- ne recrée pas si existe déjà
  const d=document.createElement('div'); d.id='v2l-panel';
  d.innerHTML=`<div style="font-weight:800;margin-bottom:8px">Vinted -> Leboncoin FIX</div><button id="v2l-fill" style="background:#111;color:white">1. Remplir texte + prix</button><button id="v2l-photos" style="background:#ff6e14;color:white">2. Injecter photos FIX</button><div id="v2l-thumbs" style="display:flex;flex-wrap:wrap;margin-top:10px"></div>`;
  document.body.appendChild(d);
  document.getElementById('v2l-photos').onclick=async()=>{
    const {history}=await chrome.storage.local.get('history');
    const last=history?.[history.length-1];
    const input=document.querySelector('input[type="file"]');
    const dt=new DataTransfer();
    for(let i=0;i<last.imageUrls.length;i++){
      try{ const b=await fetchViaBackground(last.imageUrls[i]); dt.items.add(new File([b],`v-${i}.jpg`,{type:'image/jpeg'})); }catch(e){}
    }
    input.files=dt.files;
    input.dispatchEvent(new Event('change',{bubbles:true}));
    alert(dt.files.length+' photos injectées');
  };
  loadThumbs();
}

// UNE SEULE FOIS au chargement, pas toutes les 2 sec pour les thumbs
addPanel();
setInterval(()=>{ if(!document.getElementById('v2l-panel')) { thumbsLoaded=false; addPanel(); } }, 3000);
