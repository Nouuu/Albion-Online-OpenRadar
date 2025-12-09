# Plan de Refonte du Système de Détection des Ressources

**Date de création:** 2025-12-02  
**Dernière mise à jour:** 2025-12-09  
**Statut:** Phase 4 ✅ **COMPLÉTÉE ET VALIDÉE** | Phase 5 ⏸️ EN ATTENTE

---

## 📊 Résumé des Phases

| Phase | Description | Statut | Commit |
|-------|-------------|--------|--------|
| 1 | HarvestablesDatabase | ✅ | `c34023e1` |
| 2 | Suppression Cache Legacy | ✅ | `b1498a0a` |
| 3 | Fix Bug T6+ (override typeNumber) | ✅ | - |
| 3B | Fix Bugs Living Resources (params[33]) | ✅ | - |
| 4 | Utilisation Database + Fix isLiving | ✅ | - |
| 5 | MobsDatabase | ⏸️ | - |

---

## ✅ Architecture Actuelle (Post-Phase 4)

### Flux de Détection des Ressources

```
┌─────────────────────────────────────────────────────────────────┐
│                    EVENTS RÉSEAU (Photon)                       │
├─────────────────────────────────────────────────────────────────┤
│  Event 38: NewSimpleHarvestableObjectList (batch spawn)         │
│  Event 40: NewHarvestableObject (individual spawn)              │
│  Event 46: HarvestableChangeState (update)                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   HarvestablesHandler.js                        │
├─────────────────────────────────────────────────────────────────┤
│  • Parse les paramètres (type, tier, enchant, mobileTypeId)     │
│  • Détermine isLiving basé sur mobileTypeId                     │
│  • Valide via HarvestablesDatabase                              │
│  • Filtre via settings (Static/Living × Type × Tier × Enchant)  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   HarvestablesDatabase.js                       │
├─────────────────────────────────────────────────────────────────┤
│  • Charge harvestables.json (5 types, 190 combinaisons)         │
│  • Valide les combinaisons type/tier/enchant                    │
│  • Fournit getResourceTypeFromTypeNumber()                      │
└─────────────────────────────────────────────────────────────────┘
```

### Fichiers Clés

| Fichier | Rôle |
|---------|------|
| `scripts/Data/HarvestablesDatabase.js` | Parse harvestables.json, validation |
| `scripts/Handlers/HarvestablesHandler.js` | Détection, filtrage, affichage |
| `public/ao-bin-dumps/harvestables.json` | Source de données |

### Logique isLiving - CORRIGÉE (2025-12-09)

```javascript
// ✅ LOGIQUE CORRECTE
const isLiving = mobileTypeId !== null && mobileTypeId !== 65535;
```

| mobileTypeId | Source | isLiving | Catégorie |
|--------------|--------|----------|-----------|
| `null` | Event 38 (batch) | `false` | Static |
| `65535` | Event 40 | `false` | **Static enchanté** |
| `425, 530, etc.` | Event 40 | `true` | **Living (animal)** |

---

## ✅ Phase 4 - Détails (COMPLÉTÉE 2025-12-09)

### Bug Critique Corrigé

**Problème :** La logique `isLiving` était **INVERSÉE** !

```javascript
// ❌ AVANT (FAUX)
const isLiving = mobileTypeId === 65535;
// Résultat: Bois enchanté → Living, Animal → Static (INVERSÉ!)

// ✅ APRÈS (CORRECT)
const isLiving = mobileTypeId !== null && mobileTypeId !== 65535;
// Résultat: Bois enchanté → Static, Animal → Living (CORRECT!)
```

### Tests Validés (session_2025-12-09T17-51-07.jsonl)

| Type | mobileTypeId | isLiving | Status |
|------|--------------|----------|--------|
| Fiber T5 .1 (enchanté) | 65535 | false | ✅ Static |
| Hide T4 .0 (animal) | 425 | true | ✅ Living |
| Log T4 .0 (batch) | null | false | ✅ Static |

### Modifications Appliquées

**`scripts/Handlers/HarvestablesHandler.js` :**
- ✅ `addHarvestable()` : Logique isLiving corrigée (ligne ~157)
- ✅ `UpdateHarvestable()` : Logique isLiving corrigée (ligne ~217)
- ✅ `newHarvestableObject()` : Log isLiving corrigé (ligne ~374)
- ✅ Validation via `HarvestablesDatabase.isValidResource()`
- ✅ Logs détaillés pour debug

---

## ⏸️ Phase 5 - MobsDatabase (EN ATTENTE)

### Objectif

