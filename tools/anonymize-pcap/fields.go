package main

import (
	"bytes"

	"github.com/nospy/albion-openradar/internal/photonscan"
)

const (
	kindEvent    = photonscan.KindEvent
	kindRequest  = photonscan.KindRequest
	kindResponse = photonscan.KindResponse
)

type fieldRef struct {
	kind  photonscan.Kind
	code  int
	index byte
}

// Fields observed carrying text a player typed or data identifying a machine
// or an account. Derived by decoding the fixture corpus, one entry per
// (message kind, Albion code, parameter index).
var identityFields = []fieldRef{
	{kindEvent, 29, 1},    // nickname
	{kindEvent, 29, 8},    // guild name
	{kindEvent, 29, 51},   // alliance tag
	{kindEvent, 30, 5},    // nickname
	{kindEvent, 45, 11},   // harvestable owner nickname
	{kindEvent, 45, 12},   // harvestable owner nickname
	{kindEvent, 103, 2},   // local player nickname
	{kindEvent, 103, 15},  // local player nickname
	{kindEvent, 104, 1},   // nickname
	{kindEvent, 210, 6},   // guild name
	{kindEvent, 277, 2},   // nickname
	{kindEvent, 294, 1},   // nickname
	{kindEvent, 329, 1},   // nickname
	{kindEvent, 350, 3},   // nickname
	{kindEvent, 350, 5},   // guild name
	{kindEvent, 350, 6},   // player written text
	{kindResponse, 2, 2},  // local player nickname
	{kindResponse, 2, 58}, // local player nickname
	{kindResponse, 2, 67}, // account and island identifiers
	{kindRequest, 300, 0}, // gpu model
	{kindRequest, 300, 1}, // cpu model
	{kindRequest, 300, 2}, // operating system
}

// collectIdentityValues decodes the whole capture and returns every distinct
// string sitting in an identity field.
func collectIdentityValues(path string) ([]string, error) {
	seen := map[string]struct{}{}
	err := photonscan.Scan(path, func(m photonscan.Message) {
		for _, field := range identityFields {
			if field.kind != m.Kind || field.code != m.Code {
				continue
			}
			for _, v := range photonscan.StringsIn(m.Params[field.index]) {
				seen[v] = struct{}{}
			}
		}
	})
	if err != nil {
		return nil, err
	}

	out := make([]string, 0, len(seen))
	for v := range seen {
		out = append(out, v)
	}
	return out, nil
}

// scrubSplitValues handles a value the Photon layer cut between two packets.
// Both halves must line up, one ending a payload and the other starting the
// next, so a partial byte sequence on its own is never touched.
func scrubSplitValues(payloads [][]byte, values []string, counts map[string]int) {
	for i := 0; i+1 < len(payloads); i++ {
		left, right := payloads[i], payloads[i+1]
		for _, v := range values {
			if len(v) < 2 {
				continue
			}
			for k := len(v) - 1; k >= 1; k-- {
				head, tail := []byte(v[:k]), []byte(v[k:])
				if !bytes.HasSuffix(left, head) || !bytes.HasPrefix(right, tail) {
					continue
				}
				copy(left[len(left)-k:], bytes.Repeat([]byte{scrubByte}, k))
				copy(right[:len(tail)], bytes.Repeat([]byte{scrubByte}, len(tail)))
				counts[v]++
				break
			}
		}
	}
}

func encodeVarint(n int) []byte {
	var out []byte
	v := uint32(n)
	for {
		b := byte(v & 0x7f)
		v >>= 7
		if v != 0 {
			out = append(out, b|0x80)
			continue
		}
		out = append(out, b)
		return out
	}
}

// scrubPrefixedValues replaces each value where it appears as a Photon string,
// that is preceded by its own varint length. The bare byte sequence elsewhere in
// the payload is left alone, which is what makes short names safe to remove.
func scrubPrefixedValues(payload []byte, values []string, counts map[string]int) []byte {
	if len(values) == 0 {
		return payload
	}
	out := append([]byte(nil), payload...)
	for _, v := range values {
		if v == "" {
			continue
		}
		needle := append(encodeVarint(len(v)), v...)
		hits := bytes.Count(out, needle)
		if hits == 0 {
			continue
		}
		counts[v] += hits
		replacement := append(encodeVarint(len(v)), bytes.Repeat([]byte{scrubByte}, len(v))...)
		out = bytes.ReplaceAll(out, needle, replacement)
	}
	return out
}
