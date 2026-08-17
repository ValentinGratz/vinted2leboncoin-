# FAQ - Vinted2Leboncoin - L'outil du siècle

> Tout ce qui peut planter avec Chrome, Edge, CCleaner et les cookies.

---

### 1. J'essaie d'installer le .crx et Chrome me dit "Cette extension ne provient pas d'une source connue"

**C'est normal depuis 2024. Google bloque l'installation par glisser-déposer de .crx hors Web Store.**

**Solution permanente (à faire une fois) :**
1.  Dézippe le fichier `vinted2leboncoin.zip` dans un dossier qui ne bougera JAMAIS. Exemple : `C:\MesExtensions\vinted2leboncoin\`
2.  Va sur `chrome://extensions` (ou `edge://extensions` sur Edge)
3.  Active **Mode développeur** en haut à droite et laisse-le activé
4.  Clique sur **Charger l'extension non empaquetée**
5.  Sélectionne ton dossier `C:\MesExtensions\vinted2leboncoin\`

L'extension restera activée. Si tu supprimes/déplaces ce dossier, elle sautera.

### 2. Mon extension s'est grisée toute seule avec un triangle jaune "peut avoir été ajoutée à votre insu"

Ce n'est PAS un virus. Chrome désactive toutes les extensions non issues du Store à chaque redémarrage.

Refais juste : `chrome://extensions` > bouton gris > repasse-le en bleu.

Si elle se re-grise tout le temps, c'est que tu l'avais installée en `.crx`. Passe en méthode dossier (voir question 1).

### 3. Si je fais un CCleaner, je vais perdre Vinted2Leboncoin, Vinted2Beebs, Tampermonkey ?

**Non.** CCleaner ne désinstalle jamais d'extensions Chrome/Edge.

Par contre, attention à 2 cases dans CCleaner :

**Dans Nettoyage personnalisé > Google Chrome :**
- Laisse **DÉCOCHÉ** : `Local Storage / Stockage local / Données de session`. C'est là que Tampermonkey stocke tes scripts.
- Tu peux cocher le reste sans risque.

**Dans Bilan de santé :**
- Il ne supprime pas tes extensions, mais il va supprimer tes cookies et te déconnecter de Vinted, Leboncoin, Beebs, etc.
- Tes scripts Tampermonkey ne bougent pas.

**Conseil :** Avant un gros nettoyage, dans Tampermonkey > Tableau de bord > Utilitaires > **Exporter en Zip** pour sauvegarder tes scripts.

### 4. J'ai fait "Bilan de santé" et Edge/Chrome a affiché "Continuer sans fermer"

CCleaner n'a pas pu tout nettoyer car ton navigateur était encore ouvert.

Si tu veux un nettoyage à 100%, ferme complètement Chrome/Edge avant de cliquer sur Nettoyer. Vérifie aussi dans la barre des tâches en bas à droite qu'il ne reste pas en arrière-plan.

Si tu cliques sur "Continuer sans fermer", il nettoiera 60% seulement, aucun risque pour tes extensions.

### 5. Comment garder Vinted / Leboncoin / Beebs connectés après CCleaner ?

1. Dans CCleaner, va dans `Options > Cookies` ou `Paramètres de cookies`
2. Tu as 2 colonnes : `Cookies à conserver` (à gauche) et `Cookies à supprimer` (à droite)
3. Fais passer `vinted.fr`, `leboncoin.fr`, `beebs.app` dans la colonne **à conserver**

Tout le reste sera supprimé, mais tu resteras connecté sur ces 3 sites.

### 6. L'extension n'importe rien / le bouton n'apparaît pas sur Vinted

Check-list :
1.  Es-tu bien connecté sur Vinted.fr ?
2.  Va sur `chrome://extensions` > Vinted2Leboncoin > Détails > Active **"Autoriser l'accès aux URL de fichiers"** et **"Autoriser en navigation privée"** si tu utilises
3.  Recharge la page Vinted avec Ctrl + F5
4.  Vérifie que Tampermonkey n'a pas un autre script Vinted qui fait conflit

### 7. Quelle est la différence entre .zip et .crx ?

- `.crx` : Ancien format d'installation. Chrome le bloque maintenant. À éviter.
- `.zip` + **Charger l'extension non empaquetée** : La seule méthode qui tient dans le temps. C'est celle à utiliser.

### 8. Je suis sur Edge, c'est pareil ?

Oui, Edge est basé sur Chrome. Même procédure, mais va sur `edge://extensions` et active **"Mode développeur"** + **"Autoriser les extensions provenant d'autres magasins"** en bas.

### 9. Je dois laisser le Mode développeur activé tout le temps ?

Oui. C'est voulu par Google. Si tu le désactives, Chrome désactive toutes les extensions chargées à la main. Laisse-le en bleu.

### 10. Je peux mettre le dossier de l'extension sur le Bureau ?

Non. Mets-le dans `C:\MesExtensions\` ou `Documents\Extensions\`. Si tu le mets dans Téléchargements ou sur le Bureau, tu risques de le supprimer lors d'un futur nettoyage CCleaner / corbeille.

---
*Dernière mise à jour : 16/08/2026 - Si une question manque, envoie un screen de ton erreur.*
