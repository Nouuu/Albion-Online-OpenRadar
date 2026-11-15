package main

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/nospy/albion-openradar/internal/photon"
)

func TestMatchEvent_CodeOnly(t *testing.T) {
	s := Scenario{
		Name:    "x/y",
		Handler: "x",
		Match:   MatchCriteria{Kind: "event", Code: 27},
	}
	ev := &photon.EventData{Code: 27, Parameters: map[byte]any{0: int64(42)}}
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
	ok := &photon.EventData{Code: 27, Parameters: map[byte]any{0: int64(42)}}
	ko := &photon.EventData{Code: 27, Parameters: map[byte]any{0: int64(7)}}
	require.True(t, matchesEvent(m, ok))
	require.False(t, matchesEvent(m, ko))
}

func TestMatchRequest_KindMismatch(t *testing.T) {
	m := MatchCriteria{Kind: "event", Code: 22}
	r := &photon.OperationRequest{OperationCode: 22, Parameters: map[byte]any{}}
	require.False(t, matchesRequest(m, r), "event kind must not match request")
}

func TestMatchResponse_CodeMatch(t *testing.T) {
	m := MatchCriteria{Kind: "response", Code: 2}
	r := &photon.OperationResponse{OperationCode: 2, ReturnCode: 0, Parameters: map[byte]any{}}
	require.True(t, matchesResponse(m, r))
	rWrong := &photon.OperationResponse{OperationCode: 41, ReturnCode: 0, Parameters: map[byte]any{}}
	require.False(t, matchesResponse(m, rWrong))
}

func TestMatchEvent_AlbionCodeFromParameters(t *testing.T) {
	m := MatchCriteria{Kind: "event", Code: 29}
	ev := &photon.EventData{Code: 1, Parameters: map[byte]any{252: int64(29)}}
	require.True(t, matchesEvent(m, ev), "wrapped event should match via Parameters[252]")

	other := &photon.EventData{Code: 1, Parameters: map[byte]any{252: int64(40)}}
	require.False(t, matchesEvent(m, other))
}

func TestMatchEvent_WildcardCode(t *testing.T) {
	m := MatchCriteria{Kind: "event", Code: -1}
	ev := &photon.EventData{Code: 1, Parameters: map[byte]any{252: int64(29)}}
	require.True(t, matchesEvent(m, ev))
}

func TestParamPredicates(t *testing.T) {
	require.True(t, intEq(28)(int32(28)))
	require.False(t, intEq(28)(int32(29)))
	require.False(t, intEq(28)("28"))
	require.True(t, intNe(-1)(int64(5)))
	require.False(t, intNe(-1)(int64(-1)))
	require.True(t, intGt(0)(byte(1)))
	require.False(t, intGt(0)(byte(0)))
	require.True(t, intIn(23, 48)(byte(48)))
	require.False(t, intIn(23, 48)(byte(5)))
}

func TestArrayContains(t *testing.T) {
	has28 := arrayContains(28)
	require.True(t, has28(photon.ByteArray{1, 28, 3}))
	require.True(t, has28([]int16{1, 28}))
	require.True(t, has28([]any{int64(1), int64(28)}))
	require.False(t, has28(photon.ByteArray{1, 2}))
	require.False(t, has28(int64(28)), "scalar is not an array")
	require.False(t, has28(nil))
}
