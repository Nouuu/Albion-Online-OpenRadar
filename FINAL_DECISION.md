# 🎯 DÉCISION FINALE - Albion Radar Player Positions

**Date**: 2025-11-26 00:05

---

## 📊 SITUATION ACTUELLE

### ✅ Fonctionnel
- Mobs detection & movement (70%)
- Resources/Harvestables (70%)
- Chests (100%)
- Local player tracking (100%)
- Players spawn notification (noms/guildes)

### ❌ Non-Fonctionnel
- **Players positions** (chiffrées Photon AES-256 + XOR)

---

## 🚫 OPTIONS ÉLIMINÉES

### ❌ Option B: Community Solutions
**Raison**: Cryptonite (seul tool decrypt) **plus disponible**

**Recherches effectuées**:
- Discord DEATHEYE: Tool retiré
- GitHub: Aucune alternative trouvée
- Radars open-source: Tous obsolètes
- PhotonProtocol: Parsing seulement, pas de decrypt

**Verdict**: IMPASSE TOTALE

---

## ✅ OPTIONS RESTANTES

### Option A: MITM Photon (Développement)

**Effort**: 3-4 semaines

**Architecture**:
```javascript
Albion Client
    ↓ UDP
MITM Proxy (Node.js)
├─ Intercepter Internal Operation 0 (DH key exchange)
├─ Calculer shared secret (Oakley 768-bit prime)
├─ Dériver AES-256 key (SHA256)
├─ Décrypter traffic Photon (AES-256-CBC)
├─ Extraire Event 593 XorCode
├─ Décrypter positions XOR
└─ Forward à ZQRadar
    ↓
Albion Server
```

**Timeline détaillée**:
- **Week 1**: POC - DH + AES decrypt (validatation faisabilité)
- **Week 2**: Photon protocol parsing complet
- **Week 3**: Proxy production (forward, jitter, stability)
- **Week 4**: Integration ZQRadar + tests

**Risques**:
- ⚠️ Détection: **FAIBLE** si read-only + latency jitter
- ⚠️ Complexité: **HAUTE** (crypto + networking)
- ⚠️ Violation TOS: **PROBABLE**

**Avantages**:
- ✅ Solution autonome (pas de dépendance)
- ✅ Accès complet events déchiffrés
- ✅ Learning value élevée
- ✅ Maintenance contrôlée

**Ressources**:
- [PhotonProtocol Swift](https://github.com/Jonyleeson/PhotonProtocol) (référence parsing)
- Discord thread Jonyleeson (specs Photon crypto)
- DEATHEYE source code (référence architecture)

---

### Option C: PvE-only Radar (Accepter Limitation)

**Effort**: 0 jours (déjà prêt)

**Fonctionnalités disponibles**:
- ✅ Mobs positions temps réel
- ✅ Resources (T4-T8, enchanted)
- ✅ Chests (solo/group dungeons)
- ✅ Harvestables nodes
- ✅ Player spawn alerts (noms visibles)

**Fonctionnalités manquantes**:
- ❌ Players positions précises
- ❌ Player movements tracking

**Use cases**:
- Gathering/farming efficiency
- Mob danger awareness
- Resources discovery
- PvP early warning (spawn alerts)

**Risques**:
- ✅ AUCUN (aucun changement vs actuel)

**Avantages**:
- ✅ Disponible MAINTENANT
- ✅ Zéro risque supplémentaire
- ✅ 80% valeur pour 0% effort

---

## 📊 COMPARAISON FINALE

| Critère | Option A (MITM) | Option C (PvE) |
|---------|----------------|----------------|
| **Temps dev** | 3-4 semaines | 0 |
| **Complexité** | ⭐⭐⭐⭐⭐ | ⭐ |
| **Risque détection** | Faible (si read-only) | Aucun |
| **Risque ban** | TOS violation probable | Statut quo |
| **Players positions** | ✅ Oui | ❌ Non |
| **Autonomie** | 100% | 100% |
| **Maintenance** | Vous | Aucune |
| **Learning value** | ⭐⭐⭐⭐⭐ | ⭐ |

---

## 🤔 QUESTIONS DÉCISIONNELLES

### 1. Temps & Motivation

**Q**: Avez-vous 3-4 semaines à consacrer au dev MITM?
- **OUI** → Option A envisageable
- **NON** → Option C recommandée

---

### 2. Intérêt Technique vs Fonctionnel

**Q**: Qu'est-ce qui vous motive le plus?
- **Learning crypto/networking** → Option A
- **Utiliser le radar maintenant** → Option C

---

### 3. Tolérance Risque

**Q**: Acceptez-vous risque violation TOS + détection possible?
- **OUI** (compte test ok) → Option A
- **NON** (compte main) → Option C

---

### 4. Besoin Positions Joueurs

**Q**: Les positions joueurs précises sont-elles critiques?
- **CRITIQUE** (PvP focus) → Option A obligatoire
- **NICE-TO-HAVE** (PvE/gathering) → Option C suffisante

---

## 💡 RECOMMANDATIONS PAR PROFIL

### Profil 1: Developer/Learner
**Intérêt**: Technique + Learning
**Recommandation**: **Option A**
**Raison**: Excellent projet crypto/networking

---

### Profil 2: Casual Player
**Intérêt**: Gathering/PvE efficiency
**Recommandation**: **Option C**
**Raison**: Radar PvE couvre 80% besoins

---

### Profil 3: PvP Hardcore
**Intérêt**: Positions joueurs essentielles
**Recommandation**: **Option A** (obligatoire)
**Raison**: Seule façon obtenir positions

---

### Profil 4: Risk-Averse
**Intérêt**: Éviter ban à tout prix
**Recommandation**: **Option C**
**Raison**: MITM = risque TOS violation

---

## 🎯 PROCHAINE ÉTAPE

**Décision requise**: Option A ou C?

### Si Option A:
→ Confirmer: "Je choisis Option A (MITM)"
→ Je prépare: Plan dev détaillé Phase 1 (POC)
→ On commence: Setup infrastructure crypto

### Si Option C:
→ Confirmer: "J'accepte Option C (PvE-only)"
→ On documente: Features actuelles optimisation
→ On ferme: Tracking positions joueurs (hors scope)

---

**Dernière mise à jour**: 2025-11-26 00:10
**Status**: ⏸️ EN ATTENTE VOTRE DÉCISION
**Question**: Option A (MITM 3-4 weeks) ou C (PvE now)?