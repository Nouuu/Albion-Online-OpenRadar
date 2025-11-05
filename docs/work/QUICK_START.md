# 🚀 Quick Start - Collecte TypeIDs

## ✅ Votre système fonctionne déjà !

D'après vos logs, le système de logging enrichi est opérationnel. Voici comment commencer la collecte immédiatement.

---

## 📋 Checklist Rapide

### 1. Préparation (2 min)

```
✅ Ouvrir la console (F12)
✅ Activer "Log Living Creatures" dans Settings → Debug
✅ Vider le cache TypeID (Settings → Debug → Clear TypeID Cache)
✅ Recharger la page (F5)
```

### 2. Pendant le jeu (30-60 min)

```
🎯 Aller dans les zones avec créatures enchantées
🔪 Tuer des animaux/plantes vivants (.1, .2, .3)
👀 Observer les logs dans la console
```

**Vous verrez des logs comme :**
```json
{"timestamp":"2025-11-03T11:13:16.054Z","module":"MobsHandler","event":"SPAWN",...}
```

ET des logs lisibles :
```
🟢 ✓ TypeID 425 | hide T4.0 | HP: 1323 → Boar
```

### 3. Sauvegarder (5 min)

**Option A - Rapide (Console browser)**
```javascript
// Coller dans la console
let logs = [];
document.querySelectorAll('.console-message').forEach(msg => {
    if (msg.textContent.includes('[LIVING_JSON]')) {
        logs.push(msg.textContent);
    }
});
copy(logs.join('\n'));
console.log(`✅ ${logs.length} logs copiés!`);
```
Puis `Ctrl+V` dans un fichier texte.

**Option B - Complète (Save as)**
1. Filtrer la console : taper `LIVING_JSON` dans le filtre
2. Clic droit → "Save as..."
3. Nom : `logs-session-2025-11-03.txt`

### 4. Analyser (1 min)

```bash
cd tools
python parse-living-logs.py logs-session-2025-11-03.txt
```

**Sortie attendue :**
```
📊 LIVING RESOURCES COLLECTION REPORT
═══════════════════════════════════════

🔢 Total logs: 45
🆔 Unique TypeIDs: 8

TypeID 425 → hide T4.0 | Boar ✓ | 🟢 12 🔴 3
TypeID 426 → hide T4.1 | Unknown | 🟢 5 🔴 1
...

📝 MobsInfo.js Entries:
    426: [4, EnemyType.LivingSkinnable, "Hide", 1],
    ...
```

---

## 🎯 Zones Recommandées (30 min chacune)

### Session 1 : Hide T4 (.0, .1, .2, .3)
**Zone :** Bridgewatch - Nord-Ouest (zones rouges T4)  
**Créatures :** Boar, Wolf, Fox  
**Objectif :** 4 TypeIDs minimum (T4.0 + T4.1 + T4.2 + T4.3)

### Session 2 : Hide T5 (.0, .1, .2, .3)
**Zone :** Forest - Zones rouges T5  
**Créatures :** Bear, Direwolf  
**Objectif :** 4 TypeIDs minimum

### Session 3 : Fiber T4-T5
**Zone :** Highland/Forest T4-T5  
**Créatures :** Plantes vivantes (Keeper)  
**Objectif :** 8 TypeIDs (T4 x4 + T5 x4)

---

## 🔍 Ce que vous devez chercher

### Identifier l'enchantement

Après un kill, regarder le cadavre :
- **Pas de glow** = .0 (normal) ← Déjà collecté
- **Glow vert** = .1 ← À COLLECTER
- **Glow bleu** = .2 ← À COLLECTER  
- **Glow violet** = .3 ← À COLLECTER

### Logs à analyser

**Bon log (créature enchantée) :**
```json
"reportedTypeId":426, "tier":4, "name":"hide", "enchant":1  ← TypeID 426 = Hide T4.1!
```

**Log ignoré (créature normale) :**
```json
"reportedTypeId":425, "tier":4, "name":"hide", "enchant":0  ← Déjà connu
```

---

## 📊 Tracking en temps réel

### Dans un fichier texte séparé, notez :

```
=== SESSION 2025-11-03 ===

Zone: Bridgewatch T4 Red
Time: 14:30

TypeID 425 | Hide T4.0 | Boar      ← Déjà connu
TypeID 426 | Hide T4.1 | Unknown   ← NOUVEAU! ✅
TypeID 432 | Hide T4.2 | Unknown   ← NOUVEAU! ✅
TypeID 438 | Hide T4.3 | Unknown   ← NOUVEAU! ✅

Total nouveaux: 3
```

---

## ⚠️ Problèmes courants

### "Pas de logs [LIVING_JSON]"
✅ Vérifier que "Log Living Creatures" est coché  
✅ Recharger la page (F5)  
✅ Aller dans une zone avec des créatures

### "Tous les TypeIDs sont identiques"
✅ Vous tuez toujours des .0 (normaux)  
✅ Aller dans des zones **enchantées** (rouges/noires)  
✅ Vérifier le glow sur le cadavre

### "Trop de logs, je m'y perds"
✅ Filtrer la console : `LIVING_JSON`  
✅ Utiliser le script de copie (Option A)  
✅ Faire des pauses toutes les 15 min pour sauvegarder

---

## 📈 Objectif de la session

**Minimum viable (1h) :**
- Hide T4 : 4 TypeIDs (.0, .1, .2, .3)
- Hide T5 : 4 TypeIDs (.0, .1, .2, .3)

**Complet (2-3h) :**
- Hide T4-T5 : 8 TypeIDs
- Fiber T4-T5 : 8 TypeIDs
- Total : 16 nouveaux TypeIDs

**Full coverage (4-6h) :**
- Hide T4-T8 (tous enchants)
- Fiber T4-T8 (tous enchants)
- Wood/Ore/Rock (optionnel)

---

## 🎉 Après la collecte

1. ✅ Parser les logs : `python parse-living-logs.py logs.txt`
2. ✅ Copier les entrées MobsInfo.js générées
3. ✅ Créer une issue GitHub avec les résultats
4. ✅ Partager les logs bruts (pour validation)

---

**Prêt ? Lancez le jeu et bonne collecte ! 🎮🔍**

> 💡 **Tip** : Commencez par 15-30 min pour tester le workflow, puis faites une session longue.

