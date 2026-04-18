# Photon Protocol18 Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore OpenRadar parsing after the Albion Online 2026-04-13 patch by porting `internal/photon/` from Photon Protocol16 to Protocol18, with full test coverage built from scratch.

**Architecture:** Build the new code in a subpackage `internal/photon/protocol18/` alongside the live v16 code so everything keeps compiling during development. After Phase 1 reaches green tests in isolation, Phase 2 cuts over atomically: delete v16, promote the subpackage, rewire `cmd/radar/main.go` and `internal/server/websocket.go`.

**Tech Stack:** Go 1.26, `stretchr/testify` (new dep), `encoding/binary`, `bytes.Buffer`.

**Spec reference:** `/home/nospy/.claude/plans/recursive-noodling-pike.md` — approved design.

**Upstream reference (source of truth for implementation):** [`ao-data/albiondata-client`](https://github.com/ao-data/albiondata-client) at tag [`0.1.51`](https://github.com/ao-data/albiondata-client/releases/tag/0.1.51), specifically:
- `client/photon/deserializer.go` — 34 type codes, slim customs, compressed varints, typed arrays
- `client/photon/parser.go` — packet header, command dispatch, reliable/unreliable/fragment, encrypted detection

Fetch either file with: `gh api 'repos/ao-data/albiondata-client/contents/client/photon/<file>?ref=0.1.51' --jq '.content' | base64 -d`

**Branch:** `fix/photon-protocol18` off `main`. Stash uncommitted changes on `feat/revival`.

---

## Plan-wide rules

These apply to **every** task. Breaking them means the task is not done, regardless of passing tests.

1. **TDD discipline is not optional.** Each task writes failing tests first, runs them to confirm failure, implements, runs to confirm pass, commits. No skipping.
2. **Minimal implementation.** The implementation must be the smallest change that makes the tests pass. If you're tempted to add validation, helpers, or abstractions beyond what the tests check, stop — YAGNI.
3. **Follow upstream, don't reinvent.** When the task points at an upstream file, use it as the reference. Matching upstream byte-for-byte is acceptable and desirable. Diverging without a written reason in the commit message is not.
4. **Preserve the JSON wire contract.** `ByteArray.MarshalJSON` must emit `{"type":"Buffer","data":[...]}`. Parameter maps must serialize with numeric-string keys (`"252": 3`). If a change risks breaking this, stop and reconsider.
5. **Review gates block progress.** Review checkpoints appear after each major milestone (see below). Do not start the next milestone until the review gate has been cleared and any flagged issues fixed.

### Review gate protocol

At each ⚙️ **Review checkpoint**:

1. Run the verification commands listed in the checkpoint.
2. Invoke `superpowers:simplify` on the files touched in the milestone. Address its findings (delete unused code, fold duplicate logic, remove speculative abstractions). Commit any simplifications as a separate `refactor:` commit.
3. Self-review against the plan-wide rules above — re-read the diff for the milestone with the rules list in hand. Fix violations before moving on.
4. Before the final PR, also run `superpowers:code-reviewer` on the full branch diff.

If `simplify` finds nothing, record that in the checkpoint note — silence is evidence the rules were followed, not evidence that you skipped the gate.

---

## Pre-flight — git state

- [ ] **Step 1: Stash uncommitted work, branch from main**

```bash
cd /home/nospy/Projets/Perso/Albion-Online-OpenRadar
git status
git stash push -u -m "WIP: mise + package.json (pre-protocol18-port)"
git checkout main
git pull --ff-only origin main
git checkout -b fix/photon-protocol18
git stash list
```

Expected: clean working tree on `fix/photon-protocol18`, WIP stash preserved.

- [ ] **Step 2: Baseline build check**

```bash
go build ./...
```

Expected: clean.

---

## Task 1: Add testify dependency

**Files:** `go.mod`, `go.sum`

**Why first:** Every subsequent task writes tests using `require`/`assert`. The dep must be in place before the first test runs.

- [ ] **Step 1: Add and tidy**

```bash
go get github.com/stretchr/testify@latest
go mod tidy
```

- [ ] **Step 2: Verify**

```bash
grep 'stretchr/testify' go.mod
```

Expected: line in the `require` block (not `// indirect`).

- [ ] **Step 3: Commit**

```bash
git add go.mod go.sum
git commit -m "chore(deps): add stretchr/testify for Protocol18 port tests"
```

---

## Task 2: Subpackage skeleton + public types

**Files:**
- Create: `internal/photon/protocol18/types.go`
- Create: `internal/photon/protocol18/types_test.go`

**Contract:** Define exported types for the new deserializer. They live in a **subpackage** during Phase 1 to avoid colliding with the existing `internal/photon.EventData` (which has `int` fields). At cutover the files promote up.

The types must be:

- `EventData{ Code byte; Parameters map[byte]interface{} }`
- `OperationRequest{ OperationCode byte; Parameters map[byte]interface{} }`
- `OperationResponse{ OperationCode byte; ReturnCode int16; DebugMessage string; Parameters map[byte]interface{} }`
- `ByteArray []byte` with a `MarshalJSON` that emits `{"type":"Buffer","data":[...]}` identical to the shape in `internal/photon/types.go:9`.

Use `github.com/segmentio/encoding/json` (already a repo dep) for the marshal.

- [ ] **Step 1: Write the failing test**

Create `internal/photon/protocol18/types_test.go`:

```go
package protocol18

import (
	"testing"

	"github.com/segmentio/encoding/json"
	"github.com/stretchr/testify/require"
)

func TestByteArray_MarshalJSON_BufferShape(t *testing.T) {
	ba := ByteArray{0x01, 0x02, 0xff}
	out, err := json.Marshal(ba)
	require.NoError(t, err)
	require.JSONEq(t, `{"type":"Buffer","data":[1,2,255]}`, string(out))
}

func TestEventData_ZeroValue(t *testing.T) {
	var e EventData
	require.Equal(t, byte(0), e.Code)
	require.Nil(t, e.Parameters)
}

func TestOperationResponse_ZeroValue(t *testing.T) {
	var r OperationResponse
	require.Equal(t, byte(0), r.OperationCode)
	require.Equal(t, int16(0), r.ReturnCode)
	require.Empty(t, r.DebugMessage)
	require.Nil(t, r.Parameters)
}
```

- [ ] **Step 2: Run to verify failure**

```bash
go test ./internal/photon/protocol18/... -v
```

Expected: package does not exist.

- [ ] **Step 3: Implement `types.go`**

Create `internal/photon/protocol18/types.go` with a package doc comment explaining the subpackage rationale, the four types above, and the `MarshalJSON` method. Reuse the existing `ByteArray.MarshalJSON` logic from `internal/photon/types.go:9-19` as the starting point.

- [ ] **Step 4: Run tests**

```bash
go test ./internal/photon/protocol18/... -v
```

Expected: 3 PASS.

- [ ] **Step 5: Commit**

```bash
git add internal/photon/protocol18/
git commit -m "feat(photon): scaffold protocol18 subpackage with public types"
```

---

## Task 3: Low-level readers (varints, zigzag, LE primitives, string)

**Files:**
- Create: `internal/photon/protocol18/readers.go`
- Create: `internal/photon/protocol18/readers_test.go`

**Contract:** Private functions (one package, lowercase names), each operating on a `*bytes.Buffer`:

- `readCompressedUint32` — 7 bits/byte varint, high bit = continue. Truncation or shift ≥35 → return 0, no panic.
- `readCompressedUint64` — same, max shift 70.
- `readCompressedInt32` / `readCompressedInt64` — zigzag over the above: `(v >> 1) ^ -(v & 1)`.
- `readCount` — alias of `readCompressedUint32` for collection length prefixes.
- `readInt16` / `readUint16` / `readFloat32` / `readFloat64` — thin wrappers over `binary.LittleEndian` via `binary.Read`.
- `readString` — `compressed-varint length | UTF-8 bytes`. Empty on length ≤ 0 or length > `buf.Len()`.

**Upstream reference:** same names in `ao-data/albiondata-client@0.1.51:client/photon/deserializer.go`, lines ~260–380. Copy the bodies verbatim; only the package name differs.

- [ ] **Step 1: Write failing tests**

Create `internal/photon/protocol18/readers_test.go`. Cover with table-driven tests:

- `readCompressedUint32`: `0x00→0`, `0x7f→127`, `{0x80,0x01}→128`, `{0xff,0x7f}→16383`, `{0x80,0x80,0x01}→16384`, `{0xff,0xff,0xff,0xff,0x0f}→MaxUint32`.
- Truncated continuation: `{0x80}` must not panic.
- Overflow: 6 continuation bytes must return 0.
- `readCompressedInt32` zigzag: `0x00→0`, `0x02→1`, `0x01→-1`, `0x04→2`, `0x03→-2`, MIN/MAX int32 encodings.
- `readInt16` / `readFloat32` / `readFloat64`: 1 sample each, little-endian encoding of a known value.
- `readString`: `{0x05,'h','e','l','l','o'}→"hello"`, empty, truncated (length > remaining).

- [ ] **Step 2: Run to verify failure**

```bash
go test ./internal/photon/protocol18/... -run TestRead -v
```

- [ ] **Step 3: Implement `readers.go`**

Port from upstream `client/photon/deserializer.go` at version `0.1.51`. Keep function signatures exactly as described in the contract.

- [ ] **Step 4: Run to verify pass**

```bash
go test ./internal/photon/protocol18/... -run TestRead -v
```

- [ ] **Step 5: Commit**

```bash
git add internal/photon/protocol18/readers.go internal/photon/protocol18/readers_test.go
git commit -m "feat(photon): compressed varint + zigzag + LE primitive readers"
```

---

## Task 4: Type code constants

**Files:**
- Create: `internal/photon/protocol18/typecodes.go`
- Create: `internal/photon/protocol18/typecodes_test.go`

**Contract:** Package-private constants naming every Protocol18 type code, matching the list in the spec (`/home/nospy/.claude/plans/recursive-noodling-pike.md` section "Type codes Protocol18"). Plus `MaxArraySize = 65536` as the collection-size guard (same value as current `protocol16.go:11`).

**Upstream reference:** same constants in `ao-data/albiondata-client@0.1.51:client/photon/deserializer.go` lines ~20–60.

- [ ] **Step 1: Write failing test**

A single compile-time sanity test that asserts each constant equals its expected numeric value (guards against copy-paste errors). Cover all 34 Protocol18 type codes + `typeArray = 0x40` + `customTypeSlimBase = 0x80`.

- [ ] **Step 2: Run to verify failure**

- [ ] **Step 3: Implement `typecodes.go`**

Port constants from upstream. Export only `MaxArraySize` (needed by callers in future tasks).

- [ ] **Step 4: Run to verify pass**

- [ ] **Step 5: Commit**

```bash
git add internal/photon/protocol18/typecodes.go internal/photon/protocol18/typecodes_test.go
git commit -m "feat(photon): Protocol18 type code constants + MaxArraySize guard"
```

---

## Task 5: `deserialize` dispatch — primitives + zero values

**Files:**
- Create: `internal/photon/protocol18/deserializer.go`
- Create: `internal/photon/protocol18/deserializer_test.go`

**Contract:** A single package-private entry point `deserialize(buf *bytes.Buffer, tc byte) interface{}` that dispatches by type code. This task implements only the **single-value** branches (types 2–18 + 27–34). Collection decoders (dict, hashtable, object array, typed arrays, custom, nested op types) remain **stubs** returning nil or empty — they will be filled in by later tasks.

Stubs required at minimum (so `deserialize` compiles):
`deserializeCustom`, `deserializeDictionary`, `deserializeHashtable`, `deserializeObjectArray`, `deserializeOperationRequestInner`, `deserializeOperationResponseInner`, `deserializeEventDataInner`, `deserializeNestedArray`, `deserializeTypedArray`.

Also add `isComparable(v interface{}) bool` helper using `reflect.TypeOf(v).Comparable()`, for later dictionary use.

**Upstream reference:** `ao-data/albiondata-client@0.1.51:client/photon/deserializer.go` lines ~65–170 for the switch. Copy the switch body; replace the collection calls with stubs.

- [ ] **Step 1: Write failing tests**

Create `internal/photon/protocol18/deserializer_test.go`. Two table-driven tests:

- `TestDeserialize_Primitives`: one case per primitive type code. For each, supply the minimal payload and assert the returned `interface{}` matches the expected typed value.
- `TestDeserialize_ZeroValues`: one case per zero-value type code (27–34), empty payload.

Example row (for the feel of it):

```go
{"int1 neg", typeInt1Neg, []byte{0x05}, int32(-5)},
```

Cover: `typeNull`, `typeUnknown`, `typeBoolean`, `typeByte`, `typeShort`, `typeFloat`, `typeDouble`, `typeString`, `typeCompressedInt`, `typeCompressedLong`, `typeInt1`/`Neg`, `typeInt2`/`Neg`, `typeLong1`/`Neg`, `typeLong2`/`Neg`, `typeBoolFalse`, `typeBoolTrue`, `typeShortZero`, `typeIntZero`, `typeLongZero`, `typeFloatZero`, `typeDoubleZero`, `typeByteZero`.

- [ ] **Step 2: Run to verify failure**

- [ ] **Step 3: Implement the dispatch**

Port the switch from upstream. Replace every call to a collection decoder with a stub function that returns `nil` / `interface{}(nil)`. The stubs can live at the bottom of `deserializer.go` — they'll be replaced in tasks 6–10.

- [ ] **Step 4: Run to verify pass**

- [ ] **Step 5: Commit**

```bash
git add internal/photon/protocol18/deserializer.go internal/photon/protocol18/deserializer_test.go
git commit -m "feat(photon): deserialize() dispatch for primitives + zero values"
```

---

## Task 6: Custom types (typeCustom + slim 0x80+)

**Files:**
- Modify: `internal/photon/protocol18/deserializer.go`
- Modify: `internal/photon/protocol18/deserializer_test.go`

**Contract:** Replace the `deserializeCustom` stub. Behavior:

- `typeCustom = 19`: wire is `customId byte | compressed-size | data`. Consume the customId (don't store it — OpenRadar doesn't use it).
- Slim custom (`gpType >= 0x80`): wire is `compressed-size | data`. No customId byte.
- Both return `ByteArray(data)`, **not** a map. This is the critical architecture decision from the spec — preserves the JSON Buffer shape for the front-end.
- Truncation (size > remaining) or size > `MaxArraySize` → return `nil`.

**Upstream reference:** `client/photon/deserializer.go` lines ~220–250 — but note upstream returns `map[string]interface{}{"type": customID, "data": data}`. We intentionally diverge: **return `ByteArray` directly**. Record the reason in the commit message.

- [ ] **Step 1: Add failing tests**

In `deserializer_test.go`, add `TestDeserialize_Custom`:
- Regular custom: payload `{42, 0x03, 0x01, 0x02, 0x03}` with `typeCustom` → `ByteArray{0x01, 0x02, 0x03}`.
- Slim custom: payload `{0x02, 0xaa, 0xbb}` with `tc = 0x85` → `ByteArray{0xaa, 0xbb}`.
- Truncated: payload `{42, 0x0a, 0x01, 0x02}` with `typeCustom` → `nil`.

- [ ] **Step 2: Run to verify failure**

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run to verify pass**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(photon): custom + slim custom decode to ByteArray (front-end JSON shape)"
```

---

## Task 7: Collection decoders — object array, nested array, typed arrays

**Files:**
- Modify: `internal/photon/protocol18/deserializer.go`
- Modify: `internal/photon/protocol18/deserializer_test.go`

**Contract:** Replace three stubs at once (they share the same pattern — count prefix + elements).

- `deserializeObjectArray(buf)` — `count | (typeCode | value)*`, returns `[]interface{}`.
- `deserializeNestedArray(buf)` — `count | typeCode | elem*` for bare `0x40`, returns `[]interface{}`.
- `deserializeTypedArray(buf, elemType)` — `count | elem*` for `0x40|elemType`. Returns a typed slice for bool (bit-packed!), byte, short, float, double, string, compressedInt, compressedLong, custom, dictionary, hashtable. Fallback to `[]interface{}` + recursive `deserialize` for anything else.
- All three must enforce `size <= MaxArraySize`, returning `nil` if exceeded.

**Critical subtlety — bit-packed bools:** `[count+7)/8` bytes of bit-packed booleans, bit 0 of byte 0 is element 0.

**Upstream reference:** `client/photon/deserializer.go` lines ~175–275 for `deserializeTypedArray` and ~280–310 for `deserializeNestedArray`/`deserializeObjectArray`.

- [ ] **Step 1: Add failing tests**

Tests to cover:
- Object array: `count=2, (typeByte, 0x01), (typeShort, 0x34, 0x12)` → `[byte(0x01), int16(0x1234)]`.
- Nested array (`typeArray`): `count=3, typeByte, 0x0a, 0x0b, 0x0c` → `[byte(0x0a), byte(0x0b), byte(0x0c)]`.
- Typed array byte: `count=3, 0x0a, 0x0b, 0x0c` → `[]byte{0x0a, 0x0b, 0x0c}`.
- Typed array short: two int16 LE values → `[]int16`.
- Typed array float: one float32 LE = 1.0 → `[]float32{1.0}`.
- Typed array string: two strings with varint lengths.
- **Typed array bool bit-packed, count=10**: bytes `{0x0a, 0xaa, 0x03}` → `[false,true,false,true,false,true,false,true,true,true]`.
- Typed array byte with `count > MaxArraySize` → `nil`.

- [ ] **Step 2: Run to verify failure**

- [ ] **Step 3: Implement all three decoders**

Port from upstream. Do not invent new type cases.

- [ ] **Step 4: Run to verify pass**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(photon): object/nested/typed array decoders incl. bit-packed bools"
```

---

## Task 8: Dictionary + hashtable

**Files:**
- Modify: `internal/photon/protocol18/deserializer.go`
- Modify: `internal/photon/protocol18/deserializer_test.go`

**Contract:** Replace `deserializeDictionary` and `deserializeHashtable` stubs. Wire format: `keyTypeCode | valueTypeCode | compressed-count | (key | value)*`. If either type code is `0`, the element carries its own type byte before the value. `deserializeHashtable` delegates to `deserializeDictionary` (same wire format).

Use `isComparable` to guard against non-hashable keys; fall back to `fmt.Sprintf("UNHASHABLE_%d_%T", i, key)`. Enforce `count <= MaxArraySize`.

**Upstream reference:** `client/photon/deserializer.go` lines ~315–365.

- [ ] **Step 1: Add failing tests**

- Typed dict: `keyTC=typeByte, valTC=typeShort, count=2, (1, 0x1234), (2, 0x5678)` → `map[byte(1)]=int16(0x1234), map[byte(2)]=int16(0x5678)`.
- Dynamic dict (`keyTC=0 valTC=0`): each entry has its own types, one entry `{typeByte: 0x2a, typeString: "hi"}`.
- Hashtable: same shape as dict, confirm it returns the same result.

- [ ] **Step 2–5:** Standard TDD cycle + commit.

```bash
git commit -m "feat(photon): dictionary + hashtable decoders"
```

---

## Task 9: Parameter table + `DeserializeEvent`

**Files:**
- Modify: `internal/photon/protocol18/deserializer.go`
- Modify: `internal/photon/protocol18/deserializer_test.go`

**Contract:** Two package-private helpers plus one exported entry point:

- `readParameterTable(buf *bytes.Buffer) map[byte]interface{}` — wire: `compressed-varint count | (key byte | typeCode byte | value)*`. Stop on `buf.Len() == 0` or read error, returning what was read.
- `deserializeParameterTable(data []byte) map[byte]interface{}` — thin wrapper that wraps the byte slice.
- `DeserializeEvent(data []byte) (*EventData, error)` — reads a single event code byte, then the parameter table. Returns error only on empty input.

Also fill in `deserializeEventDataInner` — nested event returned from the deserialize switch as a generic map `{"code": code, "parameters": params}`.

**Upstream reference:** `parser.go` lines ~60–75 for `readParameterTable`, `deserializer.go` lines ~385–400 for the nested inner.

- [ ] **Step 1: Add failing tests**

- `TestDeserializeParameterTable`: count=2 with two byte entries, verify map contents.
- `TestDeserializeParameterTable_TruncatedMidEntry`: count=2 but payload only has one full entry — should return `{0: byte(0x2a)}`.
- `TestDeserializeEvent_Minimal`: event code=3, parameter table with `{252: byte(3)}`, verify `.Code == 3` and `.Parameters[252] == byte(3)`.

- [ ] **Step 2–5:** Standard cycle + commit.

```bash
git commit -m "feat(photon): parameter table + DeserializeEvent entry point"
```

---

## Task 10: `DeserializeRequest` + `DeserializeResponse`

**Files:**
- Modify: `internal/photon/protocol18/deserializer.go`
- Modify: `internal/photon/protocol18/deserializer_test.go`

**Contract:**

- `DeserializeRequest(data []byte) (*OperationRequest, error)` — opCode byte + parameter table.
- `DeserializeResponse(data []byte) (*OperationResponse, error)` — opCode byte + int16 LE returnCode + optional debug-message slot + parameter table. The debug slot is `tc byte + value`:
  - If `value` is `string` → store in `DebugMessage`.
  - If `value` is `[]string` → Albion market-order special case. Leave `DebugMessage` empty, inject `[]string` into `params[0]` after reading the parameter table.
- Also replace `deserializeOperationRequestInner` / `deserializeOperationResponseInner` stubs so nested op types in a dispatch return generic maps (upstream `deserializer.go` lines ~370–395).

**Upstream reference:** `parser.go` lines ~180–240 for `dispatchResponse` — specifically the `[]string` branch — plus `deserializer.go` lines for the inner nested helpers.

- [ ] **Step 1: Add failing tests**

- `TestDeserializeRequest`: opCode=15, `params[253] = byte(15)`.
- `TestDeserializeResponse_WithStringDebug`: opCode=15, returnCode=0, debug=`"ok"`, empty parameter table.
- `TestDeserializeResponse_WithStringArrayMarket`: opCode=0x15, debug slot is `[]string{"abc"}`, verify `DebugMessage == ""` and `Parameters[0] == []string{"abc"}`.

- [ ] **Step 2–5:** Standard cycle + commit.

```bash
git commit -m "feat(photon): DeserializeRequest/Response incl. market order slot"
```

---

## ⚙️ Review checkpoint A — Deserializer complete

All wire-format decoding is in place. Before touching the packet parser, prove the deserializer stands on its own.

- [ ] **Gate 1: Full subpackage test sweep**

```bash
go test ./internal/photon/protocol18/... -v -count=1
```

Expected: every test PASS. Count the tests; there should be ~30+ at this point.

- [ ] **Gate 2: Vet + build**

```bash
go vet ./internal/photon/protocol18/...
go build ./internal/photon/protocol18/...
```

- [ ] **Gate 3: Run `superpowers:simplify` on the deserializer files**

Target files:
```
internal/photon/protocol18/readers.go
internal/photon/protocol18/typecodes.go
internal/photon/protocol18/deserializer.go
internal/photon/protocol18/types.go
```

Look specifically for: dead code from stubs that never got replaced, helpers defined but only used once (inline them), error paths that can never trigger (delete), duplicate logic between sibling decoders (if any emerged).

- [ ] **Gate 4: Self-review against the plan-wide rules**

Re-read the diff since Task 1 with the five plan-wide rules visible. Any violation = fix before continuing.

- [ ] **Gate 5: Commit the review outcome**

If simplifications were made:
```bash
git commit -m "refactor(photon): simplify deserializer per review checkpoint A"
```
If no simplifications were needed, commit a short note to the plan file instead: add a line to this checkpoint saying "Review A cleared with no findings on <date>".

**Do not start Task 11 until this checkpoint is cleared.**

---

## Task 11: PhotonParser skeleton — header + callbacks

**Files:**
- Create: `internal/photon/protocol18/packet.go`
- Create: `internal/photon/protocol18/packet_test.go`

**Contract:** A `PhotonParser` struct with callbacks:

```go
type PhotonParser struct {
    OnEvent     func(*EventData)
    OnRequest   func(*OperationRequest)
    OnResponse  func(*OperationResponse)
    OnEncrypted func()
    // + private fragment state, exposed in Task 13
}

func NewPhotonParser(onEvent func(*EventData), onRequest func(*OperationRequest), onResponse func(*OperationResponse)) *PhotonParser
func (p *PhotonParser) ReceivePacket(payload []byte) bool
```

`ReceivePacket` parses the 12-byte Photon header:
- Skip peerId (2 bytes).
- Read flags (1 byte). If `flags == 1`, fire `OnEncrypted` (if set) and return false.
- Read commandCount (1 byte).
- Skip timestamp (4) and challenge (4).
- Loop `commandCount` times calling `handleCommand`. Return true if all commands parsed.

`handleCommand(src, offset) (int, bool)` for this task is a **placeholder** that walks past one command without dispatching — just reads the header length and advances. Dispatching is added in Task 12.

Also add constants: `photonHeaderLength=12`, `commandHeaderLength=12`, `fragmentHeaderLength=20`, `MaxPendingSegments=64`, `cmdDisconnect=4`, `cmdSendReliable=6`, `cmdSendUnreliable=7`, `cmdSendFragment=8`, exported `MsgRequest=2`, `MsgResponse=3`, `MsgEvent=4`, private `msgResponseAlt=7`, `msgEncrypted=131`. And `segmentedPackage` struct for later.

**Upstream reference:** `client/photon/parser.go` top of file + `ReceivePacket` + constants.

- [ ] **Step 1: Failing tests**

- Too-short payload (3 bytes) → `ReceivePacket` returns false.
- Header-only packet with `commandCount=0` → returns true.
- Encrypted flag → returns false and `OnEncrypted` callback fires.

- [ ] **Step 2–5:** Standard cycle + commit.

```bash
git commit -m "feat(photon): PhotonParser header parsing + encrypted detection"
```

---

## Task 12: Reliable/unreliable command dispatch

**Files:**
- Modify: `internal/photon/protocol18/packet.go`
- Modify: `internal/photon/protocol18/packet_test.go`

**Contract:** Replace the placeholder `handleCommand`. Behavior:

- Parse 12-byte command header: cmdType | channelId | commandFlags | reserved | cmdLen (BE uint32) | reliableSequenceNumber (skip). Compute payload length = cmdLen − 12.
- Dispatch by cmdType: `cmdDisconnect` → skip; `cmdSendReliable` → call `handleSendReliable`; `cmdSendUnreliable` → skip 4 bytes then `handleSendReliable`; `cmdSendFragment` → call `handleSendFragment` (placeholder in this task); default → skip.
- `handleSendReliable(src, offset, cmdLen)`: skip signal byte, read msgType byte, dispatch:
  - `msgEncrypted` → fire `OnEncrypted`, return.
  - `MsgRequest` → `DeserializeRequest(data)` → call `OnRequest` if set.
  - `MsgResponse` or `msgResponseAlt` → `DeserializeResponse(data)` → call `OnResponse`.
  - `MsgEvent` → `DeserializeEvent(data)` → call `OnEvent`.

Leave `handleSendFragment` as a placeholder that consumes the command length and returns the new offset. Fragment reassembly comes in Task 13.

**Upstream reference:** `client/photon/parser.go` lines ~100–195.

- [ ] **Step 1: Failing test**

Helper `buildReliableEventPacket(t)` that assembles: photon header (commandCount=1) + command header (cmdSendReliable, length) + `{0x00, MsgEvent}` + event payload `{0x03, 0x01, 0xfc, typeByte, 0x03}`. Test asserts `OnEvent` fires with `Code=3` and `Parameters[252]=byte(3)`.

- [ ] **Step 2–5:** Standard cycle + commit.

```bash
git commit -m "feat(photon): reliable command dispatch + event/request/response routing"
```

---

## Task 13: Fragment reassembly

**Files:**
- Modify: `internal/photon/protocol18/packet.go`
- Modify: `internal/photon/protocol18/packet_test.go`

**Contract:** Replace the `handleSendFragment` placeholder. Responsibilities:

- Parse fragment header: `startSeq | fragCount | fragNum | totalLen | fragOffset` (all BE uint32 per upstream) = 20 bytes.
- Lookup or create a `segmentedPackage` in `pendingSegments` keyed by `startSeq`. Include a `createdAt time.Time` for eviction.
- Copy the fragment payload into `seg.payload[fragOffset:fragOffset+fragLen]`, increment `bytesWritten`.
- When `bytesWritten >= totalLength`, delete from map and recursively call `handleSendReliable(seg.payload, 0, len(seg.payload))`.
- **Before inserting a new segment, if `len(pendingSegments) >= MaxPendingSegments`, evict the oldest by `createdAt`.**

Bounds checks: `totalLen` must be non-negative and reasonable (cap at `MaxArraySize * 16`). `fragOffset + fragLen` must not exceed `len(seg.payload)`.

**Upstream reference:** `client/photon/parser.go` lines ~260–310 for the basic fragment handling. Upstream does **not** have the eviction — this is an OpenRadar addition per the plan agent review. Document the eviction logic inline.

- [ ] **Step 1: Failing tests**

- `buildFragmentedEventPacket(t, n)` helper splits the event payload from Task 12 into `n` fragments, each wrapped in its own packet. Covered scenarios:
- Single fragment (n=1): `OnEvent` fires immediately after the one packet.
- Two fragments in order: first packet leaves `OnEvent` un-fired, second packet completes.
- Two fragments out of order (index 1 first, then index 0): completes correctly.
- Eviction test: feed `MaxPendingSegments + 5` distinct-startSeq first-fragment packets, assert `len(p.pendingSegments) <= MaxPendingSegments`.

- [ ] **Step 2–5:** Standard cycle + commit.

```bash
git commit -m "feat(photon): fragment reassembly with bounded pending segments"
```

---

## Task 14: Events post-processing layer

**Files:**
- Create: `internal/photon/protocol18/events.go`
- Create: `internal/photon/protocol18/events_test.go`

**Contract:** Three exported functions + one private helper. Gameplay logic only, no wire format.

```go
func PostProcessEvent(event *EventData)
func PostProcessRequest(req *OperationRequest)
func PostProcessResponse(resp *OperationResponse)
```

Behavior:

- Each applies the defensive `params[252]` / `params[253]` fallback: if absent, set to the event code / operation code. **Do not overwrite** if already present (the game server normally sends these).
- `PostProcessEvent` for `event.Code == 3`: call `extractMovePositions(params)`.
- `extractMovePositions(params)`: read `params[1].(ByteArray)`, verify `len >= 17`, decode two float32 LE at offsets 9 and 13, write to `params[4]` and `params[5]`. No-op on any type assertion failure or short length.

**⚠️ Critical note to document in the code:** the offsets 9/13 are inherited from the v16 implementation (`internal/photon/protocol16.go:380-394`). They **must be re-validated against a live post-patch pcap** before this path is trusted. If the gameplay byte layout changed in the same patch as the wire format, these offsets will be wrong — the tests here only verify the mechanism, not the real offsets.

- [ ] **Step 1: Failing tests**

- Event 3 with a 17-byte `ByteArray` whose offsets 9/13 encode `123.5` and `-456.25` → `params[4] == 123.5`, `params[5] == -456.25` (InDelta 0.001).
- Event 3 with a 3-byte array → no-op (params[4]/[5] absent).
- Event 29 with empty params → `params[252] = 29` after.
- Event 29 with pre-existing `params[252] = 99` → still 99 after.
- Request and Response versions of the 253 fallback.

- [ ] **Step 2–5:** Standard cycle + commit.

```bash
git commit -m "feat(photon): PostProcess*/Move position extraction (offsets need live pcap validation)"
```

---

## Task 15: Upstream fixture oracle (representative subset)

**Files:**
- Create: `internal/photon/protocol18/upstream_fixtures_test.go`

**Context:** Upstream `client/decode_reliable_photon_test.go` is ~2000 lines of real packet fixtures. Many assertions use the `map[string]interface{}{"type":..., "data":...}` custom shape we deliberately replaced with `ByteArray`. We do **not** port the whole file — we pick a representative subset that catches type-code and endianness drift.

**Contract:** Port 10 representative fixtures from upstream `deserializer_test.go` (the smaller file). Choose cases that cover: primitives, zero values, typed arrays of each kind, dictionary variants, nested array, slim custom. Adapt custom-type assertions to `ByteArray`.

- [ ] **Step 1: Fetch upstream test files for reference**

```bash
mkdir -p /tmp/photon-upstream
gh api 'repos/ao-data/albiondata-client/contents/client/photon/deserializer_test.go?ref=0.1.51' \
  --jq '.content' | base64 -d > /tmp/photon-upstream/deserializer_test.go
wc -l /tmp/photon-upstream/deserializer_test.go
```

- [ ] **Step 2: Select 10 fixtures and port them**

Read the upstream file. For each selected test, create a corresponding test in `upstream_fixtures_test.go` with:
- Name `TestUpstream_<OriginalName>`.
- A `// Ported from ao-data/albiondata-client@0.1.51 :: <original-test-name>` comment.
- The **exact same** input byte slice.
- Assertions adapted: `ByteArray(...)` in place of `map[string]interface{}{"type":..., "data":...}`.

Do not pick more than 10 — the goal is cross-check, not exhaustive coverage. The unit tests from tasks 3–10 already cover correctness from the OpenRadar angle.

- [ ] **Step 3: Run**

```bash
go test ./internal/photon/protocol18/... -run TestUpstream -v
```

Expected: all ported fixtures PASS. Any failure is a bug in our port — investigate before committing.

- [ ] **Step 4: Commit**

```bash
git commit -m "test(photon): port representative upstream fixtures as oracle"
```

---

## Task 16: Benchmark baseline

**Files:**
- Create: `internal/photon/protocol18/deserializer_bench_test.go`

**Contract:** One benchmark `BenchmarkDeserializeMoveEvent` that builds a synthetic Event 3 payload (event code + parameter table with a slim custom byte array containing float32 positions at offsets 9/13) and loops `DeserializeEvent` + `PostProcessEvent`.

- [ ] **Step 1: Write the benchmark**

- [ ] **Step 2: Run and record the baseline**

```bash
go test ./internal/photon/protocol18/... -bench=BenchmarkDeserializeMoveEvent -benchmem -run=^$
```

Record the result in the plan file here, as a comment appended to this step:

```
Baseline (recorded <date>): <X> ns/op, <Y> B/op, <Z> allocs/op
Target post-cutover: within 2× of baseline
```

- [ ] **Step 3: Commit**

```bash
git commit -m "bench(photon): baseline BenchmarkDeserializeMoveEvent"
```

---

## ⚙️ Review checkpoint B — Phase 1 complete

The new subpackage is feature-complete in isolation. Before cutover, hard gate on quality.

- [ ] **Gate 1: Full subpackage sweep**

```bash
go test ./internal/photon/protocol18/... -v -count=1
```

- [ ] **Gate 2: Repo still builds (old v16 code intact)**

```bash
go build ./...
go vet ./...
```

- [ ] **Gate 3: Run `superpowers:simplify` on the full subpackage**

```
internal/photon/protocol18/*.go
```

Expected targets for simplification:
- Test helpers duplicated across `*_test.go` files that could be DRYed.
- Any unused private helper from Task 5's stubs that never got called after the stubs were replaced.
- Large byte-slice literals in tests that could share a generator helper (only if it would make the tests clearer, not shorter).
- Pay attention to the boundary between `deserializer.go`, `readers.go`, and `typecodes.go` — if one file has absorbed code that doesn't belong, fix it.

- [ ] **Gate 4: Self-review of the diff `main..HEAD`**

Read the full branch diff. Check every file against the five plan-wide rules. Key questions to answer:
- Is there any implementation code that the tests don't prove is needed? → Delete it.
- Is there any defensive check that would fire only on programmer error (as opposed to malformed wire data)? → Delete it.
- Did we introduce any abstraction (interface, factory, helper) that's used once? → Inline it.
- Is the `ByteArray` vs. `map[string]interface{}` decision still correctly applied everywhere, or did a test copy the upstream shape by accident?

- [ ] **Gate 5: Commit review outcome**

Same pattern as Review A.

**Do not start Task 17 until this checkpoint is cleared.**

---

## Task 17: Cutover — replace `internal/photon/` contents

**Files:**
- Delete: `internal/photon/protocol16.go`, `internal/photon/command.go`, `internal/photon/reader.go`, `internal/photon/packet.go`, `internal/photon/types.go`
- Move: `internal/photon/protocol18/*.go` → `internal/photon/*.go`
- Rewrite package declarations from `package protocol18` → `package photon`

**Why one commit:** The files move atomically. Splitting across commits leaves the package in a non-compiling state. This commit will break `cmd/radar/main.go` and `internal/server/websocket.go`; the next two tasks fix those.

- [ ] **Step 1: Delete legacy files**

```bash
rm internal/photon/protocol16.go \
   internal/photon/command.go \
   internal/photon/reader.go \
   internal/photon/packet.go \
   internal/photon/types.go
```

- [ ] **Step 2: Move files up**

```bash
mv internal/photon/protocol18/*.go internal/photon/
rmdir internal/photon/protocol18
```

- [ ] **Step 3: Rewrite package declarations**

```bash
for f in internal/photon/*.go; do
  sed -i '1s/^package protocol18$/package photon/' "$f"
done
```

- [ ] **Step 4: Update the package doc comment**

Open `internal/photon/types.go` (now at the top level) and rewrite the package doc comment to reflect that this IS the photon package, no longer a subpackage. Remove any phrases like "this subpackage lives alongside".

- [ ] **Step 5: Verify subpackage builds + tests in isolation**

```bash
go build ./internal/photon/...
go test ./internal/photon/... -count=1 -v
```

Expected: all green.

- [ ] **Step 6: Full repo build — expected to FAIL**

```bash
go build ./...
```

Expected: `cmd/radar/main.go` and possibly `internal/server/websocket.go` fail due to old API references. This is the signal that Task 18/19 are required. Do NOT fix them yet.

- [ ] **Step 7: Commit the intentionally-broken cutover**

```bash
git add -A internal/photon/
git commit -m "refactor(photon): replace Protocol16 with Protocol18 in internal/photon/

The following two commits restore cmd/radar and internal/server to build
against the new API. This commit is intentionally kept separate so the
cutover itself is bisectable."
```

---

## Task 18: Update `cmd/radar/main.go`

**Files:**
- Modify: `cmd/radar/main.go`

**Contract:** Replace the old packet/command handling with the new `PhotonParser` callback pattern.

Concretely:

- Add a `photonParser *photon.PhotonParser` field to the `App` struct.
- In the constructor (find where `app.wsHandler` and `app.logger` are assigned), instantiate the parser with three method callbacks: `app.onPhotonEvent`, `app.onPhotonRequest`, `app.onPhotonResponse`. Assign it **after** `wsHandler` and `logger` so the closures capture valid receivers.
- Rewrite `handlePacket(payload []byte)` to call `app.photonParser.ReceivePacket(payload)`. On `false` return, bump `packetsErrors`; on `true`, bump `packetsProcessed`. Delete the old `processCommand` entirely.
- Add three new methods: `onPhotonEvent(*photon.EventData)`, `onPhotonRequest(*photon.OperationRequest)`, `onPhotonResponse(*photon.OperationResponse)`. Each calls the corresponding `photon.PostProcess*` then the corresponding `wsHandler.Broadcast*`. The event callback also calls `app.logger.Debug` with event code + param count (preserve the existing log label `"EVENT_CAPTURE"`).

**Delete** the existing switch on `cmd.MessageType` at `cmd/radar/main.go:335-357` — the PhotonParser now handles dispatch.

- [ ] **Step 1: Read the current handlePacket + processCommand**

```bash
sed -n '300,360p' cmd/radar/main.go
```

- [ ] **Step 2: Apply the refactor**

- [ ] **Step 3: Build**

```bash
go build ./cmd/radar/...
```

Expected: clean. If it fails, the compiler points at the missing wiring.

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor(radar): use PhotonParser callbacks for Protocol18 dispatch"
```

---

## Task 19: Verify `internal/server/websocket.go` + lock JSON wire shape

**Files:**
- Modify (only if required): `internal/server/websocket.go`
- Create: `internal/server/websocket_test.go`

**Contract:** The Broadcast* signatures take `*photon.EventData` etc. After the cutover, `Code` is `byte` instead of `int` and `Parameters` is `map[byte]interface{}`. JSON wire format must remain identical: numeric keys serialized as `"252"`, `"0"`, etc.

**Most likely no production code changes are needed** — the broadcast sites pass values through `map[string]interface{}` which serializes identically for `byte` and `int`. Verify this with a regression test rather than by inspection.

- [ ] **Step 1: Try to build**

```bash
go build ./internal/server/...
```

If clean, the Broadcast* functions are compatible as-is. Skip to Step 3. If it fails, the error points at the fix (most likely a nil check or a type mismatch on `.Code`).

- [ ] **Step 2: Apply any minimal fix**

- [ ] **Step 3: Write a JSON wire regression test**

Create `internal/server/websocket_test.go` with one test that:
- Constructs a `*photon.EventData` with `Code=3` and two parameters (`0: int32(42)`, `252: byte(3)`).
- Builds the exact broadcast payload shape from `BroadcastEvent` (a `map[string]interface{}` with `code` and `parameters`).
- Marshals it via `segmentio/encoding/json`.
- Asserts the output contains `"252":3`, `"0":42`, `"code":3`.

This test locks the wire format. If a future refactor breaks it, this test fails before the front-end does.

- [ ] **Step 4: Run**

```bash
go test ./internal/server/... -v
```

- [ ] **Step 5: Commit**

```bash
git commit -m "test(server): lock JSON wire shape for Protocol18 byte-keyed params"
```

---

## Task 20: Live pcap integration harness (skipped until capture)

**Files:**
- Create: `internal/photon/live_pcap_test.go`

**Contract:** A test that reads pcap files from `internal/photon/testdata/`, extracts UDP payloads, feeds them into a `PhotonParser`, and asserts on the set of decoded events. Two fixtures expected:
- `live_idle_city.pcap` — must produce at least one Event 3 (Move).
- `live_combat.pcap` — must produce at least one Event 6 (HealthUpdate).

If either fixture is missing, the corresponding sub-test calls `t.Skip` with a clear message explaining what to capture. The test harness itself must exist now so that when pcaps arrive, running it is `go test` with no code changes.

**Dependencies:** `google/gopacket/pcapgo` (already transitively available via `google/gopacket` used in `internal/capture`).

- [ ] **Step 1: Write the test with the skip path**

Structure the test with a sub-test per fixture. Each sub-test:
- Stats the fixture file; `t.Skip` if not present.
- Opens via `pcapgo.NewReader`.
- Loops `ReadPacketData`, decodes via `gopacket.NewPacket`, pulls the UDP layer, and feeds `parser.ReceivePacket(udp.Payload)`.
- Increments a `map[byte]int` in `OnEvent`.
- Asserts the fixture's expected event code has at least one occurrence.

- [ ] **Step 2: Run**

```bash
go test ./internal/photon/... -run TestLivePcapReplay -v
```

Expected: both sub-tests SKIPPED with the capture instructions in the skip message.

- [ ] **Step 3: Commit**

```bash
git commit -m "test(photon): add live pcap replay harness (skipped until capture)"
```

---

## Task 21: Repo-wide smoke test

**Files:** none

- [ ] **Step 1: Full build**

```bash
go build ./...
```

- [ ] **Step 2: Full test run**

```bash
go test ./... -count=1
```

- [ ] **Step 3: Vet**

```bash
go vet ./...
```

- [ ] **Step 4: Benchmark regression check**

```bash
go test ./internal/photon/... -bench=BenchmarkDeserializeMoveEvent -benchmem -run=^$
```

Compare against the baseline recorded in Task 16. If slower than 2×, investigate before proceeding.

- [ ] **Step 5: Verify binary packages**

```bash
make build 2>/dev/null || go build -o /tmp/radar-test ./cmd/radar
```

No commit — this is a checkpoint.

---

## Task 22: Manual end-to-end validation + live pcap capture

**Files:**
- Create: `internal/photon/testdata/live_idle_city.pcap` (user-captured)
- Create: `internal/photon/testdata/live_combat.pcap` (user-captured)

This task requires a running Albion Online client and Wireshark. It cannot be automated.

- [ ] **Step 1: Build the radar**

```bash
make build 2>/dev/null || go build -o ./radar ./cmd/radar
```

- [ ] **Step 2: Run against live Albion**

```bash
sudo ./radar
```

Navigate the browser to the radar's web UI (check stdout for the port).

- [ ] **Step 3: Smoke-test each feature**

- [ ] Players appear as they spawn (Event 29 NewCharacter).
- [ ] Mobs and resources appear.
- [ ] Mobs and players move smoothly (Event 3 Move + position extraction). **If positions are wrong but mobs are visible, the offsets 9/13 in `extractMovePositions` are stale** — see the note in Task 14. Capture a pcap and inspect `params[1]` bytes manually to find the new offsets.
- [ ] Health updates visible (Event 6).
- [ ] No parsing error spam in stdout.

- [ ] **Step 4: Capture two live pcaps with Wireshark**

Filter: `udp port 5056`.

1. Sit idle in a city for 30-60s → `internal/photon/testdata/live_idle_city.pcap`.
2. Enter a dungeon or PvP zone for 30-60s → `internal/photon/testdata/live_combat.pcap`.

- [ ] **Step 5: Re-run the previously-skipped integration test**

```bash
go test ./internal/photon/... -run TestLivePcapReplay -v
```

Expected: both sub-tests now PASS.

- [ ] **Step 6: Commit the fixtures**

```bash
git add internal/photon/testdata/*.pcap
git commit -m "test(photon): add live post-patch pcap fixtures for replay test"
```

---

## ⚙️ Review checkpoint C — Final review before PR

- [ ] **Gate 1: Full repo sweep**

```bash
go test ./... -count=1
go vet ./...
go build ./...
```

- [ ] **Gate 2: `superpowers:simplify` on the full branch diff**

Target: every file modified since `main`. Particular attention to `cmd/radar/main.go` and `internal/server/websocket.go` — these changed last and got less review.

- [ ] **Gate 3: `superpowers:code-reviewer` on the branch**

Invoke the code-reviewer agent with the branch name and the original issue (#49) as context. Address any blocking findings; discuss non-blocking ones in the PR description.

- [ ] **Gate 4: Self-review of the full diff**

```bash
git log --oneline main..HEAD
git diff main..HEAD --stat
```

Rules check: every commit green, every file focused, no dead code, no unused abstractions, no commented-out legacy.

- [ ] **Gate 5: Commit review outcomes**

If simplify/code-reviewer found issues, commit the fixes:
```bash
git commit -m "refactor(photon): address final review findings"
```
If nothing found, record it in the PR description.

**Do not open the PR until this checkpoint is cleared.**

---

## Task 23: Open the PR

**Files:** none

- [ ] **Step 1: Push**

```bash
git push -u origin fix/photon-protocol18
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "fix(photon): port wire parser to Protocol18 (closes #49)" \
             --body "$(cat <<'EOF'
## Summary
- Port internal/photon/ from Photon Protocol16 to Protocol18 after the Albion 2026-04-13 game patch
- New subpackage development followed by atomic cutover for bisectability
- Fragment reassembly, encrypted command detection, market-order response slot
- First tests in the repo (testify-based): unit + upstream oracle + post-process golden + websocket JSON shape + live pcap replay

## References
- ao-data/albiondata-client PR #180 — primary upstream port (Go)
- Triky313/AlbionOnline-StatisticsAnalysis v8.7.0 — secondary reference (C#)
- JPCodeCraft/AlbionDataAvalonia Protocol18Deserializer.cs — original C#

## Test plan
- [x] go test ./... — all green
- [x] go vet ./... — clean
- [x] BenchmarkDeserializeMoveEvent within 2× of baseline
- [x] Manual smoke: sudo ./radar → Albion Online → players, mobs, movement, health updates visible
- [x] Live pcap replay (idle city + combat scenarios)
- [x] superpowers:simplify at 3 review checkpoints
- [x] superpowers:code-reviewer at final checkpoint

Closes #49
EOF
)"
```

- [ ] **Step 3: Return the PR URL**

---

## Appendix — File map (post-cutover)

**New (photon package):**
- `internal/photon/types.go`
- `internal/photon/readers.go`
- `internal/photon/typecodes.go`
- `internal/photon/deserializer.go`
- `internal/photon/packet.go`
- `internal/photon/events.go`
- `internal/photon/*_test.go` (unit + upstream + events + bench + pcap)

**Modified:**
- `cmd/radar/main.go`
- `internal/server/websocket.go` (possibly untouched)
- `internal/server/websocket_test.go` (new)
- `go.mod`, `go.sum`

**Deleted:**
- `internal/photon/protocol16.go`
- `internal/photon/command.go`
- `internal/photon/reader.go`
- old `internal/photon/packet.go`

**Not touched:**
- `web/scripts/**` — JSON wire format preserved.
- `internal/capture/pcap.go` — protocol-agnostic.
