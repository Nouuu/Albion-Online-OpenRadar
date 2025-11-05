# 📊 Guide de Collecte - TypeIDs Living Resources

## 🎯 Objectif

Collecter les TypeIDs des créatures enchantées (Hide/Fiber T4-T8 .1/.2/.3) en utilisant le nouveau système de logging enrichi.

---

## ⚙️ Préparation

### 1. Vider le cache (IMPORTANT!)

Avant de commencer, vider le cache localStorage :

1. Ouvrir la console (F12)
2. Aller dans les Settings du radar
3. Cliquer sur "Clear TypeID Cache"
4. Recharger la page (F5)

### 2. Activer le logging

1. Ouvrir Settings → Debug
2. Cocher **"🔍 Log Living Creatures"**
3. Un guide de collecte s'affiche dans la console

### 3. Ouvrir la console

- Appuyer sur F12
- Onglet "Console"
- Garder la console ouverte pendant toute la session

---

## 🎮 Session de Collecte

### Format des logs

Vous verrez 2 types de logs :

**1. JSON (pour parsing automatique) :**
```
[LIVING_JSON] {"timestamp":"2025-11-03T...","typeId":425,"resource":...}
```

**2. Lisible (pour vous) :**
```
🟢 ✓ TypeID 425 | hide T4.0 | HP: 1323 (expected ~1323, diff: 0) → Boar
│
├─ 🟢 = Créature vivante
├─ ✓ = HP correspond à la créature attendue
├─ TypeID 425 = Identifiant unique
├─ hide T4.0 = Type/Tier/Enchantement
└─ → Boar = Animal identifié
```

### Symboles

- **🟢** = Créature VIVANTE
- **🔴** = Créature MORTE (cadavre)
- **✓** = HP validé (correspond à une créature connue)
- **?** = HP non validé (créature inconnue)

---

## 🗺️ Zones recommandées

### Pour Hide (Animaux)

#### T4 Enchantés (.1 .2 .3)
- **Bridgewatch** - Nord-Ouest (zones rouges)
- **Caerleon** - Steppes autour (zones T4-T5)

#### T5 Enchantés (.1 .2 .3)
- **Forest** - Zones rouges T5
- **Swamp** - Zones rouges T5

#### T6+ Enchantés
- **Black Zone** - Routes principales
- **Avalon Roads** - Chemins aléatoires

### Pour Fiber (Plantes vivantes)

#### T4-T5
- **Highland** - Zones T4-T5 (Keeper)
- **Forest** - Bordures de zones

#### T6+
- **Black Zone** - Zones contestées
- **Hideouts** - Autour des zones de farm

---

## 📝 Pendant la Session

### Ce que vous devez faire

1. **Se déplacer** dans les zones cibles
2. **Tuer des créatures enchantées** (.1, .2, .3)
3. **Observer les logs** dans la console
4. **Vérifier** que le TypeID change pour chaque enchantement

### Ce que vous devez noter

Pour chaque créature tuée :

- ✅ TypeID affiché
- ✅ Tier (T4, T5, T6...)
- ✅ Enchantement (.1, .2, .3)
- ✅ Type (Hide ou Fiber)
- ✅ Validation HP (✓ ou ?)

### Exemple de session

```
Zone: Bridgewatch T4 Red (animaux enchantés)

🟢 ✓ TypeID 425 | hide T4.0 | HP: 1323 → Boar        ← .0 (déjà connu)
🟢 ? TypeID 426 | hide T4.1 | HP: 1450 → Unknown     ← .1 À COLLECTER!
🔴 ? TypeID 426 | hide T4.1 | HP: 0 → Unknown        ← Même créature morte
🟢 ? TypeID 432 | hide T4.2 | HP: 1580 → Unknown     ← .2 À COLLECTER!
🟢 ? TypeID 438 | hide T4.3 | HP: 1720 → Unknown     ← .3 À COLLECTER!
```

---

## 💾 Après la Session

### 1. Sauvegarder les logs

**Méthode 1 : Copier manuellement**
- Clic droit dans la console → "Save as..."
- Sauvegarder en `logs-session-YYYY-MM-DD.txt`

**Méthode 2 : Filtrer et copier**
```javascript
// Coller dans la console pour extraire tous les logs LIVING_JSON
let logs = [];
document.querySelectorAll('.console-message').forEach(msg => {
    if (msg.textContent.includes('[LIVING_JSON]')) {
        logs.push(msg.textContent);
    }
});
copy(logs.join('\n'));
console.log(`✅ ${logs.length} logs copiés dans le presse-papier!`);
```

**Méthode 3 : Filtrer directement dans la console**
1. Cliquer sur l'icône "Filter" (entonnoir) en haut de la console
2. Taper: `LIVING_JSON`
3. Clic droit → "Save as..." → Sauvegarder le fichier filtré

