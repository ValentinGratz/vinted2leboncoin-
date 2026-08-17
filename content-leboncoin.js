// content-leboncoin.js v1.7.7 - thumbnails via blob (fix miniatures cassées)
console.log('[V2L LBC] v1.7.7 blob thumbs');

function injectCSS(){
  const s=document.createElement('style');
  s.textContent=`#v2l-panel{position:fixed!important;top:100px!important;right:20px!important;z-index:2147483647!important;background:white!important;border:2px solid #ff6e14!important;border-radius:14px!important;padding:14px!important;width:280px!important;box-shadow:0 8px 30px rgba(0,0,0,.25)!important}#v2l-panel button{width:100%!important;padding:10px!important;border:none!important;border-radius:8px!important;font-weight:800!important;cursor:pointer!important;margin-bottom:8px!important}`;
  document.head.appendChild(s);
}

async function fetchViaBackground(url){
  return new Promise((res,rej)=>{
    chrome.runtime.sendMessage({type:'FETCH_IMAGE', url}, r=>{
      if(!r||!r.ok) return rej(r?.error||'fail');
      const blob=new Blob([new Uint8Array(r.buffer)],{type:r.type||'image/jpeg'});
      res(blob);
    });
  });
}
async function urlToFile(url,i){
  const blob=await fetchViaBackground(url);
  return new File([blob],`vinted-${i}.jpg`,{type:blob.type});
}

async function injectFromHistory(){
  const {history}=await chrome.storage.local.get('history');
  const last=history?.[history.length-1];
  if(!last) return alert('Pas d annonce');
  const input=document.querySelector('input[type="file"]');
  if(!input) return alert('Scroll vers photos');
  const dt=new DataTransfer();
  let ok=0;
  for(let i=0;i<last.imageUrls.length;i++){
    try{ dt.items.add(await urlToFile(last.imageUrls[i],i)); ok++; }catch(e){ console.error(e); }
  }
  if(ok===0) return alert('0 photos - re-importe depuis Vinted');
  input.files=dt.files;
  input.dispatchEvent(new Event('change',{bubbles:true}));
  alert(ok+' photos injectées');
}

async function loadThumbs(){
  const {history}=await chrome.storage.local.get('history');
  const last=history?.[history.length-1];
  if(!last) return;
  const container=document.getElementById('v2l-thumbs');
  if(!container) return;
  container.innerHTML='';
  for(let i=0;i<last.imageUrls.length;i++){
    const url=last.imageUrls[i];
    try{
      const blob=await fetchViaBackground(url);
      const blobUrl=URL.createObjectURL(blob);
      const img=document.createElement('img');
      img.src=blobUrl;
      img.style.cssText='width:70px;height:70px;object-fit:cover;border-radius:8px;margin:4px;border:1px solid #eee;cursor:grab';
      img.draggable=true;
      img.addEventListener('dragstart', async e=>{
        const file=await urlToFile(url,i);
        e.dataTransfer.items.add(file);
      });
      container.appendChild(img);
    }catch(e){
      console.error('thumb fail',url);
    }
  }
}

function addPanel(){
  if(document.getElementById('v2l-panel')){ loadThumbs(); return; }
  injectCSS();
  const d=document.createElement('div'); d.id='v2l-panel';
  d.innerHTML=`<div style="font-weight:800;margin-bottom:8px">Vinted -> Leboncoin FIX</div><button id="v2l-fill" style="background:#111;color:white">1. Remplir texte + prix</button><button id="v2l-photos" style="background:#ff6e14;color:white">2. Injecter photos FIX</button><div id="v2l-thumbs" style="display:flex;flex-wrap:wrap;margin-top:10px"></div>`;
  document.body.appendChild(d);
  document.getElementById('v2l-photos').onclick=injectFromHistory;
  document.getElementById('v2l-fill').onclick=async()=>{
    const {history}=await chrome.storage.local.get('history');
    const last=history?.[history.length-1]; if(!last) return;
    const t=document.querySelector('input[name="subject"]')||document.querySelector('#subject');
    if(t){ t.value=last.title; t.dispatchEvent(new Event('input',{bubbles:true})); }
    await loadThumbs();
  };
  loadThumbs();
}
setInterval(addPanel,2000);