Remplacer `MobsInfo.js` (235 TypeIDs hardcodés) par `MobsDatabase.js` basé sur `mobs.json`.

### Fichiers Concernés

| Fichier | Action |
|---------|--------|
| `scripts/Handlers/MobsInfo.js` | **À SUPPRIMER** après migration |
| `scripts/Handlers/MobsHandler.js` | Utiliser MobsDatabase au lieu de mobinfo |
| `scripts/Data/MobsDatabase.js` | **À CRÉER** |
| `public/ao-bin-dumps/mobs.json` | Source de données |

### Plan d'Implémentation

1. **Créer `MobsDatabase.js`**
   - Parser `mobs.json`
   - Méthodes : `getMobInfo(typeId)`, `isValidMob()`, `getResourceFromMob()`
   
2. **Modifier `MobsHandler.js`**
   - Remplacer `this.mobinfo` par `window.mobsDatabase`
   - Adapter `calculateResourceInfo()`
   
3. **Tests Critiques**
   - Tester Living resources (Hide, Fiber vivants)
   - Tester Mobs/Ennemis normaux
   - Vérifier cohérence avec HarvestablesHandler

4. **Supprimer `MobsInfo.js`**
   - Seulement APRÈS validation complète

---

## ⚠️ LEÇONS APPRISES - Phase 5 Guidelines

### 1. Vérifier la Logique des Conditions Booléennes

```javascript
// ❌ PIÈGE Phase 4 : "65535 = special" ne signifie PAS "65535 = living"

// Toujours se poser la question :
// - Que signifie CHAQUE valeur possible ?
// - Quelle est la valeur par DÉFAUT ?
// - Y a-t-il des cas EDGE (null, undefined, 0) ?

// Exemple de vérification :
const testCases = [
    { mobileTypeId: null, expected: false },      // batch spawn
    { mobileTypeId: 65535, expected: false },     // static enchanté
    { mobileTypeId: 425, expected: true },        // animal Hide
    { mobileTypeId: 530, expected: true },        // creature Fiber
];

testCases.forEach(tc => {
    const actual = tc.mobileTypeId !== null && tc.mobileTypeId !== 65535;
    console.assert(actual === tc.expected, `Failed for ${tc.mobileTypeId}`);
});
```

### 2. Analyser les Logs AVANT de Conclure

```javascript
// Dans les logs Phase 4, on voyait :
// Hide T4 (animal) : mobileTypeId = 425, isLiving = false ❌
// Wood T4.1 (enchanté) : mobileTypeId = 65535, isLiving = true ❌

// C'était L'INVERSE de la réalité !
// → Toujours comparer logs avec comportement ATTENDU in-game
```

### 3. Ne Pas Faire Confiance aux Commentaires Existants

```javascript
// Le commentaire disait :
// "mobileTypeId === 65535 → Living resources (animals: Hide)"
// MAIS c'était FAUX !

// → Vérifier les hypothèses en testant, pas juste en lisant
```

### 4. Tester les DEUX Branches d'une Condition

```javascript
// Phase 4 a d'abord testé uniquement les ressources enchantées (Wood .1)
// Le bug sur Hide (living) n'a été découvert que plus tard

// Pour Phase 5, tester SYSTÉMATIQUEMENT :
// - Cas "true" de la condition
// - Cas "false" de la condition
// - Cas edge (null, undefined, valeurs limites)
```

### 5. Garder les Logs de Debug Pendant le Développement

```javascript
// Les logs Event40_IndividualSpawn_FULL ont permis de voir le bug :
// { mobileTypeId: 425, isLiving: false } // ← VISIBLE dans les logs !

// Ne pas supprimer les logs détaillés trop tôt
// Utiliser window.logger.setLevel('DEBUG') pendant les tests
```

### 6. Créer des Tests de Validation Explicites

```javascript
// Pour Phase 5, créer des fonctions de test :
function validateMobsDatabase() {
    const testMobs = [
        { typeId: 425, expectedType: 'Hide', expectedTier: 4 },
        { typeId: 530, expectedType: 'Fiber', expectedTier: 4 },
        // ... autres cas
    ];
    
    testMobs.forEach(test => {
        const info = window.mobsDatabase.getMobInfo(test.typeId);
        console.assert(info?.type === test.expectedType, 
            `TypeId ${test.typeId}: expected ${test.expectedType}, got ${info?.type}`);
    });
}
```

---

## 📊 État du Système (Déc 2025)

### Ce Qui Fonctionne

