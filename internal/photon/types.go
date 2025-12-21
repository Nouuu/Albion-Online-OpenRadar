package photon

import "github.com/segmentio/encoding/json"

// ByteArray wraps []byte to serialize like Node.js Buffer
type ByteArray []byte

// MarshalJSON serializes ByteArray as {"type": "Buffer", "data": [1, 2, 3, ...]}
func (b ByteArray) MarshalJSON() ([]byte, error) {
	// Convert to array of numbers (like Node.js Buffer)
	data := make([]int, len(b))
	for i, v := range b {
		data[i] = int(v)
	}
	return json.Marshal(map[string]interface{}{
		"type": "Buffer",
		"data": data,
	})
}

// Protocol16 type codes
const (
	TypeUnknown           = 0
	TypeNull              = 42
	TypeDictionary        = 68  // 'D'
	TypeStringArray       = 97  // 'a'
	TypeByte              = 98  // 'b'
	TypeDouble            = 100 // 'd'
	TypeEventData         = 101 // 'e'
	TypeFloat             = 102 // 'f'
	TypeInteger           = 105 // 'i'
	TypeHashtable         = 104 // 'h'
	TypeShort             = 107 // 'k'
	TypeLong              = 108 // 'l'
	TypeIntegerArray      = 110 // 'n'
	TypeBoolean           = 111 // 'o'
	TypeOperationResponse = 112 // 'p'
	TypeOperationRequest  = 113 // 'q'
	TypeString            = 115 // 's'
	TypeByteArray         = 120 // 'x'
	TypeArray             = 121 // 'y'
	TypeObjectArray       = 122 // 'z'
)

// EventData represents a deserialized Photon event
type EventData struct {
	Code       int
	Parameters map[int]interface{}
}

// OperationRequest represents a deserialized Photon request
type OperationRequest struct {
	OperationCode int
	Parameters    map[int]interface{}
}

// OperationResponse represents a deserialized Photon response
type OperationResponse struct {
	OperationCode int
	ReturnCode    int
	DebugMessage  interface{}
	Parameters    map[int]interface{}
}
