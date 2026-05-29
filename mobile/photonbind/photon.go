package photonbind

import (
	"encoding/binary"
	"fmt"
	"github.com/segmentio/encoding/json"
)

// EventCode represents an Albion event type
type EventCode byte

// OperationCode represents an Albion operation type
type OperationCode byte

// PlayerInfo holds player data exposed to mobile
type PlayerInfo struct {
	ID         uint64
	Name       string
	AverageItemPower float64
	KillFame   uint64
	DeathFame  uint64
	TeamID     uint64
	Health     float32
	Position   Position
	IsInCombat bool
}

// Position represents a player's world coordinates
type Position struct {
	X float32
	Y float32
	Z float32
}

// EventData holds deserialized event data
type EventData struct {
	Code       EventCode
	Parameters map[string]interface{}
}

// NewPlayerInfo creates a PlayerInfo with defaults
func NewPlayerInfo() *PlayerInfo {
	return &PlayerInfo{
		Health:     100,
		IsInCombat: false,
	}
}

// MarshalJSON implements json.Marshaler for PlayerInfo
func (p *PlayerInfo) MarshalJSON() ([]byte, error) {
	type PlayerInfoAlias PlayerInfo
	return json.Marshal((*PlayerInfoAlias)(p))
}

// ParsePlayerInfo attempts to extract player info from event parameters
// Returns nil if insufficient data available
func ParsePlayerInfo(params map[string]interface{}) *PlayerInfo {
	p := NewPlayerInfo()

	if v, ok := params["ID"].(float64); ok {
		p.ID = uint64(v)
	} else if v, ok := params["Id"].(float64); ok {
		p.ID = uint64(v)
	}

	if v, ok := params["Name"].(string); ok {
		p.Name = v
	}

	if v, ok := params["AverageItemPower"].(float64); ok {
		p.AverageItemPower = v
	} else if v, ok := params["AvgItemPower"].(float64); ok {
		p.AverageItemPower = v
	}

	if v, ok := params["KillFame"].(float64); ok {
		p.KillFame = uint64(v)
	}

	if v, ok := params["DeathFame"].(float64); ok {
		p.DeathFame = uint64(v)
	}

	if v, ok := params["TeamId"].(float64); ok {
		p.TeamID = uint64(v)
	}

	if v, ok := params["Health"].(float64); ok {
		p.Health = float32(v)
	}

	// Extract position if available
	if posMap, ok := params["Position"].(map[string]interface{}); ok {
		if x, ok := posMap["X"].(float64); ok {
			p.Position.X = float32(x)
		}
		if y, ok := posMap["Y"].(float64); ok {
			p.Position.Y = float32(y)
		}
		if z, ok := posMap["Z"].(float64); ok {
			p.Position.Z = float32(z)
		}
	}

	return p
}

// PhotonParser handles deserialization of Photon packets
type PhotonParser struct {
	onEvent     func(event *EventData)
	onRequest   func(opCode OperationCode, params map[string]interface{})
	onResponse  func(opCode OperationCode, returnCode int16, params map[string]interface{})
}

// NewPhotonParser creates a new parser
func NewPhotonParser() *PhotonParser {
	return &PhotonParser{}
}

// SetEventHandler sets the callback for events
func (p *PhotonParser) SetEventHandler(handler func(event *EventData)) {
	p.onEvent = handler
}

// SetRequestHandler sets the callback for operation requests
func (p *PhotonParser) SetRequestHandler(handler func(opCode OperationCode, params map[string]interface{})) {
	p.onRequest = handler
}

// SetResponseHandler sets the callback for operation responses
func (p *PhotonParser) SetResponseHandler(handler func(opCode OperationCode, returnCode int16, params map[string]interface{})) {
	p.onResponse = handler
}

// ReceivePacket parses a raw UDP payload as a Photon message
// Returns false if parsing fails
func (p *PhotonParser) ReceivePacket(payload []byte) bool {
	if len(payload) < 4 {
		return false
	}

	// Photon uses little-endian
	reader := binary.LittleEndian

	// Read message type (first byte)
	msgType := payload[0]

	switch msgType {
	case 0x01:
		// Event - read event code at offset 3
		if len(payload) < 4 {
			return false
		}
		eventCode := EventCode(payload[3])
		params := p.decodeParameters(payload[4:])
		event := &EventData{
			Code:       eventCode,
			Parameters: params,
		}
		if p.onEvent != nil {
			p.onEvent(event)
		}
		return true

	case 0x02:
		// Operation Request
		if len(payload) < 4 {
			return false
		}
		opCode := OperationCode(payload[1])
		params := p.decodeParameters(payload[4:])
		if p.onRequest != nil {
			p.onRequest(opCode, params)
		}
		return true

	case 0x03:
		// Operation Response
		if len(payload) < 6 {
			return false
		}
		opCode := OperationCode(payload[1])
		returnCode := int16(reader.Uint16(payload[2:4]))
		params := p.decodeParameters(payload[6:])
		if p.onResponse != nil {
			p.onResponse(opCode, returnCode, params)
		}
		return true

	default:
		return false
	}
}

// decodeParameters decodes the parameter map from raw bytes
// This is a simplified version - full implementation would use encoding/json
func (p *PhotonParser) decodeParameters(data []byte) map[string]interface{} {
	params := make(map[string]interface{})

	if len(data) == 0 {
		return params
	}

	// Try to parse as JSON for flexibility
	if err := json.Unmarshal(data, &params); err != nil {
		// Fallback: create a single "raw" parameter with the bytes
		params["raw"] = data
	}

	return params
}

// GetEventName returns a human-readable name for an event code
func GetEventName(code EventCode) string {
	names := map[EventCode]string{
		0x01: "PlayerEnter",
		0x02: "PlayerLeave",
		0x03: "PlayerMove",
		0x04: "PlayerAttack",
		0x05: "PlayerHealth",
		0x06: "PlayerDeath",
		0x07: "LootDrop",
		0x08: "GuildData",
		0x09: "AllianceData",
		0x0A: "MarketData",
	}
	if name, ok := names[code]; ok {
		return name
	}
	return fmt.Sprintf("Event_%d", code)
}

// GetOperationName returns a human-readable name for an operation code
func GetOperationName(code OperationCode) string {
	names := map[OperationCode]string{
		0x01: "Login",
		0x02: "Logout",
		0x03: "Move",
		0x04: "Attack",
		0x05: "UseAbility",
		0x06: "EquipItem",
		0x07: "UnequipItem",
		0x08: "UseItem",
		0x09: "DropItem",
		0x0A: "PickupItem",
	}
	if name, ok := names[code]; ok {
		return name
	}
	return fmt.Sprintf("Op_%d", code)
}