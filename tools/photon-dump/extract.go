package main

import (
	"bytes"
	"fmt"
	"path/filepath"
	"slices"
	"strconv"

	"github.com/nospy/albion-openradar/internal/photon"
)

type hit struct {
	raw     []byte
	message FixtureMessage
}

// collector gathers scenario hits; Limit counts primary hits only.
type collector struct {
	scenarios []Scenario
	hits      map[string][]hit
	counts    map[string]int
	ids       map[string]map[int]bool
}

func newCollector(scenarios []Scenario) *collector {
	return &collector{
		scenarios: scenarios,
		hits:      make(map[string][]hit),
		counts:    make(map[string]int),
		ids:       make(map[string]map[int]bool),
	}
}

func scenarioLimit(s Scenario) int {
	if s.Limit > 0 {
		return s.Limit
	}
	return 1
}

// offer records one decoded message for every scenario it satisfies; match must run before params are read.
func (c *collector) offer(raw []byte, kind string, params map[byte]any, returnCode int16, match func(MatchCriteria) bool) {
	for _, s := range c.scenarios {
		primary := c.counts[s.Name] < scenarioLimit(s) && match(s.Match)
		if !primary && !c.followsHit(s, params, match) {
			continue
		}
		c.hits[s.Name] = append(c.hits[s.Name], hit{
			raw:     bytes.Clone(raw),
			message: FixtureMessage{Kind: kind, Parameters: stringifyParams(params), ReturnCode: returnCode},
		})
		if primary {
			c.counts[s.Name]++
			if len(s.FollowUps) > 0 {
				if c.ids[s.Name] == nil {
					c.ids[s.Name] = make(map[int]bool)
				}
				c.ids[s.Name][intFromParam(params[s.CorrelateBy])] = true
			}
		}
	}
}

func (c *collector) followsHit(s Scenario, params map[byte]any, match func(MatchCriteria) bool) bool {
	if len(c.ids[s.Name]) == 0 || !slices.ContainsFunc(s.FollowUps, match) {
		return false
	}
	v, ok := params[s.CorrelateBy]
	return ok && c.ids[s.Name][intFromParam(v)]
}

// runExtract matches decoded messages against scenarios and writes per-scenario
// pcap + JSON artifacts. Match.Code == -1 is a wildcard for the given kind.
func runExtract(in, outGo, outJS string, scenarios []Scenario) error {
	c := newCollector(scenarios)

	// parser callbacks fire synchronously from ReceivePacket, so a single snapshot suffices.
	var currentRaw []byte

	parser := photon.NewPhotonParser(
		func(e *photon.EventData) {
			c.offer(currentRaw, "event", e.Parameters, 0, func(m MatchCriteria) bool { return matchesEvent(m, e) })
		},
		func(r *photon.OperationRequest) {
			c.offer(currentRaw, "request", r.Parameters, 0, func(m MatchCriteria) bool { return matchesRequest(m, r) })
		},
		func(r *photon.OperationResponse) {
			c.offer(currentRaw, "response", r.Parameters, r.ReturnCode, func(m MatchCriteria) bool { return matchesResponse(m, r) })
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
		hits := c.hits[s.Name]
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

func stringifyParams(params map[byte]any) map[string]any {
	out := make(map[string]any, len(params))
	for k, v := range params {
		out[strconv.Itoa(int(k))] = v
	}
	return out
}
