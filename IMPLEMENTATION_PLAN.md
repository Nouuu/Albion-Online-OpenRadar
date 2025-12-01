# Plan d'Implémentation : Fix Equipment & Spell Display + Finalisation Player Detection

**Date de début :** 2025-11-27
**Date de fin PR #4 :** 2025-12-01
**Statut global :** ✅ PR #4 TERMINÉE

---

## 🎯 Objectif

Corriger l'affichage des spells qui utilisent incorrectement la base de données des items, et s'assurer que tous les équipements sont correctement affichés.

**Problème actuel :**
- ❌ Les spells utilisent `itemsDatabase.getItemById()` au lieu d'une base dédiée
- ❌ Affiche des bottes/armures au lieu des vrais spells
- ❌ Pas d'icônes de spells téléchargées

---

## 📋 Tâches

### ✅ 1. Document de Plan Créé
**Status:** ✅ TERMINÉ
**Fichier:** `IMPLEMENTATION_PLAN.md`

---

### ✅ 2. Créer SpellsDatabase.js
**Status:** ✅ TERMINÉ
**Fichier:** `scripts/Data/SpellsDatabase.js`

**Détails :**
- Parser `spells.json` (passivespell[], activespell[], togglespell[])
- Créer index séquentiel (skip colortags)
- Stocker: uniquename, uisprite, namelocatag, type
- Méthode principale: `getSpellByIndex(index)`

**Structure attendue :**
```javascript
export class SpellsDatabase {
    constructor() {
        this.spells = new Map(); // index -> spell object
    }

    async load(jsonPath) {
        // Fetch et parse spells.json
        // Build sequential index
    }

    getSpellByIndex(index) {
        return this.spells.get(index);
    }
}
```

---

### ✅ 3. Copier spells.json vers Public
**Status:** ✅ TERMINÉ
**Source:** `work/data/ao-bin-dumps/spells.json`
**Destination:** `public/ao-bin-dumps/spells.json`

---

### ✅ 4. Mettre à Jour Utils.js
**Status:** ✅ TERMINÉ
**Fichier:** `scripts/Utils/Utils.js` (ligne 240-270)

**Changements effectués :**
- ✅ Ligne 246: Utilise maintenant `window.spellsDatabase.getSpellByIndex()`
- ✅ Icon path: `/images/Spells/${uisprite}.png`
- ✅ Tooltip: Affiche `spell.uniqueName`
- ✅ Fallback icon: `onerror="this.src='/images/Spells/SPELL_GENERIC.png'"`

---

### ✅ 5. Initialiser SpellsDatabase
**Status:** ✅ TERMINÉ
**Fichier:** `scripts/Utils/Utils.js` (lignes 55-61)

**Code ajouté :**
```javascript
const spellsDatabase = new SpellsDatabase();
(async () => {
    await spellsDatabase.load('/ao-bin-dumps/spells.json');
    window.spellsDatabase = spellsDatabase;
    console.log('✨ [Utils.js] Spells database loaded and ready');
})();
```

---

### ✅ 8. Créer Script Download Spell Icons
**Status:** ✅ TERMINÉ
**Fichier:** `scripts-shell/download-all-spell-icons.js`

**Fonctionnalités :**
- ✅ Parse `spells.json`
- ✅ Extrait tous les attributs `@uisprite` uniques
- ✅ Télécharge depuis CDN Albion avec 3 URL patterns de fallback
- ✅ Gestion d'erreurs et stats de progression
- ✅ Output vers `images/Spells/`

---

 ### ✅ 9. Téléchargement Icônes de Spells
**Status:** ✅ TERMINÉ

**Résultat :**
- ✅ Script mis à jour pour utiliser `localization.json`
- ✅ 774 spells uniques avec noms localisés trouvés
- ✅ 761 icônes téléchargées (98.3% de succès)
- ✅ 12 existaient déjà
- ✅ 1 seul échec
- ✅ Utilise `work/data/ao-bin-dumps/localization.json` (pas intégré au projet)
- ✅ Noms de fichiers sanitizés (espaces → underscores)

**Commande :**
```bash
node scripts-shell/download-all-spell-icons.js
```

