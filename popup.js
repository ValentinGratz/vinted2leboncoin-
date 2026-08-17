// popup.js - FIX FINAL adapté à ton popup.html (id="list" et id="clear")

document.addEventListener('DOMContentLoaded', async () => {
  const { history = [] } = await chrome.storage.local.get("history");
  const list = document.getElementById('list');
  if (!list) return;

  if (history.length === 0) {
    list.innerHTML = '<div class="empty">Aucune annonce importée<br>Va sur Vinted et clique sur le bouton orange</div>';
    return;
  }

  list.innerHTML = "";
  history.slice().reverse().forEach(item => {
    const div = document.createElement('div');
    div.className = 'card';
    // On affiche la première image via URL, pas base64
    const thumb = item.imageUrls?.[0] || item.images?.[0] || '';
    div.innerHTML = `
      <img src="${thumb}" onerror="this.style.display='none'">
      <div>
        <div style="font-weight:700;font-size:13px;line-height:1.2">${item.title || 'Sans titre'}</div>
        <div style="color:#666;font-size:12px;margin-top:4px">${item.price || ''} - ${item.imageUrls?.length || 0} photos</div>
      </div>
    `;
    list.appendChild(div);
  });
});

// Bouton existant "Vider historique"
document.getElementById('clear')?.addEventListener('click', async () => {
  await chrome.storage.local.clear();
  location.reload();
});

// NOUVEAU Bouton fix quota (fait la même chose mais plus visible)
document.getElementById('clear-storage')?.addEventListener('click', async () => {
  await chrome.storage.local.clear();
  alert("Cache vidé ! Le bug quota exceeded est réparé. Recharge tes pages Vinted.");
  location.reload();
});

// Bouton Deposer sur Leboncoin
document.getElementById('goLBC')?.addEventListener('click', () => {
  chrome.tabs.create({ url: "https://www.leboncoin.fr/deposer-une-annonce" });
});
