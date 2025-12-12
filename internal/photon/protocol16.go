package photon

import (
	"encoding/binary"
	"fmt"
	"math"
)

// Protocol16 deserializer for Photon protocol
type Protocol16 struct{}

// NewProtocol16 creates a new Protocol16 deserializer
func NewProtocol16() *Protocol16 {
	return &Protocol16{}
}

// Deserialize deserializes a value based on type code
func (p *Protocol16) Deserialize(reader *Reader, typeCode byte) (interface{}, error) {
	switch typeCode {
	case TypeUnknown, TypeNull:
		return nil, nil

	case TypeByte:
		return p.DeserializeByte(reader)

	case TypeBoolean:
		return p.DeserializeBoolean(reader)

	case TypeShort:
		return p.DeserializeShort(reader)

	case TypeInteger:
		return p.DeserializeInteger(reader)

	case TypeIntegerArray:
		return p.DeserializeIntegerArray(reader)

	case TypeDouble:
		return p.DeserializeDouble(reader)

	case TypeLong:
		return p.DeserializeLong(reader)

	case TypeFloat:
		return p.DeserializeFloat(reader)

	case TypeString:
		return p.DeserializeString(reader)

	case TypeStringArray:
		return p.DeserializeStringArray(reader)

	case TypeByteArray:
		return p.DeserializeByteArray(reader)

	case TypeEventData:
		return p.DeserializeEventData(reader)

	case TypeDictionary:
		return p.DeserializeDictionary(reader)

	case TypeArray:
		return p.DeserializeArray(reader)

	case TypeOperationResponse:
		return p.DeserializeOperationResponse(reader)

	case TypeOperationRequest:
		return p.DeserializeOperationRequest(reader)

	case TypeHashtable:
		return p.DeserializeHashtable(reader)

	case TypeObjectArray:
		return p.DeserializeObjectArray(reader)

	default:
		return nil, fmt.Errorf("type code %d not implemented", typeCode)
	}
}

// DeserializeByte reads a single byte
func (p *Protocol16) DeserializeByte(reader *Reader) (byte, error) {
	return reader.ReadUint8()
}

// DeserializeBoolean reads a boolean
func (p *Protocol16) DeserializeBoolean(reader *Reader) (bool, error) {
	b, err := reader.ReadUint8()
	return b != 0, err
}

// DeserializeShort reads a 16-bit unsigned integer
func (p *Protocol16) DeserializeShort(reader *Reader) (uint16, error) {
	return reader.ReadUint16BE()
}

// DeserializeInteger reads a 32-bit unsigned integer
func (p *Protocol16) DeserializeInteger(reader *Reader) (uint32, error) {
	return reader.ReadUint32BE()
}

// DeserializeIntegerArray reads an array of 32-bit integers
func (p *Protocol16) DeserializeIntegerArray(reader *Reader) ([]uint32, error) {
	size, err := p.DeserializeInteger(reader)
	if err != nil {
		return nil, err
	}

	result := make([]uint32, size)
	for i := uint32(0); i < size; i++ {
		val, err := p.DeserializeInteger(reader)
		if err != nil {
			return nil, err
		}
		result[i] = val
	}
	return result, nil
}

// DeserializeDouble reads a 64-bit float
func (p *Protocol16) DeserializeDouble(reader *Reader) (float64, error) {
	return reader.ReadFloat64BE()
}

// DeserializeLong reads a 64-bit signed integer
func (p *Protocol16) DeserializeLong(reader *Reader) (int64, error) {
	return reader.ReadInt64BE()
}

// DeserializeFloat reads a 32-bit float
func (p *Protocol16) DeserializeFloat(reader *Reader) (float32, error) {
	return reader.ReadFloat32BE()
}

// DeserializeString reads a UTF-8 string
func (p *Protocol16) DeserializeString(reader *Reader) (string, error) {
	size, err := p.DeserializeShort(reader)
	if err != nil {
		return "", err
	}

	if size == 0 {
		return "", nil
	}

	data, err := reader.ReadBytes(int(size))
	if err != nil {
		return "", err
	}

	return string(data), nil
}

