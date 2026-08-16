# Vinted → Leboncoin - L'extension du siècle ⚡️

> "Je pensais avoir trouvé l'appli du siècle pour recopier mes annonces mais ça ne marchait pas"
> — Tout le monde qui a testé Flowdino

**Une extension Chrome qui copie tes annonces Vinted vers Leboncoin en 1 clic. Sans copier-coller manuel, sans abonnement, sans passer par Shopify.**

![Version](https://img.shields.io/badge/version-1.0.3-orange)
![License](https://img.shields.io/badge/license-MIT-black)
![Chrome](https://img.shields.io/badge/Chrome-Manifest_V3-4285F4)

### Pourquoi cette extension existe ?

**Flowdino** et consorts te forcent à :

* Créer une boutique Shopify / WooCommerce / PrestaShop
* Payer un abonnement pour synchroniser
* Recréer tout ton catalogue sur leur plateforme
* Configurer `sales-config`, `channels`, etc.

**Ici tu fais :**
Vinted → 1 clic → Leboncoin pré-rempli. C'est tout.

---

### ✨ Fonctionnalités

* [x] Bouton **"⚡️ Importer sur Leboncoin"** directement sur tes pages Vinted
* [x] Extraction auto : titre, description, prix, marque, taille, état, couleur, URL
* [x] Récupération des 8 photos HD
* [x] Pré-remplissage auto du formulaire Leboncoin (titre / description / prix)
* [x] **V3** : Miniatures draggables avec vrai fichier JPEG pour contourner l'anti-bot Leboncoin
* [x] Fallback : téléchargement auto dans `Téléchargements/vinted-import/`
* [x] Popup avec historique de tes 50 dernières annonces importées
* [x] 100% local, aucune donnée envoyée

### 🚀 Installation

1. Télécharge la dernière release : https://github.com/ValentinGratz/vinted2leboncoin-/blob/main/dist/vinted-to-leboncoin.zip

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

   * Clique **"1. Remplir texte + prix"**
   * Clique **"2. Drag & Drop auto des photos"** OU glisse toi-même les miniatures orange sur la zone photo Leboncoin
5. Choisis juste la catégorie et publie !

> **Note sur les photos :** Leboncoin bloque volontairement `input.files = ...` pour empêcher les bots. Aucune extension ne peut uploader 100% auto. La V3 contourne en simulant un vrai drag & drop humain. Si ça bloque, le drag manuel des miniatures fonctionne toujours à 100%.

Tuto Youtube : https://youtu.be/2PWVkEis00A

### 🆚 vs Flowdino

|                                | Flowdino        | Cette extension |
| ------------------------------ | --------------- | --------------- |
| Besoin boutique Shopify ?      | Oui             | Non             |
| Prix                           | ~19€/mois       | Gratuit         |
| Copie depuis Vinted existant ? | Non, recréation | Oui, 1 clic     |
| Photos auto ?                  | Partiel         | Drag & Drop V3  |
| Données sur serveur tiers ?    | Oui             | Non, 100% local |

### 🛠️ Stack technique

* Manifest V3
* Content Scripts (Vinted + Leboncoin)
* `chrome.storage.local` pour l'historique
* `DataTransfer` + `DragEvent` pour injection photos
* Pas de backend, pas d'API

### 📂 Structure

```text
.
├── manifest.json
├── content-vinted.js      # Extraction Vinted
├── content-leboncoin.js   # Auto-fill + drag & drop
├── background.js          # Download des images
├── popup.html / popup.js  # Historique
└── icon.png
```

### 🔮 Roadmap

* [ ] Mode rafale : importer tout ton profil Vinted d'un coup
* [ ] Auto-détection catégorie Leboncoin via IA
* [ ] Sync inverse : Leboncoin → Vinted
* [ ] Export CSV de tes annonces

### 🤝 Contribuer

PR welcome ! L'idée c'est de rester simple et gratuit.

```bash
git clone https://github.com/ValentinGratz/vinted2leboncoin-.git
# Charge le dossier dans chrome://extensions/
```

### ⚠️ Disclaimer

Extension non affiliée à Vinted ni Leboncoin. Utilise-la pour tes propres annonces. Respecte les CGU des plateformes. Ne spam pas.

---

Made with ❤️ par un vendeur qui en avait marre de recopier.

Et à l'aide aussi de Meta IA.

Si ça t'a fait gagner du temps, mets une ⭐️ sur le repo !
