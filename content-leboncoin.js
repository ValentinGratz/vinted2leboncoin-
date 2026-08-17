// content-leboncoin.js v1.7.8 - fix input hidden + fix textes
console.log('[V2L LBC] v1.7.8 fix input hidden');

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

function findFileInput(){
  // essaie tous les moyens
  let input = document.querySelector('input[type="file"]');
  if(input) return input;
  input = [...document.querySelectorAll('input')].find(i=>i.type==='file');
  if(input) return input;
  // dans les shadow DOM
  const all = document.querySelectorAll('*');
  for(let el of all){
    if(el.shadowRoot){
      const inp = el.shadowRoot.querySelector('input[type="file"]');
      if(inp) return inp;
    }
  }
  return null;
}

async function injectPhotos(){
  const {history}=await chrome.storage.local.get('history');
  const last=history?.[history.length-1];
  if(!last?.imageUrls?.length) return alert('Pas de photos - re-importe Vinted');

  let input = findFileInput();
  console.log(' input found:', input);
  if(!input){
    // fallback: crée un input temporaire et drop sur la zone
    alert('Input LBC caché - je tente le drop direct sur "Ajouter 19 photos"');
    const dropZone = document.querySelector('[class*="upload"]') || document.querySelector('button')?.parentElement;
    const dt = new DataTransfer();
    for(let i=0;i<last.imageUrls.length;i++){
      try{ const b=await fetchViaBackground(last.imageUrls[i]); dt.items.add(new File([b],`v-${i}.jpg`,{type:'image/jpeg'})); }catch(e){}
    }
    if(dropZone){
      dropZone.dispatchEvent(new DragEvent('dragenter',{bubbles:true,dataTransfer:dt}));
      dropZone.dispatchEvent(new DragEvent('dragover',{bubbles:true,dataTransfer:dt}));
      dropZone.dispatchEvent(new DragEvent('drop',{bubbles:true,dataTransfer:dt}));
      alert(dt.files.length+' photos droppées - si ça marche pas, clique manuellement sur Ajouter 19 photos');
    }
    return;
  }

  const dt=new DataTransfer();
  for(let i=0;i<last.imageUrls.length;i++){
    try{ const b=await fetchViaBackground(last.imageUrls[i]); dt.items.add(new File([b],`v-${i}.jpg`,{type:'image/jpeg'})); }catch(e){ console.error(e); }
  }
  if(dt.files.length===0) return alert('0 photos fetchées - CORS bloque encore');

  input.files=dt.files;
  input.dispatchEvent(new Event('change',{bubbles:true}));
  input.dispatchEvent(new Event('input',{bubbles:true}));
  alert(dt.files.length+' photos injectées!');
}

function fillText(){
  chrome.storage.local.get(['history'], res=>{
    const last=res.history?.[res.history.length-1];
    if(!last) return alert('Pas d annonce');
    // titre - nouveau selecteur LBC
    const titleSelectors=['input[name="subject"]','#subject','input[data-testid="ad-subject"]','input[placeholder*="titre" i]'];
    let t=null;
    for(let s of titleSelectors){ t=document.querySelector(s); if(t) break; }
    if(!t) t=document.querySelector('input[type="text"]');
    if(t){ t.focus(); t.value=last.title; t.dispatchEvent(new Event('input',{bubbles:true})); t.dispatchEvent(new Event('change',{bubbles:true})); console.log(' title filled',last.title); }
    else alert('Titre non trouvé - copie colle manuellement');

    // desc
    const descEl=document.querySelector('textarea[name="body"]')||document.querySelector('textarea');
    if(descEl){ descEl.focus(); descEl.value=last.description||last.title; descEl.dispatchEvent(new Event('input',{bubbles:true})); }
  });
}

let thumbsLoaded=false;
async function loadThumbs(){
  if(thumbsLoaded) return;
  const {history}=await chrome.storage.local.get('history');
  const last=history?.[history.length-1]; if(!last) return;
  const c=document.getElementById('v2l-thumbs'); if(!c) return;
  thumbsLoaded=true; c.innerHTML='';
  for(let u of last.imageUrls){
    try{
      const b=await fetchViaBackground(u);
      const url=URL.createObjectURL(b);
      const img=document.createElement('img'); img.src=url; img.style.cssText='width:60px;height:60px;object-fit:cover;border-radius:8px;margin:3px';
      c.appendChild(img);
    }catch(e){}
  }
}

function addPanel(){
  injectCSS();
  if(document.getElementById('v2l-panel')) return;
  const d=document.createElement('div'); d.id='v2l-panel';
  d.innerHTML=`<div style="font-weight:800;margin-bottom:8px">Vinted -> Leboncoin FIX v1.7.8</div><button id="v2l-fill" style="background:#111;color:white;width:100%;padding:10px;border:none;border-radius:8px;font-weight:800;margin-bottom:8px">1. Remplir texte + prix</button><button id="v2l-photos" style="background:#ff6e14;color:white;width:100%;padding:10px;border:none;border-radius:8px;font-weight:800">2. Injecter photos FIX</button><div id="v2l-thumbs" style="display:flex;flex-wrap:wrap;margin-top:10px"></div><div style="font-size:10px;color:#888;margin-top:6px" id="v2l-log"></div>`;
  document.body.appendChild(d);
  document.getElementById('v2l-fill').onclick=fillText;
  document.getElementById('v2l-photos').onclick=injectPhotos;
  document.getElementById('v2l-log').textContent='Input:
