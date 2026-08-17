# Vinted → Leboncoin - L'extension du siècle ⚡

> "Je pensais avoir trouvé l'appli du siècle pour recopier mes annonces mais ça ne marchait pas"
> — Tout le monde qui a testé Flowdino

**Une extension Chrome qui copie tes annonces Vinted vers Leboncoin en 1 clic. Sans copier-coller manuel, sans abonnement, sans passer par Shopify.**

![Version](https://img.shields.io/badge/version-1.7.1-fix--quota-orange)
![License](https://img.shields.io/badge/license-MIT-black)
![Chrome](https://img.shields.io/badge/Chrome-Manifest_V3-4285F4)

### 🆕 v1.7.1 - FIX QUOTA EXCEEDED

**Correction majeure du bug `kQuotaBytesPerItem quota exceeded` :**

- ❌ **Avant :** l'extension stockait les 8 photos en base64 dans `chrome.storage.local` (10 Mo par annonce) -> quota explosé au bout de 3 annonces -> `chrome-extension://invalid/` et popup vide.
- ✅ **Maintenant :** on ne stocke plus que les **URLs des images** (2 Ko par annonce) + limite à 10 annonces max. Les photos sont téléchargées à la volée au moment du clic "Injecter photos" sur Leboncoin via `fetch() -> File -> DataTransfer`.

**Si tu avais le bug :** clique 1 fois sur le bouton rouge `🧹 Vider cache (fix quota)` dans le popup.

---

### Pourquoi cette extension existe ?

**Flowdino** et consorts te forcent à :
- Créer une boutique Shopify / WooCommerce / PrestaShop
- Payer un abonnement pour synchroniser
- Recréer tout ton catalogue sur leur plateforme
- Configurer `sales-config`, `channels`, etc.

**Ici tu fais :**
Vinted → 1 clic → Leboncoin pré-rempli. C'est tout.

---

### ✨ Fonctionnalités

- [x] Bouton **"⚡ Importer sur Leboncoin"** directement sur tes pages Vinted
- [x] Extraction auto : titre, description, prix, marque, taille, état, couleur, URL
- [x] Récupération des 8 photos HD (via URLs, plus de quota)
- [x] Pré-remplissage auto du formulaire Leboncoin (titre / description / prix)
- [x] **V3** : Miniatures draggables avec vrai fichier JPEG pour contourner l'anti-bot Leboncoin
- [x] **V1.7.1** : Fix `kQuotaBytes` + `content.css` + `icon128.png` manquant -> plus d'erreur `chrome-extension://invalid/`
- [x] Fallback : téléchargement auto dans `Téléchargements/vinted-import/`
- [x] Popup avec historique de tes 10 dernières annonces importées (léger)
- [x] 100% local, aucune donnée envoyée

### 🚀 Installation

1. Télécharge la dernière release : [vinted-to-leboncoin-v3.zip](https://github.com/ValentinGratz/vinted2leboncoin-/releases)

2. Dézippe le fichier

3. Va sur `chrome://extensions/` dans Chrome

4. Active **Mode développeur** (en haut à droite)

5. Clique **Charger l'extension non empaquetée** et sélectionne le dossier dézippé

6. C'est prêt !

### 📖 Comment ça marche ?

1. Va sur une annonce Vinted (ex: `https://www.vinted.fr/items/...`)
2. Clique sur le bouton orange sous le titre
3. L'extension ouvre `leboncoin.fr/deposer-une-annonce`
4. Dans le panneau à droite :
   - Clique **"1. Remplir texte + prix"**
   - Clique **"2. Drag & Drop auto des photos"** OU glisse toi-même les miniatures orange sur la zone photo Leboncoin
5. Choisis juste la catégorie et publie !

> **Note sur les photos :** Leboncoin bloque volontairement `input.files = ...` pour empêcher les bots. Aucune extension ne peut uploader 100% auto. La V3 contourne en simulant un vrai drag & drop humain. Si ça bloque, le drag manuel des miniatures fonctionne toujours à 100%. Et depuis la V1.7.1, on fetch les photos à la volée, donc le bouton garde la même fonction "1 clic".

### 🆚 vs Flowdino

| | Flowdino | Cette extension |
|---|---|---|
| Besoin boutique Shopify ? | Oui | Non |
| Prix | ~19€/mois | Gratuit |
| Copie depuis Vinted existant ? | Non, recréation | Oui, 1 clic |
| Photos auto ? | Partiel | Drag & Drop V3 + FIX quota V1.7.1 |
| Données sur serveur tiers ? | Oui | Non, 100% local |

### 🛠 Stack technique

- Manifest V3
- Content Scripts (Vinted + Leboncoin) + `content.css`
- `chrome.storage.local` pour l'historique (URLs seulement, pas de base64)
- `DataTransfer` + `DragEvent` + `fetch() -> File` pour injection photos
- Pas de backend, pas d'API

### 📂 Structure

```
.
├── manifest.json
├── content-vinted.js      # Extraction Vinted (store URLs only)
├── content-leboncoin.js   # Auto-fill + drag & drop + fetch on demand
├── content.css            # Style panneau + bouton
├── background.js          # Clear storage on install
├── popup.html / popup.js  # Historique + bouton fix quota
├── icon.png / icon128.png
└── README.md
```

### 🔮 Roadmap

- [ ] Mode rafale : importer tout ton profil Vinted d'un coup
- [ ] Auto-détection catégorie Leboncoin via IA
- [ ] Sync inverse : Leboncoin → Vinted
- [ ] Export CSV de tes annonces

### 🤝 Contribuer

PR welcome ! L'idée c'est de rester simple et gratuit.

```bash
git clone https://github.com/ValentinGratz/vinted2leboncoin-.git
# Charge le dossier dans chrome://extensions/
```

### ⚠ Disclaimer

Extension non affiliée à Vinted ni Leboncoin. Utilise-la pour tes propres annonces. Respecte les CGU des plateformes. Ne spam pas.

---

Made with ❤ par un vendeur qui en avait marre de recopier.

Si ça t'a fait gagner du temps, mets une ⭐ sur le repo !
