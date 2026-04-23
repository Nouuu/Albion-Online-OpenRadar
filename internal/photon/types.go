package photon

import (
	"fmt"
	"strconv"

	"github.com/segmentio/encoding/json"
)

// Hashtable mirrors Photon Protocol18's hashtable and dictionary types.
// Go's json encoder cannot marshal map[interface{}]interface{}; custom
// MarshalJSON stringifies every key so the JSON output is a plain
// object. Without this, the entire WebSocket batch is dropped whenever
// a response contains a hashtable parameter (e.g. Join op=2 Parameters[103]).
type Hashtable map[interface{}]interface{}

func (h Hashtable) MarshalJSON() ([]byte, error) {
	out := make(map[string]interface{}, len(h))
	for k, v := range h {
		out[fmt.Sprintf("%v", k)] = v
	}
	return json.Marshal(out)
}

// ByteArray serializes as {"type":"Buffer","data":[...]} because the web
// front-end parses byte arrays assuming the Node.js Buffer shape.
type ByteArray []byte

func (b ByteArray) MarshalJSON() ([]byte, error) {
	const prefix = `{"type":"Buffer","data":[`
	const suffix = `]}`
	out := make([]byte, 0, len(prefix)+len(suffix)+4*len(b))
	out = append(out, prefix...)
	for i, v := range b {
		if i > 0 {
			out = append(out, ',')
		}
		out = strconv.AppendUint(out, uint64(v), 10)
	}
	out = append(out, suffix...)
	return out, nil
}

type EventData struct {
	Code       byte
	Parameters map[byte]interface{}
}

type OperationRequest struct {
	OperationCode byte
	Parameters    map[byte]interface{}
}

type OperationResponse struct {
	OperationCode byte
	ReturnCode    int16
	DebugMessage  string
	Parameters    map[byte]interface{}
}
