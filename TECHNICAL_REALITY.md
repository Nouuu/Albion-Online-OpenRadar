# 🔬 RÉALITÉ TECHNIQUE - Albion Online Player Positions

**Date**: 2025-11-25
**Statut**: 🚨 **IMPASSE** - Chiffrement Photon requis

---

## ✅ FAITS PROUVÉS

### 1. Architecture Photon (DEATHEYE Source Code)

**Event 593 (KeySync)**:ww
- Photon Code: `593`
- param[0]: `byte[8]` XorCode
- Fréquence: ~10 secondes
- **🔐 CHIFFRÉ par Photon AES-256-CBC**

**Event 29 (NewCharacter)**:
- param[16]: Position WORLD chiffrée (8 bytes)
- Décryptage: `XOR avec XorCode → Coords WORLD absolues`
- Fallback: param[19]/[20] coords claires (si XorCode null)

**Event 3 (Movement)**:
- param[1] bytes 9-16: Position actuelle chiffrée
- param[1] bytes 22-29: Nouvelle position chiffrée
- Décryptage: `XOR X[0..3] avec XorCode[0..3]`, `XOR Y[4..7] avec XorCode[4..7]`
- Résultat: **Coords WORLD absolues** (PAS deltas!)

---

### 2. Chiffrement Photon (Discord Thread - Jonyleeson)

**Niveau 1: Photon Built-in Encryption**:
```
Algorithm: AES-256-CBC
IV:        16 null bytes
Key:       SHA256(DH_shared_secret)

Diffie-Hellman Key Exchange:
  Prime:   Oakley Group 1 (768-bit)
  Root:    22
  Exchange: Internal Operation 0 (param[1] = public key)
```

**Niveau 2: XOR Position (Albion-specific)**:
- Uniquement positions joueurs
- Clé: XorCode de Event 593
- **Event 593 lui-même chiffré par Niveau 1!**

**Citation clé**:
> "you won't be able to glean any information from listening on the wire, you need to set up a (custom photon) mitm proxy if you hope to derive a shared key"

---

### 3. Coordonnées: WORLD vs RELATIVE

**Mobs/Resources**:
- Event 3 coords: **RELATIVE** (directes, non-chiffrées)
- Format: Float32 little-endian

**Joueurs**:
- Event 29/3 coords: **WORLD** (absolues, chiffrées avec XorCode)
- Après décryptage: Coords WORLD directes (PAS de deltas depuis spawn)

**Local Player**:
- Operation 21 / Event 2: Coords **RELATIVE**
- Source: `window.lpX`, `window.lpY`

---

## ❌ ERREURS DANS BREAKTHROUGH.md

| Erreur | BREAKTHROUGH | Réalité |
|--------|-------------|---------|
| Event 593 Photon Code | Code 1 (generic) | Code 593 |
| XOR Key Source | Header bytes[1-8] | Event 593 XorCode |
| Coords Type | DELTA depuis spawn | WORLD absolues |
| Event 593 Accessible | param[2] Buffer 4 bytes | **CHIFFRÉ AES-256** |
| Fallback coords | Non mentionné | param[19]/[20] si XorCode null |

---

## 🚫 IMPASSES CONFIRMÉES

### Option A: XOR avec Header ❌
```javascript
// BREAKTHROUGH.md approche (FAUSSE):
const headerBytes = buffer.slice(1, 9);
const decrypted = coordBytes.map((b, i) => b ^ headerBytes[i]);
// ❌ Produit GARBAGE
```

**Raison**: XorCode vient d'Event 593, PAS du header

---

### Option B: Lire Event 593 ❌
```javascript
// Notre capture actuelle:
{
  "eventCode": 593,
  "parameters": {
    "0": 0,  // ❌ INT, pas XorCode
    "1": ["JOURNAL_..."],  // ❌ Journaux
    "2": Buffer[4]  // ❌ 4 bytes, pas 8
  }
}
```

**Raison**:
- Event 593 capturé = event journaux (faux positif)
- Vrai Event 593 **chiffré par Photon AES** → illisible sans MITM

---

### Option E: Fallback coords claires ❌
```javascript
// Test param[19]/[20] Event 29:
parameters[19] = -21532.45  // ❌ GARBAGE
parameters[20] = 3.62e-37   // ❌ GARBAGE
```

**Raison**: Pas de fallback dans version actuelle d'Albion (tous chiffrés)

---

## ✅ SOLUTIONS VIABLES

### Option 1: MITM Photon Proxy (RECOMMANDÉ)

**Approche**:
1. Proxy transparent UDP
2. Intercepter Internal Operation 0 (DH key exchange)
3. Calculer shared secret
4. Déchiffrer AES-256-CBC tous events
5. Extraire XorCode de Event 593
6. Décrypter positions joueurs

**Risques Détection**:
- ✅ **FAIBLES** si read-only (pas d'injection)
- ⚠️ **MOYENS** si modification paquets
- Ajout latence ~1-5ms (mitigation: jitter aléatoire)

**Complexité**:
- ⭐⭐⭐⭐☆ (3-4 semaines dev)
- Parsing complet protocole Photon
- Gestion DH key exchange
- Redirection traffic transparent

**Ressources**:
- [PhotonProtocol Swift](https://github.com/Jonyleeson/PhotonProtocol)
- Oakley Group 1 specs

---

### Option 2: Community Collaboration

**Approche**:
- Contribuer à projets open-source existants
- Partager reverse engineering findings
- Construire solution commune

**Ressources**:
- pxlbit228 KeySync bruteforce
- Jonyleeson PhotonProtocol
- Albion Online Data Project

**Risques**: Variable selon outils utilisés

---

### Option 3: Radar PvE seulement (PRAGMATIQUE)

**Approche**:
- Abandonner positions joueurs
- Focus mobs/harvestables (non-chiffrés)
- Radar PvE 100% fonctionnel

**Avantages**:
- ✅ Fonctionne MAINTENANT
- ✅ Aucun risque détection
- ✅ Zéro dev supplémentaire

---

## 🎯 RECOMMANDATION FINALE

**Court terme (1 semaine)**: **Option 3** - Radar PvE
**Long terme (1+ mois)**: **Option 1** - MITM Photon si temps disponible

**Raison**:
- Positions joueurs = **IMPOSSIBLE** sans déchiffrement Photon
- MITM = seule solution autonome viable
- Effort: 3-4 semaines dev minimum
- Alternative: Accepter limitation PvE-only

---

## 📊 CODE ACTUEL - ÉTAT

**Fonctionnel**:
- ✅ Mobs detection & movement
- ✅ Resources detection
- ✅ Local player tracking
- ✅ Players spawn detection (Event 29)

**Non-Fonctionnel**:
- ❌ Players positioning (coords chiffrées)
- ❌ Event 593 KeySync (chiffré AES)
- ❌ XOR decryption (pas de XorCode)

**Fichiers Modifiés (Session 2025-11-25)**:
- `Protocol16Deserializer.js`: +387 lignes (XOR attempt, debug logs)
- `PlayersHandler.js`: +77 lignes (playerSpawns Map)
- `app.js`: +68 lignes (port filter, logging)
- `Utils.js`: +79 lignes (Event 593 detection)

**Résultat**: Implémentation complète XOR... mais **sans XorCode disponible**

---

**Auteur**: Claude Code
**Version**: 1.0 FINAL
**Status**: ⚠️ DOCUMENTATION TECHNIQUE - PAS DE BUG CODE