// DeserializeByteArray reads a byte array
func (p *Protocol16) DeserializeByteArray(reader *Reader) (ByteArray, error) {
	size, err := reader.ReadUint32BE()
	if err != nil {
		return nil, err
	}

	data, err := reader.ReadBytes(int(size))
	if err != nil {
		return nil, err
	}
	return ByteArray(data), nil
}

// DeserializeArray reads a typed array
func (p *Protocol16) DeserializeArray(reader *Reader) ([]interface{}, error) {
	size, err := p.DeserializeShort(reader)
	if err != nil {
		return nil, err
	}

	typeCode, err := p.DeserializeByte(reader)
	if err != nil {
		return nil, err
	}

	result := make([]interface{}, size)
	for i := uint16(0); i < size; i++ {
		val, err := p.Deserialize(reader, typeCode)
		if err != nil {
			return nil, err
		}
		result[i] = val
	}
	return result, nil
}

// DeserializeStringArray reads an array of strings
func (p *Protocol16) DeserializeStringArray(reader *Reader) ([]string, error) {
	size, err := p.DeserializeShort(reader)
	if err != nil {
		return nil, err
	}

	result := make([]string, size)
	for i := uint16(0); i < size; i++ {
		val, err := p.DeserializeString(reader)
		if err != nil {
			return nil, err
		}
		result[i] = val
	}
	return result, nil
}

// DeserializeObjectArray reads an array of mixed-type objects
func (p *Protocol16) DeserializeObjectArray(reader *Reader) ([]interface{}, error) {
	size, err := p.DeserializeShort(reader)
	if err != nil {
		return nil, err
	}

	result := make([]interface{}, size)
	for i := uint16(0); i < size; i++ {
		typeCode, err := p.DeserializeByte(reader)
		if err != nil {
			return nil, err
		}
		val, err := p.Deserialize(reader, typeCode)
		if err != nil {
			return nil, err
		}
		result[i] = val
	}
	return result, nil
}

// DeserializeHashtable reads a hashtable
func (p *Protocol16) DeserializeHashtable(reader *Reader) (map[interface{}]interface{}, error) {
	size, err := p.DeserializeShort(reader)
	if err != nil {
		return nil, err
	}

	return p.deserializeDictionaryElements(reader, int(size), 0, 0)
}

// DeserializeDictionary reads a typed dictionary
func (p *Protocol16) DeserializeDictionary(reader *Reader) (map[interface{}]interface{}, error) {
	keyTypeCode, err := p.DeserializeByte(reader)
	if err != nil {
		return nil, err
	}

	valueTypeCode, err := p.DeserializeByte(reader)
	if err != nil {
		return nil, err
	}

	size, err := p.DeserializeShort(reader)
	if err != nil {
		return nil, err
	}

	return p.deserializeDictionaryElements(reader, int(size), keyTypeCode, valueTypeCode)
}

// deserializeDictionaryElements reads dictionary key-value pairs
func (p *Protocol16) deserializeDictionaryElements(reader *Reader, size int, keyTypeCode, valueTypeCode byte) (map[interface{}]interface{}, error) {
	result := make(map[interface{}]interface{})

	for i := 0; i < size; i++ {
		// Read key
		ktc := keyTypeCode
		if ktc == 0 || ktc == TypeNull {
			var err error
			ktc, err = p.DeserializeByte(reader)
			if err != nil {
				return nil, err
			}
		}
		key, err := p.Deserialize(reader, ktc)
		if err != nil {
			return nil, err
		}

		// Read value
		vtc := valueTypeCode
		if vtc == 0 || vtc == TypeNull {
			var err error
			vtc, err = p.DeserializeByte(reader)
			if err != nil {
				return nil, err
			}
		}
		value, err := p.Deserialize(reader, vtc)
		if err != nil {
			return nil, err
		}

		result[key] = value
	}

	return result, nil
}

