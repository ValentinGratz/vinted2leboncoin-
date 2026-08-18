// content-leboncoin.js - v1.7.5
// Pré-remplit le formulaire "Déposer une annonce" avec les données envoyées
// depuis une fiche Vinted. Ne publie JAMAIS automatiquement.
//
// Le flow Leboncoin est un wizard multi-étapes (catégorie -> photos ->
// titre/description générés par IA -> prix -> livraison -> localisation).
// On ne peut pas deviner à quelle étape l'utilisateur se trouve, donc on
// surveille le DOM en continu (au lieu d'un essai limité dans le temps) et
// on remplit chaque champ dès qu'il apparaît, une seule fois par champ pour
// ne jamais écraser une modification manuelle de l'utilisateur.

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
  if (!element || value === undefined || value === null || value === "") return false;

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
    try {
      const el = document.querySelector(sel);
      if (el) return el;
    } catch (e) {
      // sélecteur invalide sur cette page, on continue
    }
  }
  return null;
}

const state = {
  data: null,
  filledTitle: false,
  filledDescription: false,
  filledPrice: false,
  filledImages: false,
  imagesAttemptFailed: false,
};

async function tryFillTitle() {
  if (state.filledTitle || !state.data.title) return;
  const el = findField([
    'input[name="subject"]',
    'input[name="title"]',
    'input[id*="title"]',
    'input[placeholder*="titre" i]',
    '[data-testid*="title"] input',
    '[data-qa-id*="title"] input',
  ]);
  if (el && setFieldValue(el, state.data.title)) {
    state.filledTitle = true;
    notifyProgress();
  }
}

async function tryFillDescription() {
  if (state.filledDescription || !state.data.description) return;
  const el = findField([
    'textarea[name="body"]',
    'textarea[name="description"]',
    'textarea[id*="description"]',
    'textarea[placeholder*="description" i]',
    '[data-testid*="description"] textarea',
    '[data-qa-id*="description"] textarea',
  ]);
  if (el && setFieldValue(el, state.data.description)) {
    state.filledDescription = true;
    notifyProgress();
  }
}

async function tryFillPrice() {
  if (state.filledPrice || !state.data.price) return;
  const el = findField([
    'input[name="price"]',
    'input[id*="price"]',
    'input[placeholder*="prix" i]',
    '[data-testid*="price"] input',
    '[data-qa-id*="price"] input',
  ]);
  if (el && setFieldValue(el, state.data.price)) {
    state.filledPrice = true;
    notifyProgress();
  }
}

async function tryFillImages() {
  if (state.filledImages || state.imagesAttemptFailed || !state.data.images || state.data.images.length === 0) return;

  const fileInput = document.querySelector(
    'input[type="file"][accept*="image"][multiple], input[type="file"][multiple], input[type="file"][accept*="image"], input[type="file"]'
  );
  if (!fileInput) return; // pas encore monté, on réessaiera au prochain mutation event

  console.log(`[vinted2leboncoin] Champ photo trouvé, tentative d'import de ${state.data.images.length} image(s)`);

  const files = [];
  for (const url of state.data.images.slice(0, 10)) {
    try {
      const res = await fetch(url, { mode: "cors" });
      if (!res.ok) {
        console.warn(`[vinted2leboncoin] fetch image ${url} -> HTTP ${res.status}`);
        continue;
      }
      const blob = await res.blob();
      const filename = url.split("/").pop().split("?")[0] || `photo-${Date.now()}.jpg`;
      files.push(new File([blob], filename, { type: blob.type || "image/jpeg" }));
    } catch (err) {
      console.warn(`[vinted2leboncoin] Échec fetch image ${url} (probablement bloqué par CORS côté CDN Vinted):`, err.message);
    }
  }

  if (files.length === 0) {
    state.imagesAttemptFailed = true; // on arrête d'essayer, ça ne marchera pas mieux au prochain essai
    console.warn(
      "[vinted2leboncoin] 0 photo importée automatiquement (probablement CORS). Réimporte-les manuellement avec le bouton 'Ajouter des photos'."
    );
    notifyProgress();
    return;
  }

  try {
    const dataTransfer = new DataTransfer();
    files.forEach((f) => dataTransfer.items.add(f));
    fileInput.files = dataTransfer.files;
    fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    state.filledImages = true;
    console.log(`[vinted2leboncoin] ${files.length} photo(s) injectée(s) dans le champ upload`);
  } catch (err) {
    state.imagesAttemptFailed = true;
    console.warn("[vinted2leboncoin] Impossible d'injecter les fichiers dans l'input photo:", err.message);
  }

  notifyProgress();
}

function showBanner(message) {
  let banner = document.getElementById("vc-lbc-banner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "vc-lbc-banner";
    banner.style.cssText = `
      position:fixed;top:12px;right:12px;z-index:999999;
      background:#1a3a8f;color:#fff;padding:12px 16px;border-radius:8px;
      font-size:13px;font-family:sans-serif;max-width:320px;box-shadow:0 4px 12px rgba(0,0,0,.2);
    `;
    const textSpan = document.createElement("span");
    textSpan.id = "vc-lbc-banner-text";
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "✕";
    closeBtn.style.cssText = "margin-left:10px;background:none;border:none;color:#fff;cursor:pointer;font-weight:bold;";
    closeBtn.addEventListener("click", () => banner.remove());
    banner.appendChild(textSpan);
    banner.appendChild(closeBtn);
    document.body.appendChild(banner);
  }
  document.getElementById("vc-lbc-banner-text").textContent = message;
}

function notifyProgress() {
  const parts = [];
  if (state.filledTitle) parts.push("titre");
  if (state.filledDescription) parts.push("description");
  if (state.filledPrice) parts.push("prix");
  if (state.filledImages) parts.push("photos");

  if (parts.length === 0 && !state.imagesAttemptFailed) return;

  let message = parts.length > 0 ? `Pré-rempli depuis Vinted : ${parts.join(", ")}.` : "Pré-remplissage en cours...";
  if (state.imagesAttemptFailed) {
    message += " Photos non importées automatiquement (upload manuel requis).";
  }
  message += " Vérifie avant de publier.";

  showBanner(message);

  const allDone = state.filledTitle && state.filledDescription && (state.filledImages || state.imagesAttemptFailed);
  if (allDone) {
    sendToBackground("LBC_CLEAR_PENDING");
  }
}

async function attemptFill() {
  if (!state.data) return;
  await tryFillImages();
  await tryFillTitle();
  await tryFillDescription();
  await tryFillPrice();
}

async function init() {
  const pendingRes = await sendToBackground("LBC_GET_PENDING");
  if (!pendingRes.success || !pendingRes.data) {
    return; // rien à faire, l'utilisateur navigue librement sur Leboncoin
  }

  state.data = pendingRes.data;
  showBanner("Données Vinted prêtes — en attente du formulaire...");

  attemptFill();

  // Surveillance continue : le wizard Leboncoin charge ses champs à des
  // moments différents selon l'étape (catégorie, sous-catégorie, photos...).
  const observer = new MutationObserver(() => {
    clearTimeout(init._debounce);
    init._debounce = setTimeout(attemptFill, 500);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Filet de sécurité : on arrête la surveillance après 10 minutes pour ne
  // pas laisser tourner l'observer indéfiniment si l'utilisateur abandonne.
  setTimeout(() => observer.disconnect(), 10 * 60 * 1000);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
