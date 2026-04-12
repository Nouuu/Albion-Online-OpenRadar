# Research: Player Position Detection via MITM Proxy

Date: 2025-11-26.
Status: not implemented. AlbionRadar-style approach adopted.
Last verified against code: 2026-04-12.

---

## 🎯 Problem

Players are detected (names, guilds, alliances) via Event 29, but their positions are **encrypted** and unreadable.

## 🔐 Root Cause: Double Encryption

### Level 1: Photon AES-256-CBC
All Photon traffic (UDP) is encrypted with:
- **Algorithm**: AES-256-CBC
- **IV**: 16 null bytes
- **Key**: SHA256(DH_shared_secret)
- **DH Prime**: Oakley 768-bit, Generator: 22

### Level 2: Albion XOR
Player positions (Event 29, Event 3) are encrypted with a **XorCode** (8 bytes):

```text
EncryptedPosition XOR XorCode = RELATIVE Position
```

**The XorCode is transmitted via Event 593 (KeySync)**, itself encrypted by Photon.

## 🚫 Why Simple Capture Fails

```text
Wireshark/pcap → AES-encrypted UDP traffic
    → Event 593 unreadable
        → No access to XorCode
            → Positions impossible to decrypt
```

## ✅ Technical Solution (DEATHEYE)

DEATHEYE used **Cryptonite** (Photon MITM Proxy):

1. Transparent UDP proxy
2. Intercept Diffie-Hellman key exchange
3. Derive AES key
4. Decrypt Event 593 → Extract XorCode
5. Decrypt positions from Event 29/3

### MITM Specifications

```csharp
// Decrypted Event 593:
parameters[0] = XorCode (byte[8])

// Usage:
float DecryptFloat(byte[] encrypted, byte[] xorCode) {
    byte[] decrypted = new byte[4];
    for (int i = 0; i < 4; i++) {
        decrypted[i] = (byte)(encrypted[i] ^ xorCode[i]);
    }
    return BitConverter.ToSingle(decrypted, 0);
}
```

## 📊 Evidence

### Discord (Jonyleeson – ex DEATHEYE dev)

> "The KeySync event itself is encrypted using photons built in encryption, **Cryptonite decrypted any photon event/operation response** that was encrypted."

> "you won't be able to glean any information from listening on the wire, **you need to set up a (custom photon) mitm proxy**"

### DEATHEYE Code

- `Radar/Photon/PhotonParser.cs`: Event 593 handling.
- `Protocol/Connect/Messages/KeySyncEvent.cs`: XorCode extraction.
- Dependency: Cryptonite (MITM proxy).

## ⚠️ Dead Ends Confirmed

### ❌ XOR with Header

```javascript
const headerBytes = buffer.slice(1, 9);  // WRONG
const decrypted = coordBytes.map((b, i) => b ^ headerBytes[i]);
// → GARBAGE (XorCode ≠ header)
```

### ❌ Captured Event 593 (non-KeySync)

Logs show Event 593 with journals, **not KeySync**:

```json
{
  "eventCode": 593,
  "parameters": {
    "0": 0,              // INT, not byte[8]
    "1": ["JOURNAL_..."] // Journals, not XorCode
  }
}
```

The real KeySync is AES-encrypted → invisible without MITM.

## 🔄 Decision: AlbionRadar-Style Approach

### Current Implementation

- ✅ Detect player spawn/despawn (Event 29)
- ✅ Display names/guilds/alliances
- ✅ Detect equipment (IDs)
- ❌ Player positions (encrypted)

### Comparison

| Feature            | DEATHEYE | AlbionRadar | Our Radar |
|--------------------|----------|------------|-----------|
| Player spawn       | ✅        | ✅          | ✅         |
| Positions          | ✅ MITM   | ❌          | ❌         |
| Equipment          | ✅        | ✅          | ✅ (IDs)   |
| Item Power         | ✅ XML    | ✅ items.txt| 🟥 Phase 3 |

### Justification

1. **MITM Proxy = 3–4 weeks dev** (DH interception, AES decrypt, XOR logic).
2. **Detection risk**: Modifying game network traffic.
3. **Focus**: PvE features (mobs, resources, equipment stats) instead of MITM.

## 📁 Phase 3: Player Equipment & Item Power

**Reference**: `./DEATHEYE_ANALYSIS.md`

Instead of positions, focus on:

1. Parsing `items.xml` → item database (ID → item power).
2. Player equipment lookup (Event 29 `parameters[17]`).
3. Compute real average item power (700–1400 range typical).
4. Display detailed equipment stats.

## 🔗 References

- **DEATHEYE Source**: `work/data/albion-radar-deatheye-2pc/`
- **AlbionRadar**: Approach without positions (spawn/despawn only).
- **Photon Encryption**: Discord thread + Cryptonite dependency.
- **items.xml**: `work/data/ao-bin-dumps-master/items.xml`

---

**Conclusion**: Player positions require a Photon MITM (out of scope for OpenRadar).  
Phase 3 focus: Equipment stats with XML database.
