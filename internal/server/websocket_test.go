package server

import (
	"testing"

	"github.com/segmentio/encoding/json"
	"github.com/stretchr/testify/require"

	"github.com/nospy/albion-openradar/internal/photon"
)

// Locks the JSON wire shape broadcast to the web front-end. The front reads
// params[252]/params[253] as numeric string keys; switching the param map
// type (from int to byte) must not alter this contract.
func TestBroadcastEvent_JSONShape(t *testing.T) {
	event := &photon.EventData{
		Code: 3,
		Parameters: map[byte]interface{}{
			0:   int32(42),
			252: byte(3),
		},
	}
	payload := map[string]interface{}{
		"code":       event.Code,
		"parameters": event.Parameters,
	}
	out, err := json.Marshal(payload)
	require.NoError(t, err)
	s := string(out)
	require.Contains(t, s, `"code":3`)
	require.Contains(t, s, `"252":3`)
	require.Contains(t, s, `"0":42`)
}

func TestBroadcastEvent_ByteArray_BufferShape(t *testing.T) {
	event := &photon.EventData{
		Code: 3,
		Parameters: map[byte]interface{}{
			1: photon.ByteArray{0x01, 0x02, 0xff},
		},
	}
	out, err := json.Marshal(event.Parameters)
	require.NoError(t, err)
	require.Contains(t, string(out), `{"type":"Buffer","data":[1,2,255]}`)
}