// DeserializeOperationRequest reads an operation request
func (p *Protocol16) DeserializeOperationRequest(reader *Reader) (*OperationRequest, error) {
	opCode, err := p.DeserializeByte(reader)
	if err != nil {
		return nil, err
	}

	params, err := p.DeserializeParameterTable(reader)
	if err != nil {
		return nil, err
	}

	return &OperationRequest{
		OperationCode: int(opCode),
		Parameters:    params,
	}, nil
}

// DeserializeOperationResponse reads an operation response
func (p *Protocol16) DeserializeOperationResponse(reader *Reader) (*OperationResponse, error) {
	opCode, err := p.DeserializeByte(reader)
	if err != nil {
		return nil, err
	}

	returnCode, err := p.DeserializeShort(reader)
	if err != nil {
		return nil, err
	}

	// Debug message has its type code inline
	debugMsgTypeCode, err := p.DeserializeByte(reader)
	if err != nil {
		return nil, err
	}
	debugMessage, err := p.Deserialize(reader, debugMsgTypeCode)
	if err != nil {
		return nil, err
	}

	params, err := p.DeserializeParameterTable(reader)
	if err != nil {
		return nil, err
	}

	return &OperationResponse{
		OperationCode: int(opCode),
		ReturnCode:    int(returnCode),
		DebugMessage:  debugMessage,
		Parameters:    params,
	}, nil
}

// DeserializeEventData reads event data
func (p *Protocol16) DeserializeEventData(reader *Reader) (*EventData, error) {
	code, err := p.DeserializeByte(reader)
	if err != nil {
		return nil, err
	}

	params, err := p.DeserializeParameterTable(reader)
	if err != nil {
		return nil, err
	}

	// Event 3 (Move) - Decode positions for mobs/resources
	// CRITICAL: Positions are in Little-Endian!
	if code == 3 {
		if bytes, ok := params[1].(ByteArray); ok && len(bytes) >= 17 {
			// Read float32 at offset 9 (Little-Endian)
			pos0bits := binary.LittleEndian.Uint32(bytes[9:13])
			pos0 := math.Float32frombits(pos0bits)

			// Read float32 at offset 13 (Little-Endian)
			pos1bits := binary.LittleEndian.Uint32(bytes[13:17])
			pos1 := math.Float32frombits(pos1bits)

			params[4] = pos0
			params[5] = pos1
			params[252] = byte(3)
		}
	}

	return &EventData{
		Code:       int(code),
		Parameters: params,
	}, nil
}

// DeserializeParameterTable reads a parameter table
// Format: short tableSize, then for each entry: byte key, byte typeCode, value
func (p *Protocol16) DeserializeParameterTable(reader *Reader) (map[int]interface{}, error) {
	// Read tableSize (2 bytes)
	size, err := reader.ReadUint16BE()
	if err != nil {
		return nil, err
	}

	result := make(map[int]interface{})

	for i := 0; i < int(size); i++ {
		// Read key (1 byte)
		key, err := reader.ReadUint8()
		if err != nil {
			return nil, err
		}

		// Read value type code (1 byte)
		typeCode, err := reader.ReadUint8()
		if err != nil {
			return nil, err
		}

		// Deserialize value
		value, err := p.Deserialize(reader, typeCode)
		if err != nil {
			return nil, err
		}

		result[int(key)] = value
	}

	return result, nil
}

// Global deserializer instance
var defaultProtocol16 = NewProtocol16()

// DeserializeEvent deserializes an event from a command payload
func DeserializeEvent(payload *Reader) (*EventData, error) {
	return defaultProtocol16.DeserializeEventData(payload)
}

// DeserializeRequest deserializes a request from a command payload
func DeserializeRequest(payload *Reader) (*OperationRequest, error) {
	return defaultProtocol16.DeserializeOperationRequest(payload)
}

// DeserializeResponse deserializes a response from a command payload
func DeserializeResponse(payload *Reader) (*OperationResponse, error) {
	return defaultProtocol16.DeserializeOperationResponse(payload)
}