---

### ✅ 10. Amélioration Script Download
**Status:** ✅ TERMINÉ

**Changements effectués :**
- ✅ Ajout retry avec timeout (1s optimisé)
- ✅ Multiple URL patterns (spell + item endpoints)
- ✅ Exponential backoff (max 2 retries)
- ✅ Liste détaillée des spells manquants
- ✅ Fallback vers SPELL_GENERIC.png

**Résultat final :**
- 425 icônes de spells téléchargées avec succès
- 140 spells utilisent le fallback SPELL_GENERIC.png (système/passifs/vanity)

---

### ✅ 11. Tests & Vérification
**Status:** ✅ TERMINÉ

**Résultats des tests :**
- ✅ Spell ID 3531 retourne un spell avec nom correct
- ✅ Noms de spells affichés correctement
- ✅ Icônes spells chargent ou affichent fallback générique
- ✅ Equipment continue de fonctionner
- ⚠️ Certaines erreurs 404 persistent (vanity items + spells système)
- ✅ Dark mode fonctionne toujours

---

## 🔄 FINALISATION PLAYER DETECTION - PROCHAINES ÉTAPES

### ✅ 12. Configurable Max Players Affichés (Frontend)
**Status:** ✅ TERMINÉ

**Description :**
Ajouter un contrôle UI sur le frontend permettant de configurer le nombre maximum de joueurs affichés sur le radar.

**Ce qui a été implémenté :**

1. **UI dans `views/main/home.ejs`** ✅
   - Nouvelle section "⚙️ Display Settings" après "Types"
   - Input numérique `settingMaxPlayersDisplay` (min: 1, max: 100, placeholder: 50)
   - Tooltip informatif
   - Sauvegarde/chargement automatique via `localStorage`

2. **Logique dans `scripts/Handlers/PlayersHandler.js`** ✅
   - Limitation appliquée **au moment de l'ajout** d'un nouveau joueur dans `handleNewPlayerEvent()`
   - Garde automatiquement les X joueurs les plus récents (tri par `detectedAt`)
   - Supprime les plus anciens quand limite dépassée
   - Log debug des joueurs supprimés

3. **Affichage dans `scripts/Utils/Utils.js`** ✅
   - `playersDrawing.invalidate()` utilise `playersList` (déjà limitée par PlayersHandler)
   - `updatePlayerCounter()` affiche la liste HTML (déjà limitée)
   - Décommenté l'affichage des joueurs sur le radar

4. **Dessin dans `scripts/Drawings/PlayersDrawing.js`** ✅
   - Simplifié : plus de filtrage, utilise directement la liste reçue
   - Commentaire explicatif ajouté

**Architecture finale :**
- Centralisation de la logique dans `PlayersHandler` (pattern métier propre)
- `localStorage` utilisé pour la persistance du setting
- Limite max forcée à 100 (sécurité)
- Default à 50 joueurs si non configuré

---

### ✅ 13. Toggle Logs Serveur (Backend)
**Status:** ✅ TERMINÉ

**Description :**
Ajouter un toggle frontend pour activer/désactiver les logs côté **backend** (serveur). L'application utilise déjà un logger maison (front + back), et l'envoi front → back est déjà implémenté via `settingLogToServer`.

**Ce qui a été implémenté :**

1. **LoggerServer.js** ✅
   - Propriété `this.enabled` (default: true)
   - Méthode `setEnabled(boolean)` pour activer/désactiver
   - Méthode `isEnabled()` pour vérifier l'état
   - Vérification `this.enabled` dans `writeLogs()` avant écriture

2. **app.js - Endpoints API** ✅
   - `GET /api/settings/server-logs` : Retourne l'état actuel
   - `POST /api/settings/server-logs` : Change l'état (body: `{ enabled: boolean }`)
   - Validation et retour JSON

3. **views/main/settings.ejs** ✅
   - Checkbox `settingServerLogsEnabled` dans section "Debug & Logging"
   - Sauvegarde dans `localStorage` (source de vérité)
   - Event listener envoie au backend via API POST
   - Chargement depuis `localStorage` au démarrage (default: true)

