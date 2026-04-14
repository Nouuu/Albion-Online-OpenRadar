package photon

import (
	"encoding/binary"
	"testing"

	"github.com/stretchr/testify/require"
)

func buildReliableEventPacket() []byte {
	return newReliableMessagePacket(msgEvent, []byte{
		0x03,
		0x01,
		0xfc, typeByte, 0x03,
	})
}

func TestPhotonParser_TooShort(t *testing.T) {
	p := NewPhotonParser(nil, nil, nil)
	require.False(t, p.ReceivePacket([]byte{0x01, 0x02, 0x03}))
}

func TestPhotonParser_HeaderOnly_ZeroCommands(t *testing.T) {
	payload := []byte{
		0x00, 0x00,
		0x00,
		0x00,
		0, 0, 0, 0,
		0, 0, 0, 0,
	}
	p := NewPhotonParser(nil, nil, nil)
	require.True(t, p.ReceivePacket(payload))
}

func TestPhotonParser_ReliableEvent_FiresOnEvent(t *testing.T) {
	var got *EventData
	p := NewPhotonParser(func(e *EventData) { got = e }, nil, nil)
	require.True(t, p.ReceivePacket(buildReliableEventPacket()))
	require.NotNil(t, got)
	require.Equal(t, byte(3), got.Code)
	require.Equal(t, byte(3), got.Parameters[252])
}

func buildFragmentedEventPackets(n int) [][]byte {
	reliablePayload := append([]byte{0x00, msgEvent}, 0x03, 0x01, 0xfc, typeByte, 0x03)
	total := len(reliablePayload)
	chunkSize := (total + n - 1) / n

	packets := make([][]byte, 0, n)
	for i := 0; i < n; i++ {
		start := i * chunkSize
		end := start + chunkSize
		if end > total {
			end = total
		}
		chunk := reliablePayload[start:end]

		fragHeader := make([]byte, fragmentHeaderLength)
		binary.BigEndian.PutUint32(fragHeader[0:], 100) // startSeq
		binary.BigEndian.PutUint32(fragHeader[4:], uint32(n))
		binary.BigEndian.PutUint32(fragHeader[8:], uint32(i))
		binary.BigEndian.PutUint32(fragHeader[12:], uint32(total))
		binary.BigEndian.PutUint32(fragHeader[16:], uint32(start))

		packets = append(packets, newSingleCommandPhotonPacket(cmdSendFragment, append(fragHeader, chunk...)))
	}
	return packets
}

func TestPhotonParser_Fragment_SingleChunk(t *testing.T) {
	var got *EventData
	p := NewPhotonParser(func(e *EventData) { got = e }, nil, nil)
	packets := buildFragmentedEventPackets(1)
	require.True(t, p.ReceivePacket(packets[0]))
	require.NotNil(t, got)
	require.Equal(t, byte(3), got.Code)
}

func TestPhotonParser_Fragment_TwoChunks_InOrder(t *testing.T) {
	var got *EventData
	p := NewPhotonParser(func(e *EventData) { got = e }, nil, nil)
	packets := buildFragmentedEventPackets(2)
	require.True(t, p.ReceivePacket(packets[0]))
	require.Nil(t, got)
	require.True(t, p.ReceivePacket(packets[1]))
	require.NotNil(t, got)
	require.Equal(t, byte(3), got.Code)
}

func TestPhotonParser_Fragment_TwoChunks_OutOfOrder(t *testing.T) {
	var got *EventData
	p := NewPhotonParser(func(e *EventData) { got = e }, nil, nil)
	packets := buildFragmentedEventPackets(2)
	require.True(t, p.ReceivePacket(packets[1]))
	require.Nil(t, got)
	require.True(t, p.ReceivePacket(packets[0]))
	require.NotNil(t, got)
}

func TestPhotonParser_Fragment_DuplicateIgnored(t *testing.T) {
	var got *EventData
	p := NewPhotonParser(func(e *EventData) { got = e }, nil, nil)
	packets := buildFragmentedEventPackets(2)

	require.True(t, p.ReceivePacket(packets[0]))
	require.Nil(t, got)
	require.True(t, p.ReceivePacket(packets[0]))
	require.Nil(t, got, "duplicate fragment must not trigger completion")
	require.True(t, p.ReceivePacket(packets[1]))
	require.NotNil(t, got)
	require.Equal(t, byte(3), got.Code)
}

func TestPhotonParser_Fragment_Eviction(t *testing.T) {
	p := NewPhotonParser(nil, nil, nil)
	buildIncompleteFragment := func(startSeq uint32) []byte {
		fragHeader := make([]byte, fragmentHeaderLength)
		binary.BigEndian.PutUint32(fragHeader[0:], startSeq)
		binary.BigEndian.PutUint32(fragHeader[4:], 2)   // fragCount
		binary.BigEndian.PutUint32(fragHeader[8:], 0)   // fragNum
		binary.BigEndian.PutUint32(fragHeader[12:], 10) // totalLen
		binary.BigEndian.PutUint32(fragHeader[16:], 0)  // fragOffset
		return newSingleCommandPhotonPacket(cmdSendFragment,
			append(fragHeader, 0x00, 0x00, 0x00, 0x00, 0x00))
	}
	for i := uint32(0); i < uint32(maxPendingSegments+5); i++ {
		p.ReceivePacket(buildIncompleteFragment(i))
	}
	require.LessOrEqual(t, len(p.pendingSegments), maxPendingSegments)
}

func TestPhotonParser_UnreliableEvent_FiresOnEvent(t *testing.T) {
	// Unreliable wraps a reliable payload with an extra 4-byte prefix.
	eventPayload := []byte{0x03, 0x01, 0xfc, typeByte, 0x03}
	reliable := append([]byte{0x00, msgEvent}, eventPayload...)
	cmdPayload := append([]byte{0, 0, 0, 0}, reliable...)
	pkt := newSingleCommandPhotonPacket(cmdSendUnreliable, cmdPayload)

	var got *EventData
	p := NewPhotonParser(func(e *EventData) { got = e }, nil, nil)
	require.True(t, p.ReceivePacket(pkt))
	require.NotNil(t, got)
	require.Equal(t, byte(3), got.Code)
}

func TestPhotonParser_ReliableEncryptedMsgType_FiresOnEncrypted(t *testing.T) {
	pkt := newReliableMessagePacket(msgEncrypted, []byte{0xde, 0xad, 0xbe, 0xef})
	called := false
	p := NewPhotonParser(nil, nil, nil)
	p.OnEncrypted = func() { called = true }
	require.True(t, p.ReceivePacket(pkt))
	require.True(t, called)
}

func TestPhotonParser_EncryptedFlag(t *testing.T) {
	payload := []byte{
		0x00, 0x00,
		0x01,
		0x00,
		0, 0, 0, 0,
		0, 0, 0, 0,
	}
	called := false
	p := NewPhotonParser(nil, nil, nil)
	p.OnEncrypted = func() { called = true }
	require.False(t, p.ReceivePacket(payload))
	require.True(t, called)
}
