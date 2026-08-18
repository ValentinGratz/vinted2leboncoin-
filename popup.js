// popup.js - v1.7.4 (fix)

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

const countEl = document.getElementById("count");
const usageEl = document.getElementById("usage");
const statusEl = document.getElementById("status");

function setStatus(msg, isError, autoReset) {
  statusEl.textContent = msg;
  statusEl.style.color = isError ? "#a00" : "#666";

  if (autoReset) {
    clearTimeout(setStatus._t);
    setStatus._t = setTimeout(() => {
      statusEl.textContent = "Prêt";
      statusEl.style.color = "#666";
    }, 2000);
  }
}

async function refresh() {
  try {
    const countRes = await sendToBackground("IDB_COUNT");
    countEl.textContent = countRes.success ? countRes.data : "0";
  } catch (e) {
    countEl.textContent = "0";
  }

  try {
    const usageRes = await sendToBackground("GET_USAGE");
    usageEl.textContent = usageRes.success ? `${usageRes.data.mb.toFixed(3)} Mo` : "0 Mo";
  } catch (e) {
    usageEl.textContent = "0 Mo";
  }
}

document.getElementById("clearBtn").addEventListener("click", async () => {
  if (!confirm("Vider tout IndexedDB ? Cette action est irréversible.")) return;
  setStatus("Suppression en cours...");
  const res = await sendToBackground("IDB_CLEAR");
  setStatus(res.success ? "IndexedDB vidé." : `Erreur: ${res.error}`, !res.success, true);
  refresh();
});

document.getElementById("migrateBtn").addEventListener("click", async () => {
  setStatus("Migration en cours...");
  const res = await sendToBackground("MIGRATE_NOW");
  if (res.success) {
    const { migratedCount, keysMigrated } = res.data;
    setStatus(`Migration OK: ${migratedCount} items (${(keysMigrated || []).join(", ") || "rien à migrer"})`, false, true);
  } else {
    setStatus(`Erreur migration: ${res.error}`, true, true);
  }
  refresh();
});

document.getElementById("exportBtn").addEventListener("click", async () => {
  setStatus("Export en cours...");
  const res = await sendToBackground("IDB_GET_ALL");
  if (!res.success) {
    setStatus(`Erreur export: ${res.error}`, true, true);
    return;
  }

  const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  if (chrome.downloads) {
    chrome.downloads.download({ url, filename: `vinted2leboncoin_export_${Date.now()}.json` });
  } else {
    window.open(url);
  }

  setStatus(`Export lancé: ${res.data.length} items.`, false, true);
});

document.addEventListener("DOMContentLoaded", refresh);
