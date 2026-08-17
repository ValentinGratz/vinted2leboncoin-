// content-leboncoin.js - FIX FINAL avec background fetch (contourne CORS Vinted)
console.log('[V2L LBC] FIX FINAL background fetch loaded');

async function fetchViaBackground(url){
  return new Promise((resolve, reject)=>{
    chrome.runtime.sendMessage({type:'FETCH_IMAGE', url}, res=>{
      if(!res || !res.ok) return reject(res?.error||'bg fetch fail');
      const u8 = new Uint8Array(res.buffer);
      const blob = new Blob([u8], {type: res.type||'image/jpeg'});
      resolve(blob);
    });
  });
}

async function urlToFile(url, i){
  const blob = await fetchViaBackground(url);
  return new File([blob], `vinted-${i}.jpg`, {type: blob.type||'image/jpeg'});
}

async function injectFromHistory(){
  const {history} = await chrome.storage.local.get('history');
  if(!history?.length) return alert('Pas d annonce - va sur Vinted et clique orange');
  const last = history[history.length-1];
  const urls = last.imageUrls || [];
  if(!urls.length) return alert('0 urls - re-importe depuis Vinted');

  const input = document.querySelector('input[type="file"]');
  if(!input){ alert('Scroll tout en haut jusqu aux photos'); return; }

  const dt = new DataTransfer();
  let ok=0;
  for(let i=0;i<urls.length;i++){
    try{
      const file = await urlToFile(urls[i], i);
      dt.items.add(file); ok++;
    }catch(e){ console.error('fetch bg fail', urls[i], e); }
  }

  if(ok===0){ 
    alert('Echec bg fetch - glisse manuellement les miniatures (voir astuce ci-dessous)');
    return;
  }

  // Injecte
  input.files = dt.files;
  input.dispatchEvent(new Event('change',{bubbles:true}));
  input.dispatchEvent(new Event('input',{bubbles:true}));

  // trigger drop sur la zone pour bypass anti-bot
  const dropZone = document.querySelector('input[type="file"]').closest('div');
  if(dropZone){
    const evt = new DragEvent('drop', {bubbles:true, dataTransfer: dt});
    dropZone.dispatchEvent(evt);
    const dragOver = new DragEvent('dragover', {bubbles:true, dataTransfer: dt});
    dropZone.dispatchEvent(dragOver);
  }

  alert(ok+' photos injectées !');
}

function addPanel(){
  if(document.getElementById('v2l-panel')) return;
  const d=document.createElement('div'); d.id='v2l-panel';
  d.innerHTML=`
    <div style="font-weight:800;margin-bottom:8px">Vinted -> Leboncoin FIX</div>
    <button id="v2l-fill" style="background:#111;color:white">1. Remplir texte + prix</button>
    <button id="v2l-photos" style="background:#ff6e14;color:white">2. Injecter photos FIX</button>
    <div id="v2l-thumbs" style="display:flex;flex-wrap:wrap;margin-top:10px;gap:4px"></div>
    <div style="font-size:10px;color:#666;margin-top:6px;line-height:1.2">ASTUCE si 0 photos: clique droit sur une miniature orange -> Copier image -> Colle (Ctrl+V) sur la zone "Ajouter 20 photos" à gauche. Le glisser-déposer manuel est bloqué par LBC, mais le coller marche.</div>
  `;
  document.body.appendChild(d);
  document.getElementById('v2l-photos').onclick=injectFromHistory;
  document.getElementById('v2l-fill').onclick=async()=>{
    const {history}=await chrome.storage.local.get('history');
    const last=history?.[history.length-1]; if(!last) return;
    // titre
    const titleSelectors = ['input[name="subject"]','#subject','input[placeholder*="titre" i]'];
    for(let sel of titleSelectors){ const el=document.querySelector(sel); if(el){ el.focus(); el.value=last.title; el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); break; } }
    // desc
    const descEl=document.querySelector('textarea[name="body"]')||document.querySelector('textarea');
    if(descEl){ descEl.focus(); descEl.value=last.description||last.title; descEl.dispatchEvent(new Event('input',{bubbles:true})); }

    // affiche thumbs cliquables
    const thumbs=document.getElementById('v2l-thumbs'); thumbs.innerHTML='';
    for(let i=0;i<(last.imageUrls||[]).length;i++){
      const u=last.imageUrls[i];
      const img=document.createElement('img'); img.src=u; img.style.cssText='width:70px;height:70px;object-fit:cover;border-radius:8px;cursor:grab;border:1px solid #eee';
      img.draggable=true;
      img.addEventListener('dragstart', async e=>{
        try{
          const file=await urlToFile(u,i);
          e.dataTransfer.items.add(file);
          e.dataTransfer.effectAllowed='copy';
        }catch(err){ console.error(err); }
      });
      // click pour copier dans presse papier (fallback)
      img.addEventListener('click', async()=>{
        try{
          const file=await urlToFile(u,i);
          const item=new ClipboardItem({[file.type]: file});
          await navigator.clipboard.write([item]);
          alert('Image copiée ! Colle-la avec Ctrl+V sur la zone photos à gauche');
        }catch(e){
          window.open(u,'_blank');
        }
      });
      thumbs.appendChild(img);
    }
  };
}
setInterval(addPanel,2000);

// Fix drag & drop natif LBC - intercepte le drop
document.addEventListener('dragover', e=>{ if(e.dataTransfer?.types?.includes('Files')) e.preventDefault(); });
document.addEventListener('drop', e=>{ if(document.getElementById('v2l-panel')?.contains(e.target)) return; /* laisse passer */ });
