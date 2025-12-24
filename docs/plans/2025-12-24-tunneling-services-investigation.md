# Tunneling Services Support Investigation

> **Issue:
** [#22 - Feature Request: Support for Tunneling Services](https://github.com/Nouuu/Albion-Online-OpenRadar/issues/22)
> **Date:** 2025-12-24
> **Status:** Investigation Complete

## Executive Summary

Users report that OpenRadar fails to capture game packets when using tunneling services like ExitLag or NoPing.
This document explains why this happens and what (if anything) can be done.

**TL;DR:**

- **ExitLag:** Already works - user just needs to select the virtual TAP adapter
- **NoPing:** Likely unsolvable without major architectural changes

---

## How OpenRadar Captures Packets

OpenRadar uses `libpcap` (via gopacket) to capture network packets at the **network interface level**:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        NORMAL PACKET FLOW                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────────────┐   │
│  │ Albion   │───▶│ Winsock  │───▶│ Network  │───▶│ Albion Servers   │   │
│  │ Client   │    │ (TCP/IP) │    │ Interface│    │ (UDP port 5056)  │   │
│  └──────────┘    └──────────┘    └──────────┘    └──────────────────┘   │
│                                        │                                │
│                                        ▼                                │
│                                  ┌──────────┐                           │
│                                  │  pcap    │                           │
│                                  │ captures │                           │
│                                  │   here   │                           │
│                                  └──────────┘                           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

The BPF filter `udp and (dst port 5056 or src port 5056)` ensures we only capture Albion traffic.

---

## Case 1: ExitLag

### How ExitLag Works

ExitLag creates a **virtual network adapter** (TAP-Windows) and routes game traffic through it:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        EXITLAG PACKET FLOW                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────────────┐   │
│  │ Albion   │───▶│ Winsock  │───▶│ ExitLag  │───▶│ ExitLag Servers  │   │
│  │ Client   │    │ (TCP/IP) │    │ TAP      │    │ (optimized route)│   │
│  └──────────┘    └──────────┘    │ Adapter  │    └────────┬─────────┘   │
│                                  └──────────┘             │             │
│                                        │                  ▼             │
│                                        ▼           ┌──────────────────┐ │
│                                  ┌──────────┐      │ Albion Servers   │ │
│                                  │  pcap    │      │ (UDP port 5056)  │ │
│                                  │ captures │      └──────────────────┘ │
│                                  │   here   │                           │
│                                  └──────────┘                           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Why It Appears Broken

By default, OpenRadar captures on the **physical network interface**.
When ExitLag routes Albion traffic through the TAP adapter, that traffic never reaches the physical interface.

### Solution (Already Works!)

The user simply needs to:

1. Delete `ip.txt` (or start with `-ip` flag)
2. Restart OpenRadar
3. Select the **ExitLag TAP adapter** from the interface list

**No code changes required.**

---

## Case 2: NoPing

### How NoPing Works

NoPing uses **Winsock LSP (Layered Service Provider)** or **socket hooking** to intercept traffic at the **application
layer**, before it reaches the network stack:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        NOPING PACKET FLOW                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────────────┐   │
│  │ Albion   │───▶│ NoPing   │───▶│ Winsock  │───▶│ Network          │   │
│  │ Client   │    │ LSP/Hook │    │ (TCP/IP) │    │ Interface        │   │
│  └──────────┘    └──────────┘    └──────────┘    └────────┬─────────┘   │
│       │               │                                   │             │
│       │               │                                   ▼             │
│       │               │                             ┌─────────────┐     │
│       │               └─────────────────────────────│ NoPing      │     │
│       │                 Intercepts socket calls     │ Servers     │     │
│       │                 Redirects to NoPing proxy   └──────┬──────┘     │
│       │                                                    │            │
│       │                                                    ▼            │
│       │                                            ┌──────────────────┐ │
│       ▼                                            │ Albion Servers   │ │
│  ┌─────────────────────────────────────────┐       │ (UDP port 5056)  │ │
│  │ Original Photon packets (port 5056)     │       └──────────────────┘ │
│  │ are intercepted BEFORE reaching         │                            │
│  │ the network interface.                  │                            │
│  │                                         │                            │
│  │ pcap sees ENCAPSULATED traffic          │                            │
│  │ to NoPing servers, NOT the original     │                            │
│  │ Albion packets.                         │                            │
│  └─────────────────────────────────────────┘                            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Why It's Broken

1. **No visible adapter:** NoPing doesn't create a network adapter that users can select
2. **Traffic encapsulation:** Original UDP packets to port 5056 are wrapped inside NoPing's protocol
3. **Layer mismatch:** pcap operates at Layer 2-3 (network), NoPing intercepts at Layer 7 (application)

### What pcap Actually Sees

When NoPing is active, pcap sees:

- Traffic to/from **NoPing's servers** (not Albion's)
- On a **different port** (NoPing's protocol port)
- With **encapsulated content** (original Photon packets wrapped inside)

The BPF filter `port 5056` will match **nothing** because no traffic on port 5056 ever reaches the network interface.

---

## Potential Solutions for NoPing

### Option 1: Remove Port Filter (Low Effort, Low Success Chance)

**Approach:** Capture ALL UDP traffic, then filter by packet content (Photon protocol signature).

**Pros:**

- Simple code change
- Might work if NoPing doesn't encrypt/modify packets

**Cons:**

- High CPU usage (processing all UDP traffic)
- Won't work if NoPing encapsulates packets
- Won't work if NoPing uses TCP instead of UDP

**Implementation:**

```go
// Instead of:
filter := fmt.Sprintf("udp and (dst port %d or src port %d)", AlbionPort, AlbionPort)

// Try:
filter := "udp"
// Then check packet content for Photon signature
```

**Verdict:** Worth a quick test, but unlikely to work.

---

### Option 2: Winsock Hooking (High Effort, High Complexity)

**Approach:** Hook Winsock functions (`send`, `recv`, `sendto`, `recvfrom`) to intercept packets before NoPing does.

**Pros:**

- Would work regardless of what NoPing does
- Captures original, unmodified packets

**Cons:**

- Requires DLL injection or similar techniques
- Will be flagged by antivirus software
- May conflict with game anti-cheat (EasyAntiCheat)
- Significant development effort
- Windows-only, complex maintenance

**Verdict:** Not realistic for an open-source project.

---

### Option 3: User Workaround (No Development)

**Approach:** Ask NoPing users to exclude Albion Online from NoPing.

**Pros:**

- No development needed
- Immediate solution

**Cons:**

- Defeats the purpose of using NoPing
- May not be possible in NoPing's UI

**Verdict:** Document as known limitation.

---

### Option 4: Multi-Interface Capture (Medium Effort, Unknown Success)

**Approach:** Capture on ALL network interfaces simultaneously using goroutines.

**Pros:**

- Might catch traffic on unexpected interfaces
- Useful for other VPN scenarios

**Cons:**

- Won't help if traffic is encapsulated before reaching ANY interface
- Higher resource usage

**Implementation:**

```go
func captureAllInterfaces(ctx context.Context, handler PacketHandler) error {
devices, _ := pcap.FindAllDevs()
packets := make(chan gopacket.Packet, 100)

for _, device := range devices {
go captureOnDevice(ctx, device.Name, packets)
}

for packet := range packets {
handler(extractPayload(packet))
}
return nil
}
```

**Verdict:** Worth implementing for general robustness, but won't fix NoPing specifically.

---

## Recommended Action Plan

### Immediate (Issue Response)

1. **Close as "won't fix" with explanation** for NoPing
2. **Document ExitLag workaround** (select TAP adapter)

### Optional Future Work

| Task                           | Effort | Impact                                | Priority |
|--------------------------------|--------|---------------------------------------|----------|
| Add multi-interface capture    | Medium | Low for NoPing, useful for other VPNs | Low      |
| Test "no port filter" approach | Low    | Likely none                           | Very Low |
| Document in README             | Low    | Helps users understand limitation     | Medium   |

---

## Investigation Tasks (If Pursuing Further)

If someone wants to investigate NoPing further:

1. **Capture traffic with Wireshark while NoPing is active**
    - What interfaces show traffic?
    - What ports are used?
    - Is Photon protocol visible in any captured packets?

2. **Check if NoPing has an "exclude app" feature**
    - Can users exclude Albion from NoPing routing?

3. **Test the "no port filter" approach**
    - Remove port 5056 filter
    - Check if Photon packets are visible on any port

4. **Monitor NoPing's network behavior**
    - What processes does it create?
    - What drivers does it install?
    - Does it create any hidden adapters?

---

## Conclusion

**ExitLag:** Works today. User education needed (select TAP adapter).

**NoPing:** Fundamental architectural incompatibility. NoPing intercepts traffic at the application layer before it
reaches the network interface where pcap operates. Without invasive techniques (Winsock hooking), this cannot be solved.

**Recommendation:** Document the limitation, suggest users exclude Albion from NoPing if possible, and close the issue
as a known limitation.

---

## References

- [Winsock LSP (Wikipedia)](https://en.wikipedia.org/wiki/Layered_Service_Provider)
- [Windows Filtering Platform](https://en.wikipedia.org/wiki/Windows_Filtering_Platform)
- [NoPing Technology](https://noping.com/en/technology)
- [ExitLag How It Works](https://www.exitlag.com/how-it-works)
- [gopacket Documentation](https://pkg.go.dev/github.com/google/gopacket/pcap)