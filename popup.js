// popup.js - v1.7.4

function sendToBackground(type, payload) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, payload }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response || { success: false, error: "Pas de réponse" });
    });
  });
}

const countEl = document.getElementById("count");
const usageEl = document.getElementById("usage");
const statusEl = document.getElementById("status");

function setStatus(msg, isError) {
  statusEl.textContent = msg;
  statusEl.style.color = isError ? "#a00" : "#666";
}

async function refreshStats() {
  try {
    const countRes = await sendToBackground("IDB_COUNT");
    countEl.textContent = countRes.success ? countRes.data : "erreur";

    const usageRes = await sendToBackground("GET_USAGE");
    if (usageRes.success) {
      usageEl.textContent = `${usageRes.data.mb.toFixed(3)} Mo`;
    } else {
      usageEl.textContent = "erreur";
    }
  } catch (err) {
    setStatus(`Erreur chargement stats: ${err.message}`, true);
  }
}

document.getElementById("btn-clear").addEventListener("click", async () => {
  if (!confirm("Vider tout IndexedDB ? Cette action est irréversible.")) return;
  setStatus("Suppression en cours...");
  const res = await sendToBackground("IDB_CLEAR");
  if (res.success) {
    setStatus("IndexedDB vidé.");
    refreshStats();
  } else {
    setStatus(`Erreur: ${res.error}`, true);
  }
});

document.getElementById("btn-migrate").addEventListener("click", async () => {
  setStatus("Migration en cours...");
  const res = await sendToBackground("MIGRATE_NOW");
  if (res.success) {
    const { migratedCount, keysMigrated } = res.data;
    setStatus(`Migration OK: ${migratedCount} items depuis [${keysMigrated.join(", ") || "aucune clé"}]`);
    refreshStats();
  } else {
    setStatus(`Erreur migration: ${res.error}`, true);
  }
});

document.getElementById("btn-export").addEventListener("click", async () => {
  setStatus("Export en cours...");
  const res = await sendToBackground("IDB_GET_ALL");
  if (!res.success) {
    setStatus(`Erreur export: ${res.error}`, true);
    return;
  }

  const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  chrome.downloads
    ? chrome.downloads.download({ url, filename: `vinted2leboncoin_export_${Date.now()}.json` })
    : window.open(url);

  setStatus(`Export lancé: ${res.data.length} items.`);
});

document.addEventListener("DOMContentLoaded", refreshStats);
