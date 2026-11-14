package main

import (
	"reflect"
	"slices"

	"github.com/nospy/albion-openradar/internal/photon"
)

func matchesEvent(m MatchCriteria, e *photon.EventData) bool {
	if m.Kind != "event" {
		return false
	}
	photon.PostProcessEvent(e)
	if m.Code != -1 && intFromParam(e.Parameters[252]) != m.Code {
		return false
	}
	return matchesWhere(m.Where, e.Parameters)
}

func matchesRequest(m MatchCriteria, r *photon.OperationRequest) bool {
	if m.Kind != "request" {
		return false
	}
	photon.PostProcessRequest(r)
	if m.Code != -1 && intFromParam(r.Parameters[253]) != m.Code {
		return false
	}
	return matchesWhere(m.Where, r.Parameters)
}

func matchesResponse(m MatchCriteria, r *photon.OperationResponse) bool {
	if m.Kind != "response" {
		return false
	}
	photon.PostProcessResponse(r)
	if m.Code != -1 && intFromParam(r.Parameters[253]) != m.Code {
		return false
	}
	return matchesWhere(m.Where, r.Parameters)
}

// matchesWhere is a wildcard when where is empty; otherwise every predicate must hold.
func matchesWhere(where map[byte]func(v any) bool, params map[byte]any) bool {
	for k, pred := range where {
		v, ok := params[k]
		if !ok || !pred(v) {
			return false
		}
	}
	return true
}

func intEq(n int) func(any) bool {
	return func(v any) bool { return intFromParam(v) == n }
}

func intNe(n int) func(any) bool {
	return func(v any) bool { return intFromParam(v) != n }
}

func intIn(ns ...int) func(any) bool {
	return func(v any) bool { return slices.Contains(ns, intFromParam(v)) }
}

// arrayContains matches any slice parameter, byte arrays included, holding n.
func arrayContains(n int) func(any) bool {
	return func(v any) bool {
		rv := reflect.ValueOf(v)
		if rv.Kind() != reflect.Slice {
			return false
		}
		for i := range rv.Len() {
			if intFromParam(rv.Index(i).Interface()) == n {
				return true
			}
		}
		return false
	}
}

func intGt(n int) func(any) bool {
	return func(v any) bool { return intFromParam(v) > n }
}