### 2. Parser les logs

Utiliser le script Python fourni :

```bash
cd tools
python parse-living-logs.py logs-session-2025-11-03.txt
```

**Sortie attendue :**
```
📊 LIVING RESOURCES COLLECTION REPORT
═══════════════════════════════════════════════════════════

🔢 Total logs: 150
🆔 Unique TypeIDs: 25

───────────────────────────────────────────────────────────
📋 TypeIDs Summary:
───────────────────────────────────────────────────────────

TypeID   425 →   hide T4.0 |         Boar ✓ | 🟢  45 🔴  12 | Validated: 57/57
TypeID   426 →   hide T4.1 |      Unknown   | 🟢  12 🔴   3 | Validated: 0/15
TypeID   432 →   hide T4.2 |      Unknown   | 🟢   8 🔴   2 | Validated: 0/10
...

───────────────────────────────────────────────────────────
🔍 Coverage Analysis:
───────────────────────────────────────────────────────────

hide:
  T4: Found [.0, .1, .2, .3] | Missing [None]
  T5: Found [.0, .1] | Missing [.2, .3]
  T6: Found [.0] | Missing [.1, .2, .3]

───────────────────────────────────────────────────────────
📝 MobsInfo.js Entries (Copy-paste ready):
───────────────────────────────────────────────────────────

    426: [4, EnemyType.LivingSkinnable, "Hide", 1],
    432: [4, EnemyType.LivingSkinnable, "Hide", 2],
    438: [4, EnemyType.LivingSkinnable, "Hide", 3],
    ...
```

### 3. Envoyer les résultats

Partager :
- Fichier de logs brut (`logs-session-XXX.txt`)
- Sortie du script Python
- Screenshots si possible (validation visuelle)

---

## 🐛 Troubleshooting

### Problème : Pas de logs

**Solution :**
1. Vérifier que "Log Living Creatures" est coché
2. Recharger la page (F5)
3. Vérifier que la console est ouverte

### Problème : Tous les logs affichent "?"

**Cause :** Métadonnées non chargées

**Solution :**
1. Vérifier que `/tools/output/living-resources-enhanced.json` existe
2. Recharger la page (F5)
3. Vérifier les erreurs de chargement dans la console

### Problème : Toujours les mêmes TypeIDs

**Cause :** Vous tuez toujours les mêmes créatures .0

**Solution :**
- Aller dans des zones **enchantées** (rouges/noires)
- Vérifier que l'enchantement change (.1, .2, .3)
- Regarder le cadavre après kill (enchantement visible)

### Problème : Trop de logs

**Solution :**
Filtrer dans la console :
```
Clic sur "Filter" → Taper "LIVING_JSON"
```

---

## 📊 Objectifs de Collecte

### Priorité P1 (Critique)

- [ ] Hide T4 (.1, .2, .3) - **15 TypeIDs**
- [ ] Hide T5 (.1, .2, .3) - **15 TypeIDs**
- [ ] Fiber T4 (.1, .2, .3) - **9 TypeIDs**
- [ ] Fiber T5 (.1, .2, .3) - **9 TypeIDs**

### Priorité P2 (Important)

- [ ] Hide T6 (.1, .2, .3) - **15 TypeIDs**
- [ ] Fiber T6 (.1, .2, .3) - **9 TypeIDs**

### Priorité P3 (Optionnel)

- [ ] Hide T7-T8 enchantés
- [ ] Fiber T7-T8 enchantés
- [ ] Wood/Ore/Rock living resources

---

## 🎯 Tips

### Maximiser l'efficacité

1. **Groupe avec scanner** - Quelqu'un avec mount rapide scanne, vous collectez
2. **Routes commerciales** - Black zone routes = beaucoup de créatures enchantées
3. **Hideouts farming** - Zones autour des hideouts actifs
4. **Avalon roads** - Chemins aléatoires avec spawns variés

### Identifier rapidement l'enchantement

Après un kill, regarder le cadavre :
- **Pas de glow** = .0 (normal)
- **Glow vert** = .1
- **Glow bleu** = .2
- **Glow violet** = .3

### Optimiser le temps

- **1h session** = ~30-50 TypeIDs collectés (zones T4-T5)
- **2h session** = ~70-100 TypeIDs collectés (mixte T4-T6)
- **4h session** = ~150-200 TypeIDs collectés (complet T4-T8)

---

## 📞 Support

Questions? Problèmes?

- **GitHub Issues** : [Lien vers le repo]
- **Discord** : [Lien Discord du projet]
- **Contact** : @Nouuu

---

**Bonne collecte! 🎮🔍**

