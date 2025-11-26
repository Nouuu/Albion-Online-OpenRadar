# Recherche: Détection Position Joueurs via MITM Proxy

**Date**: 2025-11-26
**Status**: ❌ Non implémenté - Approche AlbionRadar adoptée

---

## 🎯 Problème

Les joueurs sont détectés (noms, guildes, alliances) via Event 29, mais leurs positions sont **chiffrées** et illisibles.

## 🔐 Cause Racine: Double Chiffrement

### Niveau 1: Photon AES-256-CBC
Tout le trafic Photon (UDP) est chiffré avec:
- **Algorithm**: AES-256-CBC
- **IV**: 16 null bytes
- **Key**: SHA256(DH_shared_secret)
- **DH Prime**: Oakley 768-bit, Root: 22

### Niveau 2: XOR Albion
Les positions (Event 29, Event 3) sont chiffrées avec un **XorCode** (8 bytes):
```
Position chiffrée XOR XorCode = Position RELATIVE
```

**Le XorCode est transmis via Event 593 (KeySync)**, lui-même chiffré par Photon.

## 🚫 Pourquoi Simple Capture Échoue

```
Wireshark/pcap → Traffic UDP chiffré AES
    → Event 593 illisible
        → Pas d'accès au XorCode
            → Positions indéchiffrables
```

## ✅ Solution Technique (DEATHEYE)

DEATHEYE utilisait **Cryptonite** (MITM Proxy Photon):
1. Proxy UDP transparent
2. Intercepter DH key exchange
3. Dériver AES key
4. Déchiffrer Event 593 → Extraire XorCode
5. Déchiffrer positions Event 29/3

### Spécifications MITM
```csharp
// Event 593 déchiffré:
parameters[0] = XorCode (byte[8])

// Utilisation:
float DecryptFloat(byte[] encrypted, byte[] xorCode) {
    byte[] decrypted = new byte[4];
    for (int i = 0; i < 4; i++) {
        decrypted[i] = (byte)(encrypted[i] ^ xorCode[i]);
    }
    return BitConverter.ToSingle(decrypted, 0);
}
```

## 📊 Preuves

### Discord (Jonyleeson - ex-dev DEATHEYE)
> "The KeySync event itself is encrypted using photons built in encryption, **Cryptonite decrypted any photon event/operation response** that was encrypted"

> "you won't be able to glean any information from listening on the wire, **you need to set up a (custom photon) mitm proxy**"

### Code DEATHEYE
- `Radar/Photon/PhotonParser.cs`: Gestion Event 593
- `Protocol/Connect/Messages/KeySyncEvent.cs`: Extraction XorCode
- Dependency: Cryptonite (proxy MITM)

## ⚠️ Impasses Confirmées

### ❌ XOR avec Header
```javascript
const headerBytes = buffer.slice(1, 9);  // FAUX
const decrypted = coordBytes.map((b, i) => b ^ headerBytes[i]);
// → GARBAGE (XorCode ≠ header)
```

### ❌ Event 593 Capturé Non-Chiffré
Logs montrent Event 593 avec journaux, **pas KeySync**:
```json
{
  "eventCode": 593,
  "parameters": {
    "0": 0,  // INT, pas byte[8]
    "1": ["JOURNAL_..."]  // Journaux, pas XorCode
  }
}
```
Le vrai KeySync est chiffré AES → invisible sans MITM.

## 🔄 Décision: Approche AlbionRadar

### Implémentation Actuelle
- ✅ Détection spawn/despawn joueurs (Event 29)
- ✅ Affichage noms/guildes/alliances
- ✅ Détection équipement (IDs)
- ❌ Positions joueurs (chiffrées)

### Comparaison

| Feature | DEATHEYE | AlbionRadar | Notre Radar |
|---------|----------|-------------|-------------|
| Spawn joueurs | ✅ | ✅ | ✅ |
| Positions | ✅ MITM | ❌ | ❌ |
| Equipment | ✅ | ✅ | ✅ (IDs) |
| Item Power | ✅ XML | ✅ items.txt | 🚧 Phase 3 |

### Justification
1. **MITM Proxy = 3-4 semaines dev** (DH interception, AES decrypt, XOR logic)
2. **Risque détection**: Modification trafic réseau
3. **Focus**: Features PvE (mobs, resources, equipment stats)

## 📁 Phase 3: Player Equipment & Item Power

**Référence**: `ANALYSIS_DEATHEYE_VS_CURRENT.md` (docs/)

Au lieu de positions, focus sur:
1. Parser `items.xml` → Database item ID ↔ itempower
2. Lookup équipement joueurs (Event 29 parameters[17])
3. Calculer Item Power moyen réel (700-1400 range)
4. Afficher stats équipement détaillés

## 🔗 Références

- **DEATHEYE Source**: `work/data/albion-radar-deatheye-2pc/`
- **AlbionRadar**: Approche sans positions (spawn/despawn only)
- **Photon Encryption**: Discord thread + Cryptonite dependency
- **items.xml**: `work/data/ao-bin-dumps-master/items.xml`

---

**Conclusion**: Positions joueurs nécessitent MITM Photon (hors scope). Focus Phase 3: Equipment stats avec XML database.