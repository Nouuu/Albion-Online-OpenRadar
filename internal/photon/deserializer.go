package photon

import (
	"bytes"
	"fmt"
	"reflect"
)

func deserialize(buf *bytes.Buffer, tc byte) interface{} {
	if tc >= customTypeSlimBase {
		return deserializeCustom(buf, tc)
	}
	switch tc {
	case typeUnknown, typeNull:
		return nil
	case typeBoolean:
		b, _ := buf.ReadByte()
		return b != 0
	case typeByte:
		b, _ := buf.ReadByte()
		return b
	case typeShort:
		return readInt16(buf)
	case typeFloat:
		return readFloat32(buf)
	case typeDouble:
		return readFloat64(buf)
	case typeString:
		return readString(buf)
	case typeCompressedInt:
		return readCompressedInt32(buf)
	case typeCompressedLong:
		return readCompressedInt64(buf)
	case typeInt1:
		b, _ := buf.ReadByte()
		return int32(b)
	case typeInt1Neg:
		b, _ := buf.ReadByte()
		return -int32(b)
	case typeInt2:
		return int32(readUint16(buf))
	case typeInt2Neg:
		return -int32(readUint16(buf))
	case typeLong1:
		b, _ := buf.ReadByte()
		return int64(b)
	case typeLong1Neg:
		b, _ := buf.ReadByte()
		return -int64(b)
	case typeLong2:
		return int64(readUint16(buf))
	case typeLong2Neg:
		return -int64(readUint16(buf))
	case typeCustom:
		return deserializeCustom(buf, 0)
	case typeDictionary:
		return deserializeDictionary(buf)
	case typeHashtable:
		return deserializeHashtable(buf)
	case typeObjectArray:
		return deserializeObjectArray(buf)
	case typeOperationRequest:
		return deserializeOperationRequestInner(buf)
	case typeOperationResp:
		return deserializeOperationResponseInner(buf)
	case typeEventData:
		return deserializeEventDataInner(buf)
	case typeBoolFalse:
		return false
	case typeBoolTrue:
		return true
	case typeShortZero:
		return int16(0)
	case typeIntZero:
		return int32(0)
	case typeLongZero:
		return int64(0)
	case typeFloatZero:
		return float32(0)
	case typeDoubleZero:
		return float64(0)
	case typeByteZero:
		return byte(0)
	case typeArray:
		return deserializeNestedArray(buf)
	default:
		if tc&typeArray == typeArray {
			return deserializeTypedArray(buf, tc&^typeArray)
		}
		return nil
	}
}

func isComparable(v interface{}) bool {
	switch v.(type) {
	case nil, bool, byte, int16, int32, int64, float32, float64, string:
		return true
	case ByteArray, []interface{}, []bool, []byte, []int16, []int32, []int64, []float32, []float64, []string,
		map[interface{}]interface{}, map[byte]interface{}:
		return false
	}
	return reflect.TypeOf(v).Comparable()
}

func deserializeCustom(buf *bytes.Buffer, gpType byte) interface{} {
	if gpType < customTypeSlimBase {
		if _, err := buf.ReadByte(); err != nil {
			return nil
		}
	}
	size := int(readCount(buf))
	if size < 0 || size > buf.Len() || size > maxArraySize {
		return nil
	}
	data := make([]byte, size)
	if _, err := buf.Read(data); err != nil {
		return nil
	}
	return ByteArray(data)
}

func deserializeDictionary(buf *bytes.Buffer) map[interface{}]interface{} {
	keyTC, err := buf.ReadByte()
	if err != nil {
		return nil
	}
	valTC, err := buf.ReadByte()
	if err != nil {
		return nil
	}
	count := int(readCount(buf))
	if count < 0 || count > maxArraySize || count > buf.Len() {
		return nil
	}
	out := make(map[interface{}]interface{}, count)
	for i := 0; i < count && buf.Len() > 0; i++ {
		kt := keyTC
		if kt == 0 {
			kt, err = buf.ReadByte()
			if err != nil {
				return out
			}
		}
		vt := valTC
		if vt == 0 {
			vt, err = buf.ReadByte()
			if err != nil {
				return out
			}
		}
		key := deserialize(buf, kt)
		val := deserialize(buf, vt)
		if isComparable(key) {
			out[key] = val
		} else {
			out[fmt.Sprintf("UNHASHABLE_%d_%T", i, key)] = val
		}
	}
	return out
}

func deserializeHashtable(buf *bytes.Buffer) map[interface{}]interface{} {
	return deserializeDictionary(buf)
}
func deserializeObjectArray(buf *bytes.Buffer) interface{} {
	size := int(readCount(buf))
	if size < 0 || size > maxArraySize || size > buf.Len() {
		return nil
	}
	result := make([]interface{}, size)
	for i := range result {
		tc, err := buf.ReadByte()
		if err != nil {
			break
		}
		result[i] = deserialize(buf, tc)
	}
	return result
}

func deserializeOperationRequestInner(buf *bytes.Buffer) interface{} {
	opCode, _ := buf.ReadByte()
	params := readParameterTable(buf)
	return map[string]interface{}{"operationCode": opCode, "parameters": params}
}

