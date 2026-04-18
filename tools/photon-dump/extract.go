package main

import (
	"fmt"
	"path/filepath"

	"github.com/nospy/albion-openradar/internal/photon"
)

// runExtract matches decoded messages against scenarios and writes per-scenario
// pcap + JSON artifacts. Match.Code == -1 is a wildcard for the given kind.
func runExtract(in, outGo, outJS string, scenarios []Scenario) error {
	type hit struct {
		raw     []byte
		message FixtureMessage
	}

	captured := make(map[string][]hit)
	counts := make(map[string]int)

	limitFor := func(s Scenario) int {
		if s.Limit > 0 {
			return s.Limit
		}
		return 1
	}

	// parser callbacks fire synchronously from ReceivePacket, so a single snapshot suffices.
	var currentRaw []byte

	parser := photon.NewPhotonParser(
		func(e *photon.EventData) {
			for _, s := range scenarios {
				if s.Match.Kind != "event" {
					continue
				}
				if s.Match.Code != -1 && int(e.Code) != s.Match.Code {
					continue
				}
				if !matchesWhere(s.Match.Where, e.Parameters) {
					continue
				}
				if counts[s.Name] >= limitFor(s) {
					continue
				}
				captured[s.Name] = append(captured[s.Name], hit{
					raw:     append([]byte(nil), currentRaw...),
					message: FixtureMessage{Kind: "event", Parameters: stringifyParams(e.Parameters)},
				})
				counts[s.Name]++
			}
		},
		func(r *photon.OperationRequest) {
			for _, s := range scenarios {
				if s.Match.Kind != "request" {
					continue
				}
				if s.Match.Code != -1 && int(r.OperationCode) != s.Match.Code {
					continue
				}
				if !matchesWhere(s.Match.Where, r.Parameters) {
					continue
				}
				if counts[s.Name] >= limitFor(s) {
					continue
				}
				captured[s.Name] = append(captured[s.Name], hit{
					raw:     append([]byte(nil), currentRaw...),
					message: FixtureMessage{Kind: "request", Parameters: stringifyParams(r.Parameters)},
				})
				counts[s.Name]++
			}
		},
		func(r *photon.OperationResponse) {
			for _, s := range scenarios {
				if s.Match.Kind != "response" {
					continue
				}
				if s.Match.Code != -1 && int(r.OperationCode) != s.Match.Code {
					continue
				}
				if !matchesWhere(s.Match.Where, r.Parameters) {
					continue
				}
				if counts[s.Name] >= limitFor(s) {
					continue
				}
				captured[s.Name] = append(captured[s.Name], hit{
					raw:     append([]byte(nil), currentRaw...),
					message: FixtureMessage{Kind: "response", Parameters: stringifyParams(r.Parameters), ReturnCode: r.ReturnCode},
				})
				counts[s.Name]++
			}
		},
	)

	if err := iteratePcap(in, func(payload []byte) error {
		currentRaw = payload
		parser.ReceivePacket(payload)
		return nil
	}); err != nil {
		return err
	}

	for _, s := range scenarios {
		hits := captured[s.Name]
		if len(hits) == 0 {
			continue
		}
		leaf := filepath.Base(s.Name)
		pcapPath := filepath.Join(outGo, s.Handler, leaf+".pcap")
		jsonPath := filepath.Join(outJS, s.Handler, leaf+".json")

		rawPackets := make([][]byte, len(hits))
		msgs := make([]FixtureMessage, len(hits))
		for i, h := range hits {
			rawPackets[i] = h.raw
			msgs[i] = h.message
		}
		if err := writePcapFragment(pcapPath, rawPackets); err != nil {
			return fmt.Errorf("%s: %w", s.Name, err)
		}
		if err := writeJSONFixture(jsonPath, msgs); err != nil {
			return fmt.Errorf("%s: %w", s.Name, err)
		}
	}

	return nil
}

func stringifyParams(params map[byte]interface{}) map[string]any {
	out := make(map[string]any, len(params))
	for k, v := range params {
		out[fmt.Sprintf("%d", k)] = v
	}
	return out
}
