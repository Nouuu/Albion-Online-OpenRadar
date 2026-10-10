package main

import (
	"fmt"
	"path/filepath"

	"github.com/nospy/albion-openradar/internal/photon"
	"github.com/nospy/albion-openradar/internal/photon/operationcodes"
)

type RangeScenario struct {
	Name    string
	Handler string
	Port    uint16
	Keep    []MatchCriteria
	Start   MatchCriteria
	Nth     int
	End     MatchCriteria
	Span    int
	Head    bool
}

func runRange(in, outGo, outJS string, r RangeScenario) error {
	var (
		rawPackets [][]byte
		msgs       []FixtureMessage
		current    []FixtureMessage
		startHits  int
		endHits    int
		joinSeen   bool
		keepHit    bool
		seen       int
		inHead     = r.Head
		inRange    bool
		done       bool
	)

	parser := photon.NewPhotonParser(
		func(e *photon.EventData) {
			photon.PostProcessEvent(e)
			for _, k := range r.Keep {
				if matchesEvent(k, e) {
					keepHit = true
				}
			}
			if !inRange && matchesEvent(r.Start, e) {
				startHits++
			} else if inRange && matchesEvent(r.End, e) {
				endHits++
			}
			current = append(current, FixtureMessage{Kind: "event", Parameters: stringifyParams(e.Parameters)})
		},
		func(q *photon.OperationRequest) {
			photon.PostProcessRequest(q)
			for _, k := range r.Keep {
				if matchesRequest(k, q) {
					keepHit = true
				}
			}
			if !inRange && matchesRequest(r.Start, q) {
				startHits++
			} else if inRange && matchesRequest(r.End, q) {
				endHits++
			}
			current = append(current, FixtureMessage{Kind: "request", Parameters: stringifyParams(q.Parameters)})
		},
		func(p *photon.OperationResponse) {
			photon.PostProcessResponse(p)
			if intFromParam(p.Parameters[253]) == operationcodes.Join {
				joinSeen = true
			}
			for _, k := range r.Keep {
				if matchesResponse(k, p) {
					keepHit = true
				}
			}
			if !inRange && matchesResponse(r.Start, p) {
				startHits++
			} else if inRange && matchesResponse(r.End, p) {
				endHits++
			}
			current = append(current, FixtureMessage{Kind: "response", Parameters: stringifyParams(p.Parameters), ReturnCode: p.ReturnCode})
		},
	)

	err := iteratePcap(in, func(payload []byte, srcPort, dstPort uint16) error {
		if done || (srcPort != r.Port && dstPort != r.Port) {
			return nil
		}
		seen++
		current = nil
		joinSeen = false
		keepHit = false
		wasInRange := inRange
		parser.ReceivePacket(payload)

		if !wasInRange && startHits >= r.Nth {
			if inHead {
				return fmt.Errorf("head: no Join response before start match %d", r.Nth)
			}
			inRange = true
		}
		keep := inRange || inHead || keepHit
		if inHead && joinSeen {
			inHead = false
		}
		if keep {
			rawPackets = append(rawPackets, append([]byte(nil), payload...))
			msgs = append(msgs, current...)
		}
		if wasInRange && endHits >= r.Span {
			done = true
		}
		return nil
	})
	if err != nil {
		return err
	}
	if seen == 0 {
		return fmt.Errorf("no packet on port %d", r.Port)
	}
	if !inRange {
		return fmt.Errorf("start match %d of %d not found", startHits+1, r.Nth)
	}
	if !done {
		return fmt.Errorf("end match %d of %d not found after the start", endHits+1, r.Span)
	}

	leaf := filepath.Base(r.Name)
	if err := writePcapFragment(filepath.Join(outGo, r.Handler, leaf+".pcap"), rawPackets); err != nil {
		return fmt.Errorf("%s: %w", r.Name, err)
	}
	if err := writeJSONFixture(filepath.Join(outJS, r.Handler, leaf+".json"), msgs); err != nil {
		return fmt.Errorf("%s: %w", r.Name, err)
	}
	return nil
}
