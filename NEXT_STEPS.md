# 🎯 PROCHAINES ÉTAPES - Décision Stratégique

**Date**: 2025-11-25
**Contexte**: Positions joueurs chiffrées avec Photon AES-256 + XOR

---

## 📋 CHOIX À FAIRE

### A) MITM Photon Proxy (Autonome, Long)

**Effort**: 3-4 semaines développement

**Phases**:
1. **Week 1-2**: Infrastructure MITM
   - Proxy UDP transparent (Node.js dgram)
   - Interception Internal Operation 0
   - Calcul Diffie-Hellman shared secret
   - Implémentation AES-256-CBC decrypt

2. **Week 3**: Photon Protocol
   - Parsing messages Photon complets
   - Gestion events/requests/responses
   - Forward/rewrite packets

3. **Week 4**: Integration
   - Extraction Event 593 XorCode
   - Décryptage positions XOR
   - Tests & validation

**Risques**:
- ⚠️ Détection serveur (latency patterns)
- ⚠️ Violation TOS probable
- ⚠️ Complexité technique élevée

**Avantages**:
- ✅ Solution autonome (pas de dépendance externe)
- ✅ Accès complet tous events
- ✅ Possibilité injection/modification (si souhaité)

---

### B) Community Solutions (Dépendant, Court)

**Effort**: 1-2 semaines recherche/intégration

**Options**:
1. **Cryptonite alternative** (si trouvable)
   - Tool de décryptage Photon
   - Setup 2-PC probablement requis

2. **Collaboration pxlbit228/Jonyleeson**
   - Contribuer à reverse engineering
   - Partager findings
   - Utiliser outils existants

**Risques**:
- ⚠️ Dépendance outils tiers
- ⚠️ Disponibilité incertaine
- ⚠️ Détection si tool connu (comme Cryptonite)

**Avantages**:
- ✅ Plus rapide que dev from scratch
- ✅ Communauté support

---

### C) Radar PvE-only (Pragmatique, Immédiat)

**Effort**: 0 jours (déjà fonctionnel)

**Fonctionnalités**:
- ✅ Mobs positions/mouvement (100%)
- ✅ Harvestables detection (100%)
- ✅ Chests detection (100%)
- ✅ Local player tracking (100%)
- ✅ Joueurs spawn notification (noms/guildes)
- ❌ Joueurs positions précises (chiffrées)

**Use Cases**:
- Farming/gathering efficace
- Éviter mobs dangereux
- Trouver resources rares
- Alert spawn joueurs (PvP awareness limitée)

**Avantages**:
- ✅ Fonctionne MAINTENANT
- ✅ Zéro risque détection supplémentaire
- ✅ Aucun dev requis
- ✅ Pas de violation TOS évidente

---

## 🔍 ANALYSE RISQUES DÉTECTION

### MITM Proxy (Option A)

**Ce qu'Albion PEUT détecter**:
- ⚠️ Latency patterns trop stables
- ⚠️ Packet timing anomalies
- ⚠️ Connection fingerprinting (rare UDP)

**Ce qu'Albion NE PEUT PAS détecter**:
- ✅ Modifications mémoire client (aucune)
- ✅ Hooks/DLL injection (aucun)
- ✅ Signature processus (externe)

**Mitigations**:
```javascript
// Ajouter jitter aléatoire
const delay = baseLatency + Math.random() * 5;
setTimeout(() => forwardPacket(), delay);

// Mode read-only strict
if (packet.isModified()) {
    throw new Error('NO MODIFICATION ALLOWED');
}
```

**Évaluation**: **FAIBLE** si read-only + jitter

---

### Radar PvE (Option C)

**Détection**: **AUCUNE** (aucun changement vs actuel)

---

## 💡 RECOMMANDATION

### Scénario 1: **Temps Disponible + Intérêt Technique**
→ **Option A (MITM)** + Fallback Option C

**Planning**:
- Semaines 1-4: Dev MITM
- Si bloqué: Switch Option C (PvE-only)

---

### Scénario 2: **Temps Limité + Besoin Fonctionnel**
→ **Option C (PvE)** maintenant + Explorer Option B (Community)

**Planning**:
- Immédiat: Utiliser radar PvE
- Background: Rechercher Cryptonite alternatives
- Si trouvé: Intégrer community tool

---

### Scénario 3: **Pas de Temps**
→ **Option C (PvE)** uniquement

**Accepter limitation**: Radar PvE = 80% valeur pour 0% effort

---

## 📝 SI CHOIX = OPTION A (MITM)

### Phase 1: Proof of Concept (Week 1)

**Objectif**: Valider faisabilité DH + AES

**Fichier**: `mitm-proxy/poc.js`

```javascript
const dgram = require('dgram');
const crypto = require('crypto');

// 1. Intercepter Operation 0
server.on('message', (msg, rinfo) => {
    if (isOperation0(msg)) {
        const clientPublicKey = extractPublicKey(msg);
        // 2. Calculer shared secret
        const sharedSecret = dh.computeSecret(clientPublicKey);
        const aesKey = crypto.createHash('sha256')
            .update(sharedSecret)
            .digest();

        // 3. Déchiffrer events
        const decrypted = decryptAES256CBC(eventData, aesKey);
        console.log('Event 593 KeySync:', decrypted);
    }
});
```

**Success Criteria**:
- Event 593 déchiffré visible
- XorCode (8 bytes) extrait
- Positions Event 3 décodées

---

### Phase 2: Production MITM (Week 2-3)

**Architecture**:
```
Albion Client (5056)
    ↓
MITM Proxy (localhost:5056)
    ├─ Decrypt AES-256
    ├─ Extract XorCode
    ├─ Decrypt XOR positions
    ├─ Forward to ZQRadar
    └─ Forward to Server (transparent)
        ↓
Albion Server (real)
```

**Fichiers**:
- `mitm-proxy/server.js`: Proxy principal
- `mitm-proxy/crypto.js`: DH + AES
- `mitm-proxy/photon-parser.js`: Protocol parsing
- `mitm-proxy/config.js`: Port, buffers, timeouts

---

### Phase 3: Integration ZQRadar (Week 4)

**Modifications**:
- `app.js`: Accepter events de MITM (port 5057)
- `Protocol16Deserializer.js`: Utiliser XorCode fourni par MITM
- `Utils.js`: Logger source events (direct vs MITM)

---

## 📊 CRITÈRES DE DÉCISION

| Critère | Option A (MITM) | Option B (Community) | Option C (PvE) |
|---------|----------------|---------------------|----------------|
| **Temps dev** | 3-4 semaines | 1-2 semaines | 0 |
| **Risque détection** | Faible | Variable | Aucun |
| **Autonomie** | 100% | Dépendant | 100% |
| **Complexité** | Haute | Moyenne | Nulle |
| **Players positions** | ✅ Oui | ✅ Oui | ❌ Non |
| **Learning value** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐ |

---

## ❓ QUESTION POUR VOUS

**Quel est votre choix?**

A) MITM (long, technique, autonome)
B) Community (moyen, dépendant, incertain)
C) PvE-only (immédiat, limité, stable)

**Facteurs à considérer**:
- Temps disponible pour dev?
- Intérêt technique vs besoin fonctionnel?
- Tolérance risque TOS/détection?

---

**Dernière mise à jour**: 2025-11-25 23:45
**Status**: ⏸️ EN ATTENTE DÉCISION UTILISATEUR