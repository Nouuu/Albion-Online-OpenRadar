package main

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestEncodeVarint_SingleByteUnder128(t *testing.T) {
	require.Equal(t, []byte{0x03}, encodeVarint(3))
	require.Equal(t, []byte{0x7f}, encodeVarint(127))
}

func TestEncodeVarint_TwoBytesFrom128(t *testing.T) {
	require.Equal(t, []byte{0x80, 0x01}, encodeVarint(128))
	require.Equal(t, []byte{0xac, 0x02}, encodeVarint(300))
}

func TestScrubPrefixedValues_ReplacesTheLengthPrefixedOccurrenceOnly(t *testing.T) {
	// "sak" appears twice: once as a Photon string (0x03 prefix) and once as
	// three bytes that happen to spell it inside binary noise.
	payload := []byte("\x00\xff\x03sak\x10noise-sak-noise")
	counts := map[string]int{}

	out := scrubPrefixedValues(payload, []string{"sak"}, counts)

	require.Equal(t, []byte("\x00\xff\x03XXX\x10noise-sak-noise"), out)
	require.Equal(t, 1, counts["sak"])
	require.Len(t, out, len(payload))
}

func TestScrubPrefixedValues_KeepsPayloadLength(t *testing.T) {
	payload := []byte("\x0bFarmeurChinois")
	counts := map[string]int{}

	out := scrubPrefixedValues(payload, []string{"FarmeurChinois"}, counts)

	require.Len(t, out, len(payload))
}

func TestScrubPrefixedValues_LeavesUnrelatedPayloadAlone(t *testing.T) {
	payload := []byte("\x05Alice")
	counts := map[string]int{}

	out := scrubPrefixedValues(payload, []string{"Bob"}, counts)

	require.Equal(t, payload, out)
	require.Equal(t, 0, counts["Bob"])
}

func TestScrubPrefixedValues_CountsEveryOccurrence(t *testing.T) {
	payload := []byte("\x03sak---\x03sak")
	counts := map[string]int{}

	scrubPrefixedValues(payload, []string{"sak"}, counts)

	require.Equal(t, 2, counts["sak"])
}

func TestScrubSplitValues_PatchesAValueCutBetweenTwoPackets(t *testing.T) {
	payloads := [][]byte{
		[]byte("tail\x0eFarmeur"),
		[]byte("Chinois head"),
	}
	counts := map[string]int{}

	scrubSplitValues(payloads, []string{"FarmeurChinois"}, counts)

	require.Equal(t, []byte("tail\x0eXXXXXXX"), payloads[0])
	require.Equal(t, []byte("XXXXXXX head"), payloads[1])
	require.Equal(t, 1, counts["FarmeurChinois"])
}

func TestScrubSplitValues_IgnoresAHalfMatchWithoutItsCounterpart(t *testing.T) {
	payloads := [][]byte{
		[]byte("tail Farmeur"),
		[]byte("unrelated"),
	}
	counts := map[string]int{}

	scrubSplitValues(payloads, []string{"FarmeurChinois"}, counts)

	require.Equal(t, []byte("tail Farmeur"), payloads[0])
	require.Equal(t, 0, counts["FarmeurChinois"])
}

func TestScrubSplitValues_LeavesAContiguousValueToTheOtherPass(t *testing.T) {
	payloads := [][]byte{[]byte("\x0eFarmeurChinois"), []byte("x")}
	counts := map[string]int{}

	scrubSplitValues(payloads, []string{"FarmeurChinois"}, counts)

	require.Equal(t, []byte("\x0eFarmeurChinois"), payloads[0])
}

func TestIdentityFields_CoverNicknameGuildAndAllianceOnEvent29(t *testing.T) {
	for _, want := range []fieldRef{
		{kindEvent, 29, 1},
		{kindEvent, 29, 8},
		{kindEvent, 29, 51},
	} {
		require.Contains(t, identityFields, want)
	}
}

func TestIdentityFields_DoNotCoverTheAccessModeField(t *testing.T) {
	require.NotContains(t, identityFields, fieldRef{kindEvent, 210, 5})
}
