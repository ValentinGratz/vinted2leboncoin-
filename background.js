// background.js - v1.7.4 (fix)
// Seul fichier autorisé à toucher IndexedDB.

const DB_NAME = "vinted2leboncoin";
const DB_VERSION = 1;
const STORE_NAME = "items";
const OLD_KEYS_TO_MIGRATE = ["items", "dressing", "products", "vintedData", "produits"];

let dbPromise = null;

// Conversion blob -> data URL sans FileReader (pas toujours dispo en service worker MV3).
async function blobToBase64(blob) {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return `data:${blob.type || "image/jpeg"};base64,${btoa(binary)}`;
}

// ---------------------------------------------------------------------------
// IndexedDB helpers - vanilla, syntaxe transaction correcte partout
// ---------------------------------------------------------------------------

function getDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("ts", "ts", { unique: false });
      }
    };

    request.onsuccess = (event) => {
      const db = event.target.result;
      db.onclose = () => {
        dbPromise = null;
      };
      resolve(db);
    };

    request.onerror = (event) => {
      dbPromise = null;
      reject(event.target.error || new Error("IndexedDB open failed"));
    };
  });

  return dbPromise;
}

function fallbackId(item) {
  if (item && item.id) return item.id;
  if (item && item.url) {
    const match = item.url.match(/\/items\/(\d+)/);
    if (match) return match[1];
  }
  return Date.now().toString() + Math.random().toString(36).slice(2);
}

async function idbPut(rawItem) {
  const item = { ts: Date.now(), ...rawItem };
  item.id = fallbackId(item); // jamais undefined -> plus de rejet keyPath

  const db = await getDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  return item;
}

async function idbGetAll() {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function idbDelete(id) {
  const db = await getDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return true;
}

async function idbClear() {
  const db = await getDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return true;
}

async function idbCount() {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).count();
    req.onsuccess = () => resolve(req.result || 0);
    req.onerror = () => reject(req.error);
  });
}

async function idbDeleteOldestPercent(percent) {
  const all = await idbGetAll();
  if (all.length === 0) return 0;

  const sorted = all.slice().sort((a, b) => (a.ts || 0) - (b.ts || 0));
  const nToDelete = Math.max(1, Math.ceil(sorted.length * percent));
  const toDelete = sorted.slice(0, nToDelete);

  const db = await getDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    toDelete.forEach((item) => store.delete(item.id));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  return toDelete.length;
}

// ---------------------------------------------------------------------------
// storage.local : safe set avec gestion QUOTA_BYTES + éviction LRU
// ---------------------------------------------------------------------------

function isQuotaError(err) {
  if (!err) return false;
  const msg = (err.message || String(err)).toLowerCase();
  return msg.includes("quota_bytes") || msg.includes("quota exceeded") || msg.includes("quota_bytes_per_item");
}

async function getBytesInUse() {
  return new Promise((resolve) => {
    if (chrome.storage.local.getBytesInUse) {
      chrome.storage.local.getBytesInUse(null, (bytes) => resolve(bytes || 0));
    } else {
      resolve(0);
    }
  });
}

async function safeStorageSet(data) {
  try {
    await chrome.storage.local.set(data);
    return { success: true, data };
  } catch (err) {
    if (!isQuotaError(err)) {
      return { success: false, error: err.message || String(err) };
    }

    try {
      const deletedCount = await idbDeleteOldestPercent(0.2);
      const remainingItems = await idbGetAll();
      const remainingIdSet = new Set(remainingItems.map((i) => i.id));

      if (Array.isArray(data.vintedIds)) {
        data.vintedIds = data.vintedIds.filter((id) => remainingIdSet.has(id));
      }

      await chrome.storage.local.set(data);
      return {
        success: true,
        data,
        warning: `Quota dépassé, ${deletedCount} items les plus anciens supprimés d'IndexedDB`,
      };
    } catch (retryErr) {
      return { success: false, error: `Retry après quota échoué: ${retryErr.message || retryErr}` };
    }
  }
}

// ---------------------------------------------------------------------------
// Migration : ne bloque plus jamais le popup.
// Si aucune ancienne clé legacy présente (ou déjà migrée), on répond tout de
// suite avec migratedCount: 0 au lieu de boucler / attendre indéfiniment.
// ---------------------------------------------------------------------------

async function migrateNow() {
  let all;
  try {
    all = await chrome.storage.local.get(null);
  } catch (e) {
    // storage.local illisible -> on débloque quand même le popup
    await chrome.storage.local.set({ migrated: true }).catch(() => {});
    return { migratedCount: 0, keysMigrated: [] };
  }

  const keysFound = OLD_KEYS_TO_MIGRATE.filter((k) => Array.isArray(all[k]) && all[k].length > 0);

  if (keysFound.length === 0) {
    // Rien à migrer -> débloque immédiatement, plus de "Migration en cours..." infini
    await chrome.storage.local.set({ migrated: true });
    return { migratedCount: 0, keysMigrated: [] };
  }

  let migratedCount = 0;
  const keysActuallyMigrated = [];

  for (const key of keysFound) {
    const arr = all[key];
    for (let i = 0; i < arr.length; i++) {
      try {
        await idbPut(arr[i] || {});
        migratedCount++;
      } catch (e) {
        console.error(`[vinted2leboncoin] Échec migration item ${i} de la clé ${key}`, e);
      }
    }
    await chrome.storage.local.remove(key);
    keysActuallyMigrated.push(key);
  }

  const allItemsNow = await idbGetAll();
  await safeStorageSet({
    vintedIds: allItemsNow.map((i) => i.id),
    lastSync: Date.now(),
    migrated: true,
  });

  return { migratedCount, keysMigrated: keysActuallyMigrated };
}

