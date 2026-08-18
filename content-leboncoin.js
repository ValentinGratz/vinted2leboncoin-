// content-leboncoin.js - v1.7.4
// Pré-remplit le formulaire "Déposer une annonce" avec les données envoyées
// depuis une fiche Vinted. Ne publie JAMAIS automatiquement : l'utilisateur
// garde la main pour vérifier/compléter/valider avant de publier.

function sendToBackground(type, payload) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ type, payload }, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ success: false, error: chrome.runtime.lastError.message });
          return;
        }
        resolve(response || { success: false, error: "Pas de réponse" });
      });
    } catch (err) {
      resolve({ success: false, error: err.message || String(err) });
    }
  });
}

// Nécessaire pour déclencher correctement les composants contrôlés (React/Vue)
// : un simple `element.value = x` ne notifie pas le framework.
function getNativeValueSetter(element) {
  let proto = Object.getPrototypeOf(element);
  while (proto) {
    const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
    if (descriptor && descriptor.set) return descriptor.set;
    proto = Object.getPrototypeOf(proto);
  }
  return null;
}

function setFieldValue(element, value) {
  if (!element || value === undefined || value === null) return false;

  const setter = getNativeValueSetter(element);
  if (setter) {
    setter.call(element, value);
  } else {
    element.value = value;
  }

  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
  element.dispatchEvent(new Event("blur", { bubbles: true }));
  return true;
}

function findField(selectors) {
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  return null;
}

async function fillTextFields(data) {
  const filled = [];

  const titleEl = findField([
    'input[name="title"]',
    'input[id*="title"]',
    'input[placeholder*="titre" i]',
    '[data-testid*="title"] input',
  ]);
  if (titleEl && setFieldValue(titleEl, data.title)) filled.push("titre");

  const descEl = findField([
    'textarea[name="description"]',
    'textarea[id*="description"]',
    'textarea[placeholder*="description" i]',
    '[data-testid*="description"] textarea',
  ]);
  if (descEl && setFieldValue(descEl, data.description)) filled.push("description");

  const priceEl = findField([
    'input[name="price"]',
    'input[id*="price"]',
    'input[placeholder*="prix" i]',
    '[data-testid*="price"] input',
  ]);
  if (priceEl && data.price && setFieldValue(priceEl, data.price)) filled.push("prix");

  return filled;
}

// Meilleur effort pour les photos : on tente de récupérer chaque image et de
// la poser dans le champ d'upload via DataTransfer. Ça peut échouer si le
// CDN d'images source bloque le fetch cross-origin (pas de header CORS) —
// dans ce cas on log un avertissement et l'utilisateur réimporte les photos
// à la main, ce qui reste le fallback normal.
async function fillImages(images) {
  if (!images || images.length === 0) return 0;

  const fileInput = document.querySelector('input[type="file"][accept*="image"], input[type="file"]');
  if (!fileInput) {
    console.warn("[vinted2leboncoin] Aucun champ d'upload photo trouvé sur la page");
    return 0;
  }

  const files = [];
  for (const url of images.slice(0, 10)) {
    try {
      const res = await fetch(url, { mode: "cors" });
      if (!res.ok) continue;
      const blob = await res.blob();
      const filename = url.split("/").pop().split("?")[0] || `photo-${Date.now()}.jpg`;
      files.push(new File([blob], filename, { type: blob.type || "image/jpeg" }));
    } catch (err) {
      console.warn(`[vinted2leboncoin] Échec récupération image ${url} (CORS probable):`, err.message);
    }
  }

  if (files.length === 0) return 0;

  try {
    const dataTransfer = new DataTransfer();
    files.forEach((f) => dataTransfer.items.add(f));
    fileInput.files = dataTransfer.files;
    fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    return files.length;
  } catch (err) {
    console.warn("[vinted2leboncoin] Impossible d'injecter les fichiers dans l'input photo:", err.message);
    return 0;
  }
}

function showBanner(message) {
  if (document.getElementById("vc-lbc-banner")) return;

  const banner = document.createElement("div");
  banner.id = "vc-lbc-banner";
  banner.style.cssText = `
    position:fixed;top:12px;right:12px;z-index:999999;
    background:#1a3a8f;color:#fff;padding:12px 16px;border-radius:8px;
    font-size:13px;font-family:sans-serif;max-width:320px;box-shadow:0 4px 12px rgba(0,0,0,.2);
  `;
  banner.textContent = message;

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "✕";
  closeBtn.style.cssText = "margin-left:10px;background:none;border:none;color:#fff;cursor:pointer;font-weight:bold;";
  closeBtn.addEventListener("click", () => banner.remove());
  banner.appendChild(closeBtn);

  document.body.appendChild(banner);
}

async function tryFillForm(attemptsLeft) {
  const titleFieldExists = document.querySelector('input[name="title"], input[id*="title"], input[placeholder*="titre" i]');

  if (!titleFieldExists) {
    if (attemptsLeft <= 0) {
      console.warn("[vinted2leboncoin] Formulaire Leboncoin introuvable après plusieurs tentatives");
      return;
    }
    setTimeout(() => tryFillForm(attemptsLeft - 1), 700);
    return;
  }

  const pendingRes = await sendToBackground("LBC_GET_PENDING");
  if (!pendingRes.success || !pendingRes.data) return;

  const data = pendingRes.data;
  const filledFields = await fillTextFields(data);
  const filledImages = await fillImages(data.images);

  await sendToBackground("LBC_CLEAR_PENDING"); // évite un re-remplissage au prochain rechargement

  const parts = [];
  if (filledFields.length > 0) parts.push(`champs: ${filledFields.join(", ")}`);
  parts.push(`${filledImages}/${(data.images || []).length} photo(s) importée(s)`);

  showBanner(`Pré-rempli depuis Vinted (${parts.join(" — ")}). Vérifie avant de publier.`);
}

function init() {
  // SPA : le formulaire peut mettre du temps à monter, on retente plusieurs fois.
  tryFillForm(15);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
