package server

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/nospy/albion-openradar/internal/photon"
)

// synthetic
func TestBroadcastEvent_JSONShape(t *testing.T) {
	ws := &WebSocketHandler{}
	ws.BroadcastEvent(&photon.EventData{
		Code: 3,
		Parameters: map[byte]any{
			0:   int32(42),
			252: byte(3),
		},
	})
	out, err := encodeBatch(ws.batchBuffer)
	require.NoError(t, err)
	s := string(out)
	require.Contains(t, s, `"code":3`)
	require.Contains(t, s, `"252":3`)
	require.Contains(t, s, `"0":42`)
}

// synthetic
func TestBroadcastEvent_ByteArray_BufferShape(t *testing.T) {
	ws := &WebSocketHandler{}
	ws.BroadcastEvent(&photon.EventData{
		Code:       3,
		Parameters: map[byte]any{1: photon.ByteArray{0x01, 0x02, 0xff}},
	})
	out, err := encodeBatch(ws.batchBuffer)
	require.NoError(t, err)
	require.Contains(t, string(out), `{"type":"Buffer","data":[1,2,255]}`)
}
