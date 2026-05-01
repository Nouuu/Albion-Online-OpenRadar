# Player positions and the MITM constraint

Why OpenRadar cannot place other players' live positions on the radar without a Photon MITM proxy.

*Last verified against code: 2026-05-01.*

## Problem

Players are detected on spawn (Event 29) along with their nickname, guild, alliance, equipment, and flag. Their **live positions** during play are XOR-encrypted on the wire and unreadable to a passive listener.

## Two layers of encryption

### Layer 1: Photon AES-256-CBC

All Photon traffic on UDP 5056 is AES-encrypted. Algorithm: AES-256-CBC. IV: 16 null bytes. Key: SHA256 of the Diffie-Hellman shared secret. DH prime: Oakley 768-bit. Generator: 22.

### Layer 2: Albion XOR

Player positions in events 29 and 3 carry an additional XOR layer with an 8-byte XorCode:

```
EncryptedPosition XOR XorCode = relative position
```

The XorCode is transmitted via `Event 593 KeySync`, itself wrapped by Photon's AES layer. A passive pcap listener cannot read either of them without first cracking the AES wrapper.

## Why a passive capture cannot recover positions

```
pcap capture
  -> AES-encrypted UDP traffic
    -> Event 593 unreadable
      -> XorCode unknown
        -> positions stay encrypted
```

## What the DEATHEYE project did

DEATHEYE used Cryptonite, a custom Photon MITM proxy. The chain of operations was:

1. Stand a transparent UDP proxy between the client and the Albion server.
2. Intercept the Diffie-Hellman key exchange.
3. Derive the AES session key.
4. Decrypt Event 593 to extract the 8-byte XorCode.
5. Decrypt the XOR-encrypted positions in events 29 and 3.

```csharp
float DecryptFloat(byte[] encrypted, byte[] xorCode) {
    byte[] decrypted = new byte[4];
    for (int i = 0; i < 4; i++) {
        decrypted[i] = (byte)(encrypted[i] ^ xorCode[i]);
    }
    return BitConverter.ToSingle(decrypted, 0);
}
```

Reference: DEATHEYE `Radar/Photon/PhotonParser.cs`, `Protocol/Connect/Messages/KeySyncEvent.cs`, with a Cryptonite dependency.

## Dead ends

### XOR with the packet header

Reading the first 8 bytes of the Photon header as a XOR pad does not recover positions. The XorCode is a dedicated value, not the header.

```javascript
const headerBytes = buffer.slice(1, 9);
const decrypted = coordBytes.map((b, i) => b ^ headerBytes[i]);
// produces garbage
```

### Event 593 captured passively

Event 593 captures from passive listening usually contain other unrelated content (journals, etc.). The KeySync flavour of Event 593 is AES-wrapped and never appears decrypted on the wire. Confirmed in the radar's own pcap corpus.

## Decision

OpenRadar follows the AlbionRadar model: detect spawns and identity, do not attempt position decryption. The reasons are explicit:

1. A Photon MITM proxy needs three to four weeks of focused work (DH interception, AES decryption, XOR plumbing, replay safety).
2. Modifying the game's network path increases detection risk and changes the threat model.
3. The radar's primary use cases are PvE: mobs, harvestables, dungeons, equipment metadata. None of these need MITM.

| Feature | DEATHEYE | OpenRadar |
|---|---|---|
| Player spawn / identity | yes | yes |
| Player live position | yes (MITM) | no |
| Equipment ids | yes | yes |
| Item power lookup | yes (XML) | yes (`itemsDatabase`) |

For the equipment side of the story, see `DEATHEYE_ANALYSIS.md`.

## References

- Photon MITM history: `DEATHEYE_ANALYSIS.md`.
- Discord (Jonyleeson, ex DEATHEYE dev): "The KeySync event itself is encrypted using photons built in encryption. Cryptonite decrypted any photon event/operation response that was encrypted." and "you won't be able to glean any information from listening on the wire, you need to set up a (custom photon) mitm proxy".
- Items database: `web/scripts/data/ItemsDatabase.js`, fed by `web/ao-bin-dumps/items.txt` and friends.
