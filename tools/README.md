# 🛠️ Tools - Scripts d'analyse TypeID

Ce dossier contient les outils d'analyse et de vérification des TypeID living resources.

---

## 📋 Scripts disponibles

### 1. `analyze_logs_typeids.js`
**Analyse automatique des logs terrain**

Détecte les erreurs de TypeID en comparant :
- Notre base de données MobsInfo.js
- Les typeNumber envoyés par le serveur Albion
- Les overrides intentionnels (bugs serveur)

**Usage** :
```bash
node tools/analyze_logs_typeids.js
```

**Sortie** :
- ✅ Erreurs détectées (mismatches)
- ⚠️ Overrides intentionnels (bugs serveur Albion)
- 🚨 TypeID suspects à vérifier en jeu
- 📁 Génère `TYPEIDS_SUSPECTS.json` si suspects trouvés

---

### 2. `find_suspect_typeids.js`
**Liste les TypeID suspects par range**

Identifie les TypeID potentiellement mal classés basés sur les patterns :
- Ranges avec types mélangés (ex: Fiber + Rock dans même range)
- TypeID dans le même range que les bugs confirmés (528, 530, 531)

**Usage** :
```bash
node tools/find_suspect_typeids.js
```

**Sortie** :
- Liste des TypeID suspects par range
- Template de rapport pour vérification en jeu
- Recommandations d'actions

---

## 📊 Fichiers générés

### `TYPEIDS_SUSPECTS.json`
Liste JSON des TypeID nécessitant vérification en jeu.

**Format** :
```json
[
  {
    "typeId": 528,
    "ours": "Fiber",
    "tier": 3,
    "game": "Hide",
    "typeNumber": 16,
    "reason": "Override intentionnel (bug serveur Albion)"
  }
]
```

### `TYPEIDS_STATUS.md`
Documentation complète du statut des TypeID :
- Corrections appliquées
- Bugs serveur Albion confirmés
- Protocole de vérification en jeu
- Liste des suspects à vérifier

---

## 🎯 Workflow recommandé

### 1. Après une session de jeu
```bash
# Analyser les nouveaux logs
node tools/analyze_logs_typeids.js
```

Si des erreurs sont détectées → Corriger MobsInfo.js

### 2. Pour vérifier un range complet
```bash
# Lister tous les suspects
node tools/find_suspect_typeids.js
```

Suivre le protocole dans `TYPEIDS_STATUS.md` pour vérifier en jeu.

### 3. Avant un commit
```bash
# S'assurer qu'il n'y a pas d'erreurs
node tools/analyze_logs_typeids.js
```

Si tout est ✅ → Commit safe

---

## 📝 Protocole de vérification terrain

1. **Effacer cache TypeID** (bouton radar)
2. **Recharger page** (CTRL+F5)
3. **Aller en zone** avec le TypeID suspect
4. **Activer logs** living resources
5. **Pour chaque TypeID** :
   - Trouver ressource vivante
   - Noter VISUELLEMENT le type (Fiber/Hide/Rock/etc)
   - Tuer la ressource
   - Vérifier logs : `typeId` vs `typeNumber`
   - Si mismatch → Me transmettre correction

---

## 🚨 Bugs serveur Albion confirmés

Ces TypeID sont **Fiber** mais le serveur envoie `typeNumber=16` (Hide) :
- **TypeID 528** = Fiber T3 ✅ CORRIGÉ
- **TypeID 530** = Fiber T4 ✅ CORRIGÉ
- **TypeID 531** = Fiber T5 ✅ CORRIGÉ

Notre système les override correctement via mobinfo priority.

---

## 📁 Localisation

```
tools/
├── README.md                    ← Ce fichier
├── analyze_logs_typeids.js      ← Analyse auto logs
├── find_suspect_typeids.js      ← Liste suspects
├── TYPEIDS_SUSPECTS.json        ← JSON suspects (généré)
└── TYPEIDS_STATUS.md            ← Documentation complète
```

---

**Dernière mise à jour** : 2025-11-01