async function migrateIfNeeded() {
  const { migrated } = await chrome.storage.local.get(["migrated"]);
  if (migrated) return { migratedCount: 0, keysMigrated: [] };
  return migrateNow();
}

chrome.runtime.onInstalled.addListener(() => {
  migrateIfNeeded().catch((e) => console.error("[vinted2leboncoin] Migration onInstalled échouée", e));
});

chrome.runtime.onStartup.addListener(() => {
  migrateIfNeeded().catch((e) => console.error("[vinted2leboncoin] Migration onStartup échouée", e));
});

// ---------------------------------------------------------------------------
// Message router - return true OBLIGATOIRE pour garder le service worker
// vivant le temps de la réponse async (fix du popup bloqué sur "-").
// ---------------------------------------------------------------------------

async function handleMessage(message) {
  const { type, payload } = message || {};

  switch (type) {
    case "IDB_PUT": {
      const data = await idbPut(payload);
      return { success: true, data };
    }
    case "IDB_GET_ALL": {
      const data = await idbGetAll();
      return { success: true, data };
    }
    case "IDB_DELETE": {
      const data = await idbDelete(payload && payload.id);
      return { success: true, data };
    }
    case "IDB_CLEAR": {
      const data = await idbClear();
      await chrome.storage.local.set({ vintedIds: [], lastSync: Date.now() });
      return { success: true, data };
    }
    case "IDB_COUNT": {
      const data = await idbCount();
      return { success: true, data };
    }
    case "GET_USAGE": {
      const bytes = await getBytesInUse();
      const count = await idbCount();
      return { success: true, data: { bytes, mb: bytes / (1024 * 1024), count } };
    }
    case "SAFE_SET": {
      return safeStorageSet(payload || {});
    }
    case "MIGRATE_NOW": {
      const data = await migrateNow();
      return { success: true, data };
    }
    case "LBC_PREPARE": {
      if (!payload || !payload.title) {
        return { success: false, error: "Payload LBC_PREPARE invalide (titre manquant)" };
      }

      const imagesWithData = [];
      for (const url of (payload.images || []).slice(0, 10)) {
        try {
          const res = await fetch(url);
          if (!res.ok) {
            console.warn(`[vinted2leboncoin] LBC_PREPARE: HTTP ${res.status} pour ${url}`);
            continue;
          }
          const blob = await res.blob();
          const dataUrl = await blobToBase64(blob);
          const filename = url.split("/").pop().split("?")[0] || `photo-${Date.now()}.jpg`;
          imagesWithData.push({ url, dataUrl, filename });
        } catch (err) {
          // Si ce fetch échoue même en background, le domaine de l'image n'est
          // probablement pas couvert par host_permissions (voir manifest.json).
          console.warn(`[vinted2leboncoin] LBC_PREPARE: échec fetch background pour ${url}`, err.message);
        }
      }

      const enrichedPayload = { ...payload, images: imagesWithData };
      await chrome.storage.local.set({ pendingTransfer: enrichedPayload });
      return { success: true, data: enrichedPayload };
    }
    case "LBC_MARK_IMPORTED": {
      if (!payload || !payload.id) {
        return { success: false, error: "LBC_MARK_IMPORTED: id manquant" };
      }
      const { importedLbcIds } = await chrome.storage.local.get(["importedLbcIds"]);
      const ids = Array.isArray(importedLbcIds) ? importedLbcIds : [];
      if (!ids.includes(payload.id)) {
        ids.push(payload.id);
        await safeStorageSet({ importedLbcIds: ids });
      }
      return { success: true, data: true };
    }
    case "LBC_UNMARK_IMPORTED": {
      if (!payload || !payload.id) {
        return { success: false, error: "LBC_UNMARK_IMPORTED: id manquant" };
      }
      const { importedLbcIds } = await chrome.storage.local.get(["importedLbcIds"]);
      const ids = (Array.isArray(importedLbcIds) ? importedLbcIds : []).filter((id) => id !== payload.id);
      await chrome.storage.local.set({ importedLbcIds: ids });
      return { success: true, data: true };
    }
    case "LBC_CHECK_IMPORTED": {
      if (!payload || !payload.id) {
        return { success: false, error: "LBC_CHECK_IMPORTED: id manquant" };
      }
      const { importedLbcIds } = await chrome.storage.local.get(["importedLbcIds"]);
      const ids = Array.isArray(importedLbcIds) ? importedLbcIds : [];
      return { success: true, data: ids.includes(payload.id) };
    }
    case "LBC_GET_ALL_IMPORTED": {
      const { importedLbcIds } = await chrome.storage.local.get(["importedLbcIds"]);
      return { success: true, data: Array.isArray(importedLbcIds) ? importedLbcIds : [] };
    }
    case "LBC_GET_PENDING": {
      const { pendingTransfer } = await chrome.storage.local.get(["pendingTransfer"]);
      return { success: true, data: pendingTransfer || null };
    }
    case "LBC_CLEAR_PENDING": {
      await chrome.storage.local.remove("pendingTransfer");
      return { success: true, data: true };
    }
    default:
      return { success: false, error: `Type de message inconnu: ${type}` };
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message)
    .then((result) => sendResponse(result))
    .catch((err) => sendResponse({ success: false, error: err.message || String(err) }));
  return true; // CRITIQUE : garde le canal ouvert pour la réponse async
});