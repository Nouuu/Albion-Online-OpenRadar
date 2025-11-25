# 🎯 ALBION RADAR - ÉTAT DES LIEUX

**Dernière mise à jour**: 2025-11-25 23:50

---

## ✅ FONCTIONNEL (100%)

- **Mobs**: Apparition + mouvement (Event 3, coords RELATIVE)
- **Resources**: Harvestables detection
- **Chests**: Loot detection
- **Local Player**: Position tracking (Operation 21)
- **Players**: Spawn detection (Event 29 - noms/guildes/alliances)

---

## ❌ NON-FONCTIONNEL - CAUSE IDENTIFIÉE

### Positions Joueurs

**Symptôme**: Joueurs détectés mais mal positionnés

**Cause Racine**: **Chiffrement double couche**

```
Niveau 1: Photon AES-256-CBC (TOUT le traffic)
  └─> Event 593 (KeySync) chiffré
      └─> Contient XorCode (8 bytes)

Niveau 2: XOR Position (Albion)
  └─> Event 29/3 positions chiffrées avec XorCode
```

**Sans déchiffrer Photon → Pas d'accès à XorCode → Positions illisibles**

---

## 📊 PREUVES

### Code DEATHEYE (Référence)
- Event 593 KeySync: `param[0] = XorCode (8 bytes)`
- Positions décryptées: `XOR avec XorCode → Coords WORLD absolues`
- **Requirement**: Cryptonite (MITM Photon pour déchiffrer Event 593)

### Discord Thread (Jonyleeson)
> "The KeySync event itself is encrypted using photons built in encryption, Cryptonite decrypted any photon event/operation response that was encrypted"

> "you won't be able to glean any information from listening on the wire, you need to set up a (custom photon) mitm proxy"

**Spécifications Photon Encryption**:
- Algorithm: AES-256-CBC
- IV: 16 null bytes
- Key: SHA256(DH_shared_secret)
- DH Prime: Oakley 768-bit, Root: 22

---

## 🚫 IMPASSES CONFIRMÉES

### ❌ XOR avec Header (BREAKTHROUGH.md)
```javascript
const headerBytes = buffer.slice(1, 9);  // FAUX
const decrypted = coordBytes.map((b, i) => b ^ headerBytes[i]);
// → GARBAGE
```
**Raison**: XorCode vient d'Event 593, PAS du header

### ❌ Fallback Coords Claires
```javascript
parameters[19] = -21532.45  // GARBAGE
parameters[20] = 3.62e-37   // GARBAGE
```
**Raison**: Version actuelle Albion = tout chiffré

### ❌ Event 593 Capturé
```json
{
  "eventCode": 593,
  "parameters": {
    "0": 0,  // INT, pas XorCode
    "1": ["JOURNAL_..."]  // Journaux, pas KeySync
  }
}
```
**Raison**: Event journaux (faux positif), vrai KeySync chiffré AES

---

## ✅ SOLUTIONS VIABLES

### Option A: MITM Photon (3-4 semaines)
- Proxy UDP transparent
- Intercepter DH key exchange
- Déchiffrer AES-256-CBC
- Extraire XorCode
- **Risque détection**: FAIBLE si read-only

### Option B: Community (1-2 semaines)
- Cryptonite alternative (si trouvable)
- Collaboration open-source
- **Risque**: Dépendance externe

### Option C: PvE-only (0 jours)
- Utiliser radar actuel (mobs/resources)
- Accepter limitation (pas de players positions)
- **Risque**: AUCUN

---

## 📝 DÉCISION REQUISE

Voir **NEXT_STEPS.md** pour détails options.

**Facteurs**:
- Temps disponible?
- Intérêt technique vs fonctionnel?
- Tolérance risque TOS?

---

## 📁 FICHIERS CLÉS

**Documentation**:
- `TECHNICAL_REALITY.md`: Analyse complète architecture
- `NEXT_STEPS.md`: Options détaillées + recommandations
- `ACTION_PLAN.md`: Ce fichier (synthèse)

**Code Modifié (Session 2025-11-25)**:
- `Protocol16Deserializer.js`: XOR attempt (non fonctionnel sans XorCode)
- `PlayersHandler.js`: playerSpawns Map
- `app.js`: Port filter 5050-5060
- `Utils.js`: Event 593 logging

**Logs Référence**:
- `session_2025-11-25T10-15-16.jsonl`: Type mismatch identifié
- `work/data/albion-radar-deatheye-2pc/`: Code source DEATHEYE

---

**Status**: ⏸️ ATTENTE DÉCISION - OPTIONS A/B/C