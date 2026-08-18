// background.js - v1.7.4
// Seul fichier autorisé à toucher IndexedDB.
// storage.local reste minimal : { vintedIds: string[], lastSync: number, migrated: boolean }

const DB_NAME = "vinted2leboncoin";
const DB_VERSION = 1;
const STORE_NAME = "items";
const OLD_KEYS_TO_MIGRATE = ["items", "dressing", "products", "vintedData", "produits"];
const MIGRATION_ARRAY_SIZE_THRESHOLD = 100 * 1024; // 100 ko

let dbPromise = null;

// ---------------------------------------------------------------------------
// IndexedDB helpers
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

async function idbPut(item) {
  if (!item || !item.id) {
    throw new Error("idbPut: item invalide (id manquant)");
  }
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const itemToStore = { ts: Date.now(), ...item };
    const req = store.put(itemToStore);
    req.onsuccess = () => resolve(itemToStore);
    req.onerror = () => reject(req.error);
  });
}

async function idbGetAll() {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function idbDelete(id) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

async function idbClear() {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.clear();
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

async function idbCount() {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.count();
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
      chrome.storage.local.getBytesInUse(null, (bytes) => {
        console.log(`[vinted2leboncoin] storage.local bytes in use: ${bytes}`);
        resolve(bytes || 0);
      });
    } else {
      resolve(0);
    }
  });
}

async function safeStorageSet(data) {
  try {
    await chrome.storage.local.set(data);
    await getBytesInUse();
    return { success: true, data };
  } catch (err) {
    if (!isQuotaError(err)) {
      return { success: false, error: err.message || String(err) };
    }

    console.warn("[vinted2leboncoin] QUOTA_BYTES atteint, éviction LRU 20% + retry");

    try {
      const deletedCount = await idbDeleteOldestPercent(0.2);

      const existing = await chrome.storage.local.get(["vintedIds"]);
      const currentIds = Array.isArray(existing.vintedIds) ? existing.vintedIds : [];

      if (Array.isArray(data.vintedIds) && data.vintedIds.length > 0) {
        const remainingItems = await idbGetAll();
        const remainingIdSet = new Set(remainingItems.map((i) => i.id));
        data.vintedIds = data.vintedIds.filter((id) => remainingIdSet.has(id));
      } else if (currentIds.length > 0) {
        const remainingItems = await idbGetAll();
        const remainingIdSet = new Set(remainingItems.map((i) => i.id));
        data.vintedIds = currentIds.filter((id) => remainingIdSet.has(id));
      }

      await chrome.storage.local.set(data);
      await getBytesInUse();

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
// Migration automatique storage.local -> IndexedDB
// ---------------------------------------------------------------------------

function roughByteSize(value) {
  try {
    return new Blob([JSON.stringify(value)]).size;
  } catch (e) {
    return JSON.stringify(value || "").length;
  }
}

function normalizeToItem(rawEntry, fallbackIndex) {
  if (!rawEntry || typeof rawEntry !== "object") {
    return {
      id: `migrated_${fallbackIndex}_${Date.now()}`,
      url: "",
      title: String(rawEntry || ""),
      price: "",
      ts: Date.now(),
    };
  }

  const id =
    rawEntry.id ||
    rawEntry.itemId ||
    rawEntry.vintedId ||
    (rawEntry.url && rawEntry.url.match(/\/items\/(\d+)/) ? rawEntry.url.match(/\/items\/(\d+)/)[1] : null) ||
    `migrated_${fallbackIndex}_${Date.now()}`;

  return {
    id: String(id),
    url: rawEntry.url || rawEntry.link || "",
    title: rawEntry.title || rawEntry.name || "",
    price: rawEntry.price || rawEntry.prix || "",
    ts: rawEntry.ts || rawEntry.timestamp || Date.now(),
  };
}

async function migrateNow() {
  const all = await chrome.storage.local.get(null);
  const keysFound = OLD_KEYS_TO_MIGRATE.filter((k) => Array.isArray(all[k]));

  let migratedCount = 0;
  const keysActuallyMigrated = [];

  for (const key of keysFound) {
    const arr = all[key];
    const size = roughByteSize(arr);

    if (size <= MIGRATION_ARRAY_SIZE_THRESHOLD && arr.length === 0) {
      continue;
    }

    for (let i = 0; i < arr.length; i++) {
      const item = normalizeToItem(arr[i], i);
      try {
        await idbPut(item);
        migratedCount++;
      } catch (e) {
        console.error(`[vinted2leboncoin] Échec migration item ${i} de la clé ${key}`, e);
      }
    }

    await chrome.storage.local.remove(key);
    keysActuallyMigrated.push(key);
  }

  const allItemsNow = await idbGetAll();
  const vintedIds = allItemsNow.map((i) => i.id);

  await safeStorageSet({
    vintedIds,
    lastSync: Date.now(),
    migrated: true,
  });

  console.log(
    `[vinted2leboncoin] Migration terminée: ${migratedCount} items migrés depuis [${keysActuallyMigrated.join(", ")}]`
  );

  return { migratedCount, keysMigrated: keysActuallyMigrated };
}

async function migrateIfNeeded() {
  const { migrated } = await chrome.storage.local.get(["migrated"]);
  if (migrated) return { migratedCount: 0, keysMigrated: [], alreadyDone: true };
  return migrateNow();
}

chrome.runtime.onInstalled.addListener(() => {
  migrateIfNeeded().catch((e) => console.error("[vinted2leboncoin] Migration onInstalled échouée", e));
});

chrome.runtime.onStartup.addListener(() => {
  migrateIfNeeded().catch((e) => console.error("[vinted2leboncoin] Migration onStartup échouée", e));
});

// ---------------------------------------------------------------------------
// Message router
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
      const result = await safeStorageSet(payload || {});
      return result;
    }
    case "MIGRATE_NOW": {
      const data = await migrateNow();
      return { success: true, data };
    }
    default:
      return { success: false, error: `Type de message inconnu: ${type}` };
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message)
    .then((result) => sendResponse(result))
    .catch((err) => sendResponse({ success: false, error: err.message || String(err) }));
  return true; // réponse asynchrone
});
