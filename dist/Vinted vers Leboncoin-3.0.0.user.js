
// ==UserScript==
// @name         Vinted vers Leboncoin
// @namespace    ValentinGratz
// @version      3.0.0
// @description  Transfert des annonces Vinted vers Leboncoin avec import direct des photos.
// @match        https://www.vinted.fr/*
// @match        https://www.vinted.com/*
// @match        https://www.leboncoin.fr/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_xmlhttpRequest
// @connect      vinted.net
// @connect      *.vinted.net
// @connect      vinted.com
// @connect      *.vinted.com
// @connect      vinted.fr
// @connect      *.vinted.fr
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
  "use strict";

  const PREFIX = "[Vinted2Leboncoin]";
  const KEY_PENDING = "vc_lbc_pending";
  const KEY_IMPORTED = "vc_lbc_imported";

  const isVinted = location.hostname.includes("vinted.");
  const isLeboncoin = location.hostname.includes("leboncoin.");

  // ---------------------------------------------------------
  // STOCKAGE COMMUN AUX DEUX SITES
  // ---------------------------------------------------------

  async function getValue(key, fallback = null) {
    try {
      return await GM_getValue(key, fallback);
    } catch (err) {
      console.error(PREFIX, "Lecture stockage impossible", err);
      return fallback;
    }
  }

  async function setValue(key, value) {
    try {
      await GM_setValue(key, value);
      return true;
    } catch (err) {
      console.error(PREFIX, "Écriture stockage impossible", err);
      return false;
    }
  }

  async function deleteValue(key) {
    try {
      await GM_deleteValue(key);
    } catch (err) {
      console.error(PREFIX, "Suppression stockage impossible", err);
    }
  }

  function extractId(url) {
    const match = (url || "").match(/\/items\/(\d+)/);
    return match
      ? match[1]
      : Date.now().toString() + Math.random().toString(36).slice(2);
  }

  async function getImportedIds() {
    const ids = await getValue(KEY_IMPORTED, []);
    return Array.isArray(ids) ? ids : [];
  }

  async function markImported(id) {
    const ids = await getImportedIds();
    if (!ids.includes(id)) {
      ids.push(id);
      await setValue(KEY_IMPORTED, ids);
    }
  }

  async function unmarkImported(id) {
    const ids = await getImportedIds();
    await setValue(KEY_IMPORTED, ids.filter((x) => x !== id));
  }

  // ---------------------------------------------------------
  // RÉCUPÉRATION DES PHOTOS VINTED
  // ---------------------------------------------------------

  function downloadImageAsDataUrl(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET",
        url,
        responseType: "blob",
        timeout: 30000,

        onload(response) {
          if (response.status < 200 || response.status >= 300) {
            reject(new Error("HTTP " + response.status));
            return;
          }

          const blob = response.response;

          if (!(blob instanceof Blob) || blob.size === 0) {
            reject(new Error("Image vide ou invalide"));
            return;
          }

          const reader = new FileReader();

          reader.onload = () => {
            resolve({
              url,
              dataUrl: reader.result,
              filename: filenameFromUrl(url),
            });
          };

          reader.onerror = () => reject(new Error("Lecture image impossible"));
          reader.readAsDataURL(blob);
        },

        onerror() {
          reject(new Error("Erreur réseau pendant la récupération de la photo"));
        },

        ontimeout() {
          reject(new Error("Délai dépassé pour la photo"));
        },
      });
    });
  }

  function filenameFromUrl(url) {
    try {
      const name = new URL(url).pathname.split("/").pop();
      return name || "photo.jpg";
    } catch (err) {
      return "photo.jpg";
    }
  }

  async function prepareImages(urls) {
    const results = [];

    // On traite les images une par une pour limiter la charge mémoire.
    for (const url of urls.slice(0, 10)) {
      try {
        const image = await downloadImageAsDataUrl(url);
        results.push(image);
        console.log(PREFIX, "Photo récupérée :", image.filename);
      } catch (err) {
        console.warn(PREFIX, "Photo non récupérée :", url, err);
      }
    }

    return results;
  }

  // ---------------------------------------------------------
  // EXTRACTION DES DONNÉES VINTED
  // ---------------------------------------------------------

  function parseJsonLdProduct() {
    const scripts = document.querySelectorAll(
      'script[type="application/ld+json"]'
    );

    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent);
        const candidates = Array.isArray(data) ? data : [data];

        for (const candidate of candidates) {
          if (
            candidate &&
            (candidate["@type"] === "Product" ||
             candidate["@type"] === "Offer")
          ) {
            return candidate;
          }
        }
      } catch (err) {
        // On ignore les données JSON-LD invalides.
      }
    }

    return null;
  }

  function getImageUrl(img) {
    const candidate =
      img.currentSrc ||
      img.getAttribute("data-src") ||
      img.getAttribute("data-original") ||
      img.src ||
      "";

    if (!candidate || candidate.startsWith("data:")) {
      return null;
    }

    return candidate;
  }

  function extractSingleItemData() {
    const ld = parseJsonLdProduct();

    let title = ld && ld.name;
    let description = ld && ld.description;

    let price =
      ld &&
      ld.offers &&
      (ld.offers.price ||
        (Array.isArray(ld.offers) &&
          ld.offers[0] &&
          ld.offers[0].price));

    if (!title) {
      const titleEl = document.querySelector(
        'h1, [data-testid="item-page-summary-plugin"] h1, [itemprop="name"]'
      );

      title = titleEl ? titleEl.textContent.trim() : "";
    }

    if (!description) {
      const descEl = document.querySelector(
        '[data-testid="item-description-content"], ' +
        '[itemprop="description"], [class*="description"]'
      );

      description = descEl ? descEl.textContent.trim() : "";
    }

    if (!price) {
      const priceEl = document.querySelector(
        '[data-testid$="price"], [itemprop="price"], [class*="price"]'
      );

      price = priceEl
        ? priceEl.getAttribute("content") || priceEl.textContent
        : "";
    }

    // Collecte des photos de la galerie de l'annonce.
    const photoKey = (url) => {
      try {
        return new URL(url, location.origin).pathname
          .split("/")
          .filter((part) => part && !/^(f\d+|\d+x\d+)$/i.test(part))
          .join("/");
      } catch (err) {
        return url;
      }
    };

    const collectImages = (nodes) => {
      const seen = new Set();
      const images = [];

      nodes.forEach((img) => {
        const url = getImageUrl(img);
        if (!url) return;

        const key = photoKey(url);

        if (!seen.has(key)) {
          seen.add(key);
          images.push(url);
        }
      });

      return images;
    };

    const exactNodes = Array.from(
      document.querySelectorAll('img[data-testid^="item-photo-"]')
    ).filter(
      (img) =>
        !img.closest(
          '[data-testid*="feed"], [data-testid*="closet"], ' +
          '[data-testid*="similar"], [data-testid*="product-item"]'
        )
    );

    let images = collectImages(exactNodes);

    if (images.length === 0) {
      const gallery = document.querySelector(
        '[data-testid="item-photos"], ' +
        '[data-testid*="item-photos"], .item-photos'
      );

      if (gallery) {
        images = collectImages(
          Array.from(gallery.querySelectorAll("img"))
        );
      }
    }

    if (images.length === 0 && ld && ld.image) {
      images = (Array.isArray(ld.image) ? ld.image : [ld.image])
        .filter((url) => typeof url === "string");
    }

    return {
      id: extractId(location.href),
      sourceUrl: location.href,
      title: String(title || "").trim().slice(0, 200),
      description: String(description || "").trim().slice(0, 4000),
      price: String(price || "")
        .replace(/[^\d,.\s€]/g, "")
        .trim(),
      imageUrls: images.slice(0, 10),
      ts: Date.now(),
    };
  }

  // ---------------------------------------------------------
  // DÉTECTION DES ANNONCES PERSONNELLES
  // ---------------------------------------------------------

  function isMyItem() {
    return Boolean(
      document.querySelector(
        '[data-testid="item-edit-button"], ' +
        '[data-testid="item-bump-button"], ' +
        '[data-testid="item-delete-button"]'
      )
    );
  }

  function showVintedButton() {
    if (document.getElementById("vc-lbc-transfer-btn")) return;

    if (!isMyItem()) return;

    const anchor =
      document.querySelector('[data-testid="item-page-summary-plugin"]') ||
      document.querySelector("h1")?.parentElement ||
      document.body;

    const btn = document.createElement("button");

    btn.id = "vc-lbc-transfer-btn";
    btn.textContent = "Envoyer vers Leboncoin";

    btn.style.cssText = `
      display:block;
      margin:12px 0;
      padding:11px 16px;
      background:#ff6e14;
      color:white;
      border:0;
      border-radius:7px;
      font-size:14px;
      font-weight:700;
      cursor:pointer;
      z-index:9999;
    `;

    anchor.appendChild(btn);

    const itemId = extractId(location.href);

    getImportedIds().then((ids) => {
      if (ids.includes(itemId)) {
        setImportedButton(btn);
      }
    });

    btn.addEventListener("click", async () => {
      btn.disabled = true;
      btn.textContent = "Récupération des données...";

      try {
        const payload = extractSingleItemData();

        if (!payload.title) {
          throw new Error("Impossible de récupérer le titre.");
        }

        if (!payload.imageUrls.length) {
          console.warn(PREFIX, "Aucune photo détectée.");
        }

        btn.textContent = "Récupération des photos...";

        const images = await prepareImages(payload.imageUrls);

        const transfer = {
          id: payload.id,
          sourceUrl: payload.sourceUrl,
          title: payload.title,
          description: payload.description,
          price: payload.price,
          images,
          ts: Date.now(),
        };

        const saved = await setValue(KEY_PENDING, transfer);

        if (!saved) {
          throw new Error("Impossible de sauvegarder les données.");
        }

        await markImported(payload.id);

        btn.textContent = "Ouverture de Leboncoin...";

        window.open(
          "https://www.leboncoin.fr/deposer-une-annonce",
          "_blank"
        );

        setImportedButton(btn);

        console.log(
          PREFIX,
          "Transfert préparé :",
          transfer.title,
          images.length + " photo(s)"
        );
      } catch (err) {
        console.error(PREFIX, "Erreur transfert :", err);

        btn.disabled = false;
        btn.textContent = "Erreur, réessayer";
        alert("Erreur pendant le transfert : " + err.message);
      }
    });
  }

  function setImportedButton(btn) {
    btn.textContent = "✓ Importé sur Leboncoin";
    btn.disabled = true;
    btn.style.background = "#2e7d32";
    btn.style.cursor = "default";

    if (document.getElementById("vc-lbc-reimport-link")) return;

    const link = document.createElement("a");
    link.id = "vc-lbc-reimport-link";
    link.href = "#";
    link.textContent = "réimporter";

    link.style.cssText = `
      margin-left:10px;
      font-size:12px;
      color:#666;
      text-decoration:underline;
      cursor:pointer;
    `;

    link.addEventListener("click", async (event) => {
      event.preventDefault();

      await unmarkImported(extractId(location.href));

      link.remove();
      btn.disabled = false;
      btn.textContent = "Envoyer vers Leboncoin";
      btn.style.background = "#ff6e14";
      btn.style.cursor = "pointer";
    });

    btn.insertAdjacentElement("afterend", link);
  }

  // ---------------------------------------------------------
  // BADGES SUR LES ANNONCES DU DRESSING
  // ---------------------------------------------------------

  function extractCardId(node) {
    const link =
      node.querySelector('a[href*="/items/"]') ||
      (node.tagName === "A" && node.href ? node : null);

    if (!link) return null;

    return extractId(link.href);
  }

  async function applyImportedBadges() {
    const ids = await getImportedIds();

    if (!ids.length) return;

    const nodes = document.querySelectorAll(
      'article[data-testid], a[href*="/items/"], ' +
      'div[data-testid*="item-box"]'
    );

    nodes.forEach((node) => {
      const id = extractCardId(node);

      if (!id || !ids.includes(id)) return;
      if (node.querySelector(".vc-lbc-badge")) return;

      if (getComputedStyle(node).position === "static") {
        node.style.position = "relative";
      }

      const badge = document.createElement("div");
      badge.className = "vc-lbc-badge";
      badge.textContent = "✓ LBC";

      badge.style.cssText = `
        position:absolute;
        top:4px;
        right:4px;
        z-index:50;
        background:#2e7d32;
        color:white;
        font-size:10px;
        font-weight:700;
        padding:2px 6px;
        border-radius:4px;
        pointer-events:none;
        font-family:sans-serif;
      `;

      node.appendChild(badge);
    });
  }

  // ---------------------------------------------------------
  // LEBONCOIN : REMPLISSAGE DU FORMULAIRE
  // ---------------------------------------------------------

  const lbcState = {
    data: null,
    filledTitle: false,
    filledDescription: false,
    filledPrice: false,
    filledImages: false,
    imagesAttemptFailed: false,
    imagesInProgress: false,
  };

  function getNativeValueSetter(element) {
    let proto = Object.getPrototypeOf(element);

    while (proto) {
      const descriptor = Object.getOwnPropertyDescriptor(proto, "value");

      if (descriptor && descriptor.set) {
        return descriptor.set;
      }

      proto = Object.getPrototypeOf(proto);
    }

    return null;
  }

  function setFieldValue(element, value) {
    if (
      !element ||
      value === undefined ||
      value === null ||
      value === ""
    ) {
      return false;
    }

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
    for (const selector of selectors) {
      try {
        const element = document.querySelector(selector);
        if (element) return element;
      } catch (err) {
        // Sélecteur non compatible, on continue.
      }
    }

    return null;
  }

  function showBanner(message) {
    let banner = document.getElementById("vc-lbc-banner");

    if (!banner) {
      banner = document.createElement("div");
      banner.id = "vc-lbc-banner";

      banner.style.cssText = `
        position:fixed;
        top:12px;
        right:12px;
        z-index:999999;
        background:#1a3a8f;
        color:white;
        padding:12px 16px;
        border-radius:8px;
        font-size:13px;
        font-family:sans-serif;
        max-width:340px;
        box-shadow:0 4px 12px rgba(0,0,0,.2);
      `;

      const text = document.createElement("span");
      text.id = "vc-lbc-banner-text";

      const close = document.createElement("button");
      close.textContent = "✕";
      close.style.cssText =
        "margin-left:10px;background:none;border:none;color:white;cursor:pointer;font-weight:bold;";

      close.addEventListener("click", () => banner.remove());

      banner.appendChild(text);
      banner.appendChild(close);

      document.body.appendChild(banner);
    }

    const text = document.getElementById("vc-lbc-banner-text");
    if (text) text.textContent = message;
  }

  function notifyProgress() {
    const parts = [];

    if (lbcState.filledTitle) parts.push("titre");
    if (lbcState.filledDescription) parts.push("description");
    if (lbcState.filledPrice) parts.push("prix");
    if (lbcState.filledImages) parts.push("photos");

    let message = parts.length
      ? "Pré-rempli depuis Vinted : " + parts.join(", ") + "."
      : "Données Vinted en attente du formulaire.";

    if (lbcState.imagesAttemptFailed) {
      message += " Photos à importer manuellement.";
    }

    message += " Vérifie avant de publier.";

    showBanner(message);

    const imagesDone =
      lbcState.filledImages || lbcState.imagesAttemptFailed;

    if (
      lbcState.filledTitle &&
      lbcState.filledDescription &&
      lbcState.filledPrice &&
      imagesDone
    ) {
      deleteValue(KEY_PENDING);
    }
  }

  function tryFillTitle() {
    if (lbcState.filledTitle) return;

    const el = findField([
      'input[name="subject"]',
      'input[name="title"]',
      'input[id*="title"]',
      'input[placeholder*="titre" i]',
      '[data-testid*="title"] input',
      '[data-qa-id*="title"] input',
    ]);

    if (el && setFieldValue(el, lbcState.data.title)) {
      lbcState.filledTitle = true;
      notifyProgress();
    }
  }

  function tryFillDescription() {
    if (lbcState.filledDescription) return;

    const el = findField([
      'textarea[name="body"]',
      'textarea[name="description"]',
      'textarea[id*="description"]',
      'textarea[placeholder*="description" i]',
      '[data-testid*="description"] textarea',
      '[data-qa-id*="description"] textarea',
    ]);

    if (el && setFieldValue(el, lbcState.data.description)) {
      lbcState.filledDescription = true;
      notifyProgress();
    }
  }

  function tryFillPrice() {
    if (lbcState.filledPrice) return;

    const el = findField([
      'input[name="price"]',
      'input[id*="price"]',
      'input[placeholder*="prix" i]',
      '[data-testid*="price"] input',
      '[data-qa-id*="price"] input',
    ]);

    if (el && setFieldValue(el, lbcState.data.price)) {
      lbcState.filledPrice = true;
      notifyProgress();
    }
  }

  function dataUrlToFile(dataUrl, filename) {
    const parts = dataUrl.split(",");
    const mimeMatch = parts[0].match(/:(.*?);/);

    const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
    const binary = atob(parts[1]);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    return new File([bytes], filename || "photo.jpg", {
      type: mime,
    });
  }

  async function tryFillImages() {
    if (
      lbcState.filledImages ||
      lbcState.imagesAttemptFailed ||
      lbcState.imagesInProgress ||
      !lbcState.data.images ||
      lbcState.data.images.length === 0
    ) {
      return;
    }

    const fileInput = document.querySelector(
      'input[type="file"][accept*="image"][multiple], ' +
      'input[type="file"][multiple], ' +
      'input[type="file"][accept*="image"], ' +
      'input[type="file"]'
    );

    if (!fileInput) return;

    lbcState.imagesInProgress = true;

    console.log(
      PREFIX,
      "Champ photo détecté :",
      lbcState.data.images.length,
      "photo(s)"
    );

    try {
      const files = [];

      for (const image of lbcState.data.images) {
        if (!image || !image.dataUrl) continue;

        try {
          files.push(
            dataUrlToFile(image.dataUrl, image.filename)
          );
        } catch (err) {
          console.warn(PREFIX, "Reconstruction photo impossible", err);
        }
      }

      if (!files.length) {
        throw new Error("Aucune photo exploitable.");
      }

      const transfer = new DataTransfer();

      files.forEach((file) => transfer.items.add(file));

      fileInput.files = transfer.files;

      // Déclenche les événements attendus par le formulaire.
      fileInput.dispatchEvent(
        new Event("input", { bubbles: true })
      );

      fileInput.dispatchEvent(
        new Event("change", { bubbles: true })
      );

      lbcState.filledImages = true;

      console.log(
        PREFIX,
        files.length,
        "photo(s) injectée(s) directement dans Leboncoin."
      );

    } catch (err) {
      lbcState.imagesAttemptFailed = true;

      console.error(
        PREFIX,
        "Échec de l'injection des photos :",
        err
      );
    } finally {
      lbcState.imagesInProgress = false;
      notifyProgress();
    }
  }

  async function attemptFill() {
    if (!lbcState.data) return;

    await tryFillImages();

    tryFillTitle();
    tryFillDescription();
    tryFillPrice();
  }

  async function initLeboncoin() {
    const pending = await getValue(KEY_PENDING, null);

    if (!pending) return;

    lbcState.data = pending;

    lbcState.filledPrice = !pending.price;
    lbcState.filledImages =
      !pending.images || pending.images.length === 0;

    showBanner(
      "Données Vinted prêtes — en attente du formulaire..."
    );

    await attemptFill();

    const observer = new MutationObserver(() => {
      clearTimeout(initLeboncoin.debounce);

      initLeboncoin.debounce = setTimeout(() => {
        attemptFill();
      }, 500);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Arrêt de sécurité après 10 minutes.
    setTimeout(() => observer.disconnect(), 10 * 60 * 1000);
  }

  // ---------------------------------------------------------
  // INITIALISATION
  // ---------------------------------------------------------

  function initVinted() {
    showVintedButton();
    applyImportedBadges();

    const observer = new MutationObserver(() => {
      clearTimeout(initVinted.debounce);

      initVinted.debounce = setTimeout(() => {
        showVintedButton();
        applyImportedBadges();
      }, 800);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  if (isVinted) {
    initVinted();
  }

  if (isLeboncoin) {
    initLeboncoin();
  }

  console.log(PREFIX, "Script Tampermonkey chargé.");
})();
