// content-leboncoin.js - FIX V3 : fetch à la volée au clic
// Garde ton bouton "Remplir texte + prix" et "Drag & Drop auto"

async function fetchAsFile(url, index) {
  const res = await fetch(url);
  const blob = await res.blob();
  return new File([blob], `vinted-${Date.now()}-${index}.jpg`, { type: blob.type || 'image/jpeg' });
}

async function injectPhotosFromUrls(imageUrls) {
  const input = document.querySelector('input[type="file"]');
  if (!input) {
    console.error("[V2L] Input file Leboncoin non trouvé");
    return;
  }
  const dt = new DataTransfer();
  for (let i = 0; i < imageUrls.length; i++) {
    try {
      const file = await fetchAsFile(imageUrls[i], i);
      dt.items.add(file);
    } catch (e) {
      console.error("[V2L] fetch fail", imageUrls[i], e);
    }
  }
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.dispatchEvent(new Event('input', { bubbles: true }));
  console.log("[V2L] Photos injectées:", dt.files.length);
}

// Fonction pour le panneau à droite - à brancher sur ton bouton "2. Drag & Drop auto"
async function onClickImportPhotos() {
  const { history } = await chrome.storage.local.get("history");
  if (!history || history.length === 0) return alert("Pas d'annonce Vinted importée");
  const last = history[history.length - 1];
  await injectPhotosFromUrls(last.imageUrls);
}

// Pour les miniatures draggable orange (V3)
function createDraggableThumbs(imageUrls) {
  const container = document.getElementById('v2l-thumbs') || document.createElement('div');
  container.innerHTML = "";
  imageUrls.forEach((url, i) => {
    const img = document.createElement('img');
    img.src = url; // URL directe, pas de base64
    img.draggable = true;
    img.style.width = "70px";
    img.style.margin = "4px";
    img.style.borderRadius = "8px";
    img.style.cursor = "grab";
    img.addEventListener('dragstart', async (e) => {
      const file = await fetchAsFile(url, i);
      e.dataTransfer.items.add(file);
    });
    container.appendChild(img);
  });
}
