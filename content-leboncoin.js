
console.log("[Vinted->LBC] leboncoin");
async function getLastImport(){
  const {lastImport, listings}=await chrome.storage.local.get(['lastImport','listings']);
  return lastImport || listings?.[0] || null;
}
function fillInput(sel, value){
  const el=document.querySelector(sel); if(!el||!value) return false;
  el.focus();
  const setter=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el),'value')?.set || Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;
  if(setter){ setter.call(el,value); el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); }
  else { el.value=value; el.dispatchEvent(new Event('input',{bubbles:true})); }
  return true;
}
function fillTextarea(sel,value){
  const el=document.querySelector(sel); if(!el||!value) return false;
  el.focus(); el.value=value; el.dispatchEvent(new Event('input',{bubbles:true})); return true;
}
async function autoFill(){
  const data=await getLastImport(); if(!data) return;
  if(document.getElementById('lbc-helper')) return;
  const helper=document.createElement('div');
  helper.id='lbc-helper';
  helper.innerHTML=`<div style="position:fixed;top:80px;right:20px;z-index:999999;background:white;border:2px solid #ff6e14;border-radius:16px;padding:16px;width:320px;box-shadow:0 8px 30px rgba(0,0,0,.2);font-family:Inter,sans-serif"><div style="font-weight:900;font-size:16px;margin-bottom:8px">⚡️ Annonce Vinted detectee</div><div style="font-size:13px;color:#555;margin-bottom:12px"><b>${data.title}</b><br>${data.price} EUR</div><button id="lbc-fill-btn" style="width:100%;background:#ff6e14;color:white;border:none;padding:12px;border-radius:10px;font-weight:800;cursor:pointer">Remplir automatiquement</button><div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap">${(data.images||[]).map(src=>`<img src="${src}" style="width:48px;height:48px;object-fit:cover;border-radius:6px">`).join('')}</div></div>`;
  document.body.appendChild(helper);
  document.getElementById('lbc-fill-btn').onclick=()=>doFill(data);
}
async function doFill(data){
  fillInput('input[name="subject"]', data.title) || fillInput('input[data-qa-id="ad_subject"]', data.title) || fillInput('#subject', data.title);
  const enriched = data.description + "\n\nMarque: "+(data.brand||'')+" | Taille: "+(data.size||'')+"\nImporte de Vinted: "+data.url;
  fillTextarea('textarea[name="body"]', enriched) || fillTextarea('textarea[data-qa-id="ad_body"]', enriched) || fillTextarea('#body', enriched);
  if(data.price){ fillInput('input[name="price"]', String(data.price)) || fillInput('input[data-qa-id="ad_price"]', String(data.price)); }
  chrome.runtime.sendMessage({type:"DOWNLOAD_IMAGES", images:data.images});
  alert('Formulaire pre-rempli ! Verifie la categorie et glisse les photos depuis le panneau.');
}
if(location.href.includes('deposer-une-annonce') || document.querySelector('input[name="subject"]')){
  setTimeout(autoFill,2000);
  setInterval(()=>{ if(document.querySelector('input[name="subject"]') && !document.getElementById('lbc-helper')) autoFill(); },3000);
}