func deserializeOperationResponseInner(buf *bytes.Buffer) interface{} {
	if buf.Len() < 3 {
		return nil
	}
	opCode, _ := buf.ReadByte()
	returnCode := readInt16(buf)
	debugMsg := ""
	if buf.Len() > 0 {
		tc, _ := buf.ReadByte()
		if v, ok := deserialize(buf, tc).(string); ok {
			debugMsg = v
		}
	}
	params := readParameterTable(buf)
	return map[string]interface{}{
		"operationCode": opCode,
		"returnCode":    returnCode,
		"debugMessage":  debugMsg,
		"parameters":    params,
	}
}
func deserializeEventDataInner(buf *bytes.Buffer) interface{} {
	code, _ := buf.ReadByte()
	params := readParameterTable(buf)
	return map[string]interface{}{"code": code, "parameters": params}
}

func readParameterTable(buf *bytes.Buffer) map[byte]interface{} {
	count := int(readCount(buf))
	if count < 0 || count > maxArraySize || count > buf.Len() {
		return map[byte]interface{}{}
	}
	params := make(map[byte]interface{}, count)
	for i := 0; i < count && buf.Len() > 0; i++ {
		key, err := buf.ReadByte()
		if err != nil {
			break
		}
		tc, err := buf.ReadByte()
		if err != nil {
			break
		}
		params[key] = deserialize(buf, tc)
	}
	return params
}

func DeserializeEvent(data []byte) (*EventData, error) {
	if len(data) < 1 {
		return nil, fmt.Errorf("event payload too short: %d", len(data))
	}
	buf := bytes.NewBuffer(data)
	code, _ := buf.ReadByte()
	params := readParameterTable(buf)
	return &EventData{Code: code, Parameters: params}, nil
}

func DeserializeRequest(data []byte) (*OperationRequest, error) {
	if len(data) < 1 {
		return nil, fmt.Errorf("request payload too short: %d", len(data))
	}
	buf := bytes.NewBuffer(data)
	opCode, _ := buf.ReadByte()
	params := readParameterTable(buf)
	return &OperationRequest{OperationCode: opCode, Parameters: params}, nil
}

func DeserializeResponse(data []byte) (*OperationResponse, error) {
	if len(data) < 3 {
		return nil, fmt.Errorf("response payload too short: %d", len(data))
	}
	buf := bytes.NewBuffer(data)
	opCode, _ := buf.ReadByte()
	returnCode := readInt16(buf)

	// Protocol18 reserves a typed slot here for the debug message. Albion
	// hijacks it on market-order responses to carry the order payload as a
	// []string, expected by downstream handlers at params[0].
	var debug string
	var marketOrders []string
	if buf.Len() > 0 {
		tc, _ := buf.ReadByte()
		val := deserialize(buf, tc)
		switch v := val.(type) {
		case string:
			debug = v
		case []string:
			marketOrders = v
		}
	}

	params := readParameterTable(buf)
	if marketOrders != nil {
		params[0] = marketOrders
	}
	return &OperationResponse{
		OperationCode: opCode,
		ReturnCode:    returnCode,
		DebugMessage:  debug,
		Parameters:    params,
	}, nil
}
func deserializeNestedArray(buf *bytes.Buffer) interface{} {
	size := int(readCount(buf))
	if size < 0 || size > maxArraySize || size > buf.Len() {
		return nil
	}
	tc, err := buf.ReadByte()
	if err != nil {
		return nil
	}
	result := make([]interface{}, size)
	for i := range result {
		result[i] = deserialize(buf, tc)
	}
	return result
}

func deserializeTypedArray(buf *bytes.Buffer, elemType byte) interface{} {
	size := int(readCount(buf))
	if size < 0 || size > maxArraySize {
		return nil
	}
	switch elemType {
	case typeBoolean:
		result := make([]bool, size)
		packedBytes := (size + 7) / 8
		packed := make([]byte, packedBytes)
		_, _ = buf.Read(packed)
		for i := 0; i < size; i++ {
			result[i] = (packed[i/8] & (1 << uint(i%8))) != 0
		}
		return result
	case typeByte:
		data := make(ByteArray, size)
		_, _ = buf.Read(data)
		return data
	case typeShort:
		result := make([]int16, size)
		for i := range result {
			result[i] = readInt16(buf)
		}
		return result
	case typeFloat:
		result := make([]float32, size)
		for i := range result {
			result[i] = readFloat32(buf)
		}
		return result
	case typeDouble:
		result := make([]float64, size)
		for i := range result {
			result[i] = readFloat64(buf)
		}
		return result
	case typeString:
		result := make([]string, size)
		for i := range result {
			result[i] = readString(buf)
		}
		return result
	case typeCompressedInt:
		result := make([]int32, size)
		for i := range result {
			result[i] = readCompressedInt32(buf)
		}
		return result
	case typeCompressedLong:
		result := make([]int64, size)
		for i := range result {
			result[i] = readCompressedInt64(buf)
		}
		return result
	case typeDictionary:
		result := make([]interface{}, size)
		for i := range result {
			result[i] = deserializeDictionary(buf)
		}
		return result
	case typeHashtable:
		result := make([]interface{}, size)
		for i := range result {
			result[i] = deserializeHashtable(buf)
		}
		return result
	case typeCustom:
		// Shared customTypeID for all elements (read once, then N sized payloads).
		if _, err := buf.ReadByte(); err != nil {
			return nil
		}
		result := make([]interface{}, size)
		for i := range result {
			elemSize := int(readCount(buf))
			if elemSize < 0 || elemSize > buf.Len() || elemSize > maxArraySize {
				return nil
			}
			data := make(ByteArray, elemSize)
			_, _ = buf.Read(data)
			result[i] = data
		}
		return result
	default:
		result := make([]interface{}, size)
		for i := range result {
			result[i] = deserialize(buf, elemType)
		}
		return result
	}
}
