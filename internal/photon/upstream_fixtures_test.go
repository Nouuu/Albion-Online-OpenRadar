package photon

import (
	"testing"

	"github.com/stretchr/testify/require"
)

// Fixtures ported from ao-data/albiondata-client@0.1.51
// client/decode_reliable_photon_test.go, with assertions adapted to
// OpenRadar's typed callback API.

func varintBytes(v uint32) []byte {
	if v < 0x80 {
		return []byte{byte(v)}
	}
	return []byte{byte(v&0x7F | 0x80), byte(v >> 7)}
}

// Ported: TestParser_OperationRequest_compactPath
func TestUpstream_OperationRequest_compactPath(t *testing.T) {
	inner := []byte{0x02} // opCode
	inner = append(inner, varintBytes(2)...)
	inner = append(inner, 253, typeIntZero, 8, typeString, 2, 'h', 'i')

	pkt := newReliableMessagePacket(msgRequest, inner)

	var got *OperationRequest
	parser := NewPhotonParser(nil, func(r *OperationRequest) { got = r }, nil)
	require.True(t, parser.ReceivePacket(pkt))
	require.NotNil(t, got)
	require.Equal(t, int32(0), got.Parameters[253])
	require.Equal(t, "hi", got.Parameters[8])
}

// Ported: TestParser_OperationResponse_returnsReturnCode
func TestUpstream_OperationResponse_returnsReturnCode(t *testing.T) {
	inner := []byte{
		42,         // opCode
		0x05, 0x00, // returnCode LE
		typeNull,
	}
	inner = append(inner, varintBytes(0)...)

	pkt := newReliableMessagePacket(msgResponse, inner)

	var got *OperationResponse
	parser := NewPhotonParser(nil, nil, func(r *OperationResponse) { got = r })
	require.True(t, parser.ReceivePacket(pkt))
	require.NotNil(t, got)
	require.Equal(t, int16(5), got.ReturnCode)
}
