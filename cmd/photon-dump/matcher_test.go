package main

import (
	"testing"

	"github.com/nospy/albion-openradar/internal/photon"
	"github.com/stretchr/testify/require"
)

func TestMatchEvent_CodeOnly(t *testing.T) {
	s := Scenario{
		Name:    "x/y",
		Handler: "x",
		Match:   MatchCriteria{Kind: "event", Code: 27},
	}
	ev := &photon.EventData{Code: 27, Parameters: map[byte]interface{}{0: int64(42)}}
	require.True(t, matchesEvent(s.Match, ev))
	require.False(t, matchesEvent(MatchCriteria{Kind: "event", Code: 99}, ev))
}

func TestMatchEvent_WithPredicate(t *testing.T) {
	m := MatchCriteria{
		Kind: "event",
		Code: 27,
		Where: map[byte]func(v any) bool{
			0: func(v any) bool { return v == int64(42) },
		},
	}
	ok := &photon.EventData{Code: 27, Parameters: map[byte]interface{}{0: int64(42)}}
	ko := &photon.EventData{Code: 27, Parameters: map[byte]interface{}{0: int64(7)}}
	require.True(t, matchesEvent(m, ok))
	require.False(t, matchesEvent(m, ko))
}

func TestMatchRequest_KindMismatch(t *testing.T) {
	m := MatchCriteria{Kind: "event", Code: 22}
	r := &photon.OperationRequest{OperationCode: 22, Parameters: map[byte]interface{}{}}
	require.False(t, matchesRequest(m, r), "event kind must not match request")
}

func TestMatchResponse_CodeMatch(t *testing.T) {
	m := MatchCriteria{Kind: "response", Code: 2}
	r := &photon.OperationResponse{OperationCode: 2, ReturnCode: 0, Parameters: map[byte]interface{}{}}
	require.True(t, matchesResponse(m, r))
	rWrong := &photon.OperationResponse{OperationCode: 41, ReturnCode: 0, Parameters: map[byte]interface{}{}}
	require.False(t, matchesResponse(m, rWrong))
}
