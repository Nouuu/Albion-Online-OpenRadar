package main

import "github.com/nospy/albion-openradar/internal/photon"

func matchesEvent(m MatchCriteria, e *photon.EventData) bool {
	if m.Kind != "event" || int(e.Code) != m.Code {
		return false
	}
	return matchesWhere(m.Where, e.Parameters)
}

func matchesRequest(m MatchCriteria, r *photon.OperationRequest) bool {
	if m.Kind != "request" || int(r.OperationCode) != m.Code {
		return false
	}
	return matchesWhere(m.Where, r.Parameters)
}

func matchesResponse(m MatchCriteria, r *photon.OperationResponse) bool {
	if m.Kind != "response" || int(r.OperationCode) != m.Code {
		return false
	}
	return matchesWhere(m.Where, r.Parameters)
}

// matchesWhere returns true if every predicate in where holds for params.
// A missing key fails the match; a present value whose predicate returns false
// fails the match. An empty where map is a wildcard (returns true).
func matchesWhere(where map[byte]func(v any) bool, params map[byte]interface{}) bool {
	for k, pred := range where {
		v, ok := params[k]
		if !ok || !pred(v) {
			return false
		}
	}
	return true
}