4. **views/layout.ejs** ✅
   - Script d'initialisation au démarrage de l'app
   - Lit `localStorage.getItem('settingServerLogsEnabled')`
   - Envoie l'état au backend via API POST
   - Console log confirme l'initialisation

**Architecture finale :**
- Source de vérité : Frontend (`localStorage`)
- Au démarrage : Layout envoie l'état au backend
- Changement : Settings envoie l'état au backend
- Backend : Applique l'état reçu sans persister


---

### ⏳ 14. Mémoriser Dernière Map en Session
**Status:** ⏳ PLANIFIÉ

**Description :**
Garder en mémoire la dernière map affichée durant une session. Si F5 ou retour depuis autre page et tuile vide → recharger depuis mémoire.

**Implémentation :**
- ✅ Stockage en `sessionStorage` (efface à fermeture navigateur)
- ✅ Clé: `lastMapDisplayed` structure: `{ mapId, tileX, tileY, timestamp }`
- ✅ Vérification lors du chargement initial
- ✅ Minimap arrière-plan conservé (vérifier comportement actuel)

**Fichiers à modifier :**
1. `scripts/Utils/Utils.js` - Sauvegarder lors du changement de map
2. `scripts/Drawings/MapDrawing.js` - Charger depuis `sessionStorage` si tuile vide
3. `views/main/index.ejs` (si besoin) - Initialisation

---

## 📊 Progression

```
[▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓] 100% (11/11 tâches PR #4 TERMINÉES)
[▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░] 67% (2/3 tâches finalisation player detection)
```

**Tâches PR #4 terminées :** 11/11 ✅
**Tâches finalisation terminées :** 2/3 ✅
  - ✅ Tâche 12 : Configurable Max Players
  - ✅ Tâche 13 : Toggle Logs Serveur (Backend)
  - ⏳ Tâche 14 : Mémoriser Dernière Map

**Phase actuelle :** Finalisation player detection en cours (dernière tâche restante)

---

## 📝 Notes Techniques

### Structure spells.json
```json
{
  "spells": {
    "passivespell": [
      {
        "@uniquename": "PASSIVE_MAXLOAD",
        "@uisprite": "...",
        "@namelocatag": "..."
      }
    ],
    "activespell": [...],
    "togglespell": [...]
  }
}
```

### Indexation Séquentielle
- Ignorer les `colortag[]`
- Index 0, 1, 2... pour passivespell + activespell + togglespell dans l'ordre

---

## 🎯 Résultat Attendu

- ✅ Affichage précis des spells avec vrais noms
- ✅ Icônes spells (ou fallback générique)
- ✅ Equipment fonctionne correctement
- ✅ Aucune donnée trompeuse

---

---

## ✅ Modifications Effectuées - Résumé

### Nouveaux Fichiers Créés :
1. **`scripts/Data/SpellsDatabase.js`** - Base de données des spells (JSON)
2. **`scripts-shell/download-all-spell-icons.js`** - Script de téléchargement des icônes
3. **`public/ao-bin-dumps/spells.json`** - Copie de spells.json pour accès browser
4. **`public/ao-bin-dumps/items.json`** - Copie de items.json pour accès browser
5. **`images/Spells/`** - Répertoire pour icônes de spells
6. **`IMPLEMENTATION_PLAN.md`** - Ce document

### Fichiers Modifiés :
1. **`scripts/Data/ItemsDatabase.js`**
   - Supprimé support XML
   - Parse uniquement JSON maintenant
   - Gère tous types d'items

2. **`scripts/Utils/Utils.js`**
   - Import SpellsDatabase (ligne 12)
   - Initialisation SpellsDatabase (lignes 55-61)
   - Chargement items.json au lieu de items.xml (ligne 50)
   - Affichage spells mis à jour (lignes 246-270)
   - Utilise `window.spellsDatabase.getSpellByIndex()` au lieu de itemsDatabase

---

**Dernière mise à jour :** 2025-12-01 - Tâches 12-13 TERMINÉES ✅ (2/3 finalisation)
**Tâche restante :** Tâche 14 (Mémoriser dernière map en session)