| Fonctionnalité | Status | Notes |
|----------------|--------|-------|
| Ressources T1-T8 | ✅ | Tous types (Wood, Rock, Fiber, Hide, Ore) |
| Enchantements .0-.4 | ✅ | Via params[33] directement |
| Living resources | ✅ | Via mobileTypeId (!=null && !=65535) |
| Static resources | ✅ | Via Event 38 ou mobileTypeId=65535 |
| HarvestablesDatabase | ✅ | 5 types, 190 combinaisons |
| Validation database | ✅ | isValidResource() utilisé |

### Ce Qui Reste à Faire

| Tâche | Phase | Priorité |
|-------|-------|----------|
| Créer MobsDatabase.js | 5 | Moyenne |
| Migrer MobsInfo.js vers database | 5 | Moyenne |
| Supprimer MobsInfo.js | 5 | Basse |

### Comparaison avec Items/Spells

| Système | Database | Utilisée | Legacy Code |
|---------|----------|----------|-------------|
| Items | ✅ | ✅ | ❌ |
| Spells | ✅ | ✅ | ❌ |
| Harvestables | ✅ | ✅ | ❌ |
| Mobs | ❌ | ❌ | ✅ (MobsInfo.js) |

---

## 📁 Code Legacy Supprimé (Phases 1-4)

### HarvestablesHandler.js - Supprimé

```javascript
// ❌ Cache/Apprentissage (Phase 2)
this.lastHarvestCache = new Map();
this.lastInventoryQuantities = new Map();
this.pendingHarvestableId = null;
this.isHarvesting = false;
this.discoveredItemIds = new Map();

// ❌ Méthodes supprimées
onHarvestStart()
onHarvestCancel()
onNewSimpleItem()
getResourceInfoFromItemId()  // 50+ mappings hardcodés

// ❌ Events supprimés
Event 32 (NewSimpleItem)
Event 59 (HarvestStart)
Event 60 (HarvestCancel)
Event 61 (HarvestFinished)
```

### MobsHandler.js - Supprimé (Phase 3B)

```javascript
// ❌ Calcul approximatif depuis rarity
calculateEnchantment(type, tier, rarity, paramsEnchant) {
    if (type === EnemyType.LivingHarvestable) {
        const diff = rarity - baseRarity;
        return Math.floor(diff / 45);  // ❌ Unreliable
    }
    return 0;  // ❌ Toujours 0 pour Hide !
}

// ✅ Remplacé par :
calculateEnchantment(type, tier, rarity, paramsEnchant) {
    if (paramsEnchant !== null && paramsEnchant !== undefined) {
        return Math.max(0, Math.min(4, paramsEnchant));
    }
    return 0;
}
```

---

## 🔧 Debugging Guide

### Vérifier la Database

```javascript
// Console browser
console.log(window.harvestablesDatabase);
// Attendu: { isLoaded: true, stats: { typesLoaded: 5, combinationsLoaded: 190 } }

// Vérifier une combinaison
window.harvestablesDatabase.isValidResource('WOOD', 4, 1);
// Attendu: true (Wood T4 .1 existe)
```

### Analyser les Détections

```javascript
// Toutes les détections récentes
window.logger.logs.filter(l => 
    l.category === '[CLIENT] HARVEST' && 
    l.event === 'Detection'
).slice(-20);

// Détections avec isLiving=true (animaux)
window.logger.logs.filter(l => 
    l.event === 'Detection' && 
    l.data.isLiving === true
);

// Ressources enchantées
window.logger.logs.filter(l => 
    l.event === 'Detection' && 
    l.data.enchant > 0
);
```

### Vérifier les Filtres

```javascript
// Ressources filtrées par settings
window.logger.logs.filter(l => 
    l.event === 'FilteredBySettings' || 
    l.event === 'FilteredByUpdate'
);

// Ressources invalides selon database
window.logger.logs.filter(l => 
    l.event === 'InvalidResourceCombination'
);
```

---

## 📚 Références

### Fichiers du Projet

- `scripts/Data/HarvestablesDatabase.js` - Database des ressources
- `scripts/Handlers/HarvestablesHandler.js` - Handler principal
- `scripts/Handlers/MobsHandler.js` - Handler des mobs (Phase 5)
- `scripts/Handlers/MobsInfo.js` - Legacy à supprimer (Phase 5)
- `public/ao-bin-dumps/harvestables.json` - Source de données

### Projet de Référence

- `work/data/albion-radar-deatheye-2pc/` - Implémentation C# (event-driven simple)

### Sessions de Test

- `logs/sessions/session_2025-12-09T17-51-07.jsonl` - Validation Phase 4

---

**Fin du document de travail**
