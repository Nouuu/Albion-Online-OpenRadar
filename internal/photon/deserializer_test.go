package photon

import (
	"bytes"
	"testing"

	"github.com/segmentio/encoding/json"
	"github.com/stretchr/testify/require"
)

func TestDeserialize_Primitives(t *testing.T) {
	cases := []struct {
		name    string
		tc      byte
		payload []byte
		want    interface{}
	}{
		{"null", typeNull, nil, nil},
		{"unknown", typeUnknown, nil, nil},
		{"bool true", typeBoolean, []byte{0x01}, true},
		{"bool false", typeBoolean, []byte{0x00}, false},
		{"byte", typeByte, []byte{0x2a}, byte(0x2a)},
		{"short", typeShort, []byte{0x34, 0x12}, int16(0x1234)},
		{"float one", typeFloat, []byte{0x00, 0x00, 0x80, 0x3f}, float32(1.0)},
		{"double one", typeDouble, []byte{0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xf0, 0x3f}, float64(1.0)},
		{"string", typeString, []byte{0x03, 'f', 'o', 'o'}, "foo"},
		{"compressed int", typeCompressedInt, []byte{0x04}, int32(2)},
		{"compressed long", typeCompressedLong, []byte{0x02}, int64(1)},
		{"int1", typeInt1, []byte{0x05}, int32(5)},
		{"int1 neg", typeInt1Neg, []byte{0x05}, int32(-5)},
		{"int2", typeInt2, []byte{0x34, 0x12}, int32(0x1234)},
		{"int2 neg", typeInt2Neg, []byte{0x34, 0x12}, int32(-0x1234)},
		{"long1", typeLong1, []byte{0x05}, int64(5)},
		{"long1 neg", typeLong1Neg, []byte{0x05}, int64(-5)},
		{"long2", typeLong2, []byte{0x34, 0x12}, int64(0x1234)},
		{"long2 neg", typeLong2Neg, []byte{0x34, 0x12}, int64(-0x1234)},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			buf := bytes.NewBuffer(tc.payload)
			require.Equal(t, tc.want, deserialize(buf, tc.tc))
		})
	}
}

func TestDeserialize_Custom(t *testing.T) {
	buf := bytes.NewBuffer([]byte{42, 0x03, 0x01, 0x02, 0x03})
	require.Equal(t, ByteArray{0x01, 0x02, 0x03}, deserialize(buf, typeCustom))
}

func TestDeserialize_SlimCustom(t *testing.T) {
	buf := bytes.NewBuffer([]byte{0x02, 0xaa, 0xbb})
	require.Equal(t, ByteArray{0xaa, 0xbb}, deserialize(buf, 0x85))
}

func TestDeserialize_Custom_Truncated(t *testing.T) {
	buf := bytes.NewBuffer([]byte{42, 0x0a, 0x01, 0x02})
	require.Nil(t, deserialize(buf, typeCustom))
}

func TestDeserialize_ObjectArray(t *testing.T) {
	payload := []byte{
		0x02,
		typeByte, 0x01,
		typeShort, 0x34, 0x12,
	}
	buf := bytes.NewBuffer(payload)
	got := deserialize(buf, typeObjectArray).([]interface{})
	require.Len(t, got, 2)
	require.Equal(t, byte(0x01), got[0])
	require.Equal(t, int16(0x1234), got[1])
}

func TestDeserialize_NestedArray(t *testing.T) {
	payload := []byte{0x03, typeByte, 0x0a, 0x0b, 0x0c}
	buf := bytes.NewBuffer(payload)
	got := deserialize(buf, typeArray).([]interface{})
	require.Equal(t, []interface{}{byte(0x0a), byte(0x0b), byte(0x0c)}, got)
}

func TestDeserialize_TypedArray_Byte(t *testing.T) {
	tc := typeArray | typeByte
	buf := bytes.NewBuffer([]byte{0x03, 0x0a, 0x0b, 0x0c})
	require.Equal(t, ByteArray{0x0a, 0x0b, 0x0c}, deserialize(buf, tc))
}

func TestDeserialize_TypedArray_Short(t *testing.T) {
	tc := typeArray | typeShort
	buf := bytes.NewBuffer([]byte{0x02, 0x34, 0x12, 0x78, 0x56})
	require.Equal(t, []int16{0x1234, 0x5678}, deserialize(buf, tc))
}

func TestDeserialize_TypedArray_Float(t *testing.T) {
	tc := typeArray | typeFloat
	buf := bytes.NewBuffer([]byte{0x01, 0x00, 0x00, 0x80, 0x3f})
	require.Equal(t, []float32{1.0}, deserialize(buf, tc))
}

func TestDeserialize_TypedArray_String(t *testing.T) {
	tc := typeArray | typeString
	buf := bytes.NewBuffer([]byte{0x02, 0x01, 'a', 0x02, 'b', 'c'})
	require.Equal(t, []string{"a", "bc"}, deserialize(buf, tc))
}

func TestDeserialize_TypedArray_Bool_BitPacked(t *testing.T) {
	tc := typeArray | typeBoolean
	// count=10, then 2 bit-packed bytes.
	// 0xaa = 10101010 → bit0=0 bit1=1 bit2=0 bit3=1 bit4=0 bit5=1 bit6=0 bit7=1
	// 0x03 = 00000011 → bit0=1 bit1=1
	buf := bytes.NewBuffer([]byte{0x0a, 0xaa, 0x03})
	want := []bool{false, true, false, true, false, true, false, true, true, true}
	require.Equal(t, want, deserialize(buf, tc))
}

func TestDeserialize_TypedArray_Custom(t *testing.T) {
	tc := typeArray | typeCustom
	// count=2, shared customId=7, then (size=2, data=[0xaa,0xbb]), (size=1, data=[0xcc])
	payload := []byte{0x02, 0x07, 0x02, 0xaa, 0xbb, 0x01, 0xcc}
	got := deserialize(bytes.NewBuffer(payload), tc).([]interface{})
	require.Len(t, got, 2)
	require.Equal(t, ByteArray{0xaa, 0xbb}, got[0])
	require.Equal(t, ByteArray{0xcc}, got[1])
}

func TestDeserialize_TypedArray_OverMaxSize(t *testing.T) {
	tc := typeArray | typeByte
	buf := bytes.NewBuffer([]byte{0xff, 0xff, 0xff, 0xff, 0x0f})
	require.Nil(t, deserialize(buf, tc))
}

func TestDeserialize_Dictionary_Typed(t *testing.T) {
	payload := []byte{
		typeByte, typeShort,
		0x02,
		0x01, 0x34, 0x12,
		0x02, 0x78, 0x56,
	}
	buf := bytes.NewBuffer(payload)
	got := deserialize(buf, typeDictionary).(Hashtable)
	require.Len(t, got, 2)
	require.Equal(t, int16(0x1234), got[byte(1)])
	require.Equal(t, int16(0x5678), got[byte(2)])
}

func TestDeserialize_Dictionary_Dynamic(t *testing.T) {
	// Dynamic dict wire order: keyTC=0, valTC=0, count, then per entry:
	// (perEntryKeyTC, perEntryValTC, keyValue, valueValue).
	payload := []byte{
		0x00, 0x00,
		0x01,
		typeByte, typeString,
		0x2a,
		0x02, 'h', 'i',
	}
	buf := bytes.NewBuffer(payload)
	got := deserialize(buf, typeDictionary).(Hashtable)
	require.Equal(t, "hi", got[byte(0x2a)])
}

func TestDeserialize_Dictionary_NestedOpRequest_NoBufferDesync(t *testing.T) {
	// Dict with 1 entry: key=byte(1), value=typeOperationRequest{opCode=7, params: 0}.
	// After the nested op, an outer sentinel byte must still be read cleanly.
	payload := []byte{
		typeByte, typeOperationRequest, // keyTC, valTC
		0x01, // count=1
		0x01, // key=1
		0x07, // nested opCode=7
		0x00, // nested parameter table count=0
		0xAA, // sentinel trailing byte
	}
	buf := bytes.NewBuffer(payload)
	got := deserialize(buf, typeDictionary).(Hashtable)
	require.Len(t, got, 1)
	// After reading the dict, the trailing sentinel must still be in the buffer.
	require.Equal(t, 1, buf.Len())
	b, _ := buf.ReadByte()
	require.Equal(t, byte(0xAA), b)
}

func TestDeserialize_Hashtable_SameAsDict(t *testing.T) {
	payload := []byte{
		typeByte, typeByte,
		0x01,
		0x07, 0x08,
	}
	buf := bytes.NewBuffer(payload)
	got := deserialize(buf, typeHashtable).(Hashtable)
	require.Equal(t, byte(0x08), got[byte(0x07)])
}

func TestReadParameterTable(t *testing.T) {
	payload := []byte{
		0x02,
		0x00, typeByte, 0x2a,
		0xfc, typeByte, 0x03,
	}
	got := readParameterTable(bytes.NewBuffer(payload))
	require.Equal(t, byte(0x2a), got[0])
	require.Equal(t, byte(0x03), got[252])
}

func TestReadParameterTable_TruncatedMidEntry(t *testing.T) {
	payload := []byte{
		0x02,
		0x00, typeByte, 0x2a,
	}
	got := readParameterTable(bytes.NewBuffer(payload))
	require.Equal(t, byte(0x2a), got[0])
	require.Len(t, got, 1)
}

func TestDeserializeEvent_Minimal(t *testing.T) {
	payload := []byte{
		0x03,
		0x01,
		0xfc, typeByte, 0x03,
	}
	ev, err := DeserializeEvent(payload)
	require.NoError(t, err)
	require.Equal(t, byte(3), ev.Code)
	require.Equal(t, byte(3), ev.Parameters[252])
}

func TestDeserializeRequest(t *testing.T) {
	payload := []byte{
		0x0f,
		0x01,
		0xfd, typeByte, 0x0f,
	}
	req, err := DeserializeRequest(payload)
	require.NoError(t, err)
	require.Equal(t, byte(15), req.OperationCode)
	require.Equal(t, byte(15), req.Parameters[253])
}

func TestDeserializeResponse_WithStringDebug(t *testing.T) {
	payload := []byte{
		0x0f,
		0x00, 0x00,
		typeString, 0x02, 'o', 'k',
		0x00,
	}
	resp, err := DeserializeResponse(payload)
	require.NoError(t, err)
	require.Equal(t, byte(15), resp.OperationCode)
	require.Equal(t, int16(0), resp.ReturnCode)
	require.Equal(t, "ok", resp.DebugMessage)
}

func TestDeserializeResponse_WithStringArrayMarket(t *testing.T) {
	tc := typeArray | typeString
	payload := []byte{
		0x15,
		0x00, 0x00,
		tc, 0x01, 0x03, 'a', 'b', 'c',
	}
	resp, err := DeserializeResponse(payload)
	require.NoError(t, err)
	require.Equal(t, byte(0x15), resp.OperationCode)
	require.Empty(t, resp.DebugMessage)
	require.Equal(t, []string{"abc"}, resp.Parameters[0])
}

func TestDeserializeRequest_OpMove_PostPatch(t *testing.T) {
	payload := []byte{
		0x16,
		0x05,
		0x00, typeLong2, 0xe8, 0x03,
		0x01, typeArray | typeFloat, 0x02,
		0x00, 0x00, 0x28, 0x41,
		0x00, 0x00, 0xa4, 0x41,
		0x02, typeFloat, 0x00, 0x00, 0xc0, 0x3f,
		0x03, typeArray | typeFloat, 0x02,
		0x00, 0x00, 0x18, 0x41,
		0x00, 0x00, 0x9c, 0x41,
		0x04, typeFloat, 0x00, 0x00, 0xb0, 0x40,
	}

	req, err := DeserializeRequest(payload)
	require.NoError(t, err)
	PostProcessRequest(req)

	require.Equal(t, byte(22), req.OperationCode)
	require.Equal(t, int64(1000), req.Parameters[0])
	require.Equal(t, []float32{10.5, 20.5}, req.Parameters[1])
	require.InEpsilon(t, float32(1.5), req.Parameters[2], 1e-6)
	require.Equal(t, []float32{9.5, 19.5}, req.Parameters[3])
	require.InEpsilon(t, float32(5.5), req.Parameters[4], 1e-6)
	require.Equal(t, byte(22), req.Parameters[253])
}

// Regression: Parameters[103] hashtable must not break json.Marshal.
func TestMarshalJoinResponse_HashtableAtParam103(t *testing.T) {
	payload := []byte{
		0x02,
		0x00, 0x00,
		typeNull,
		0x02,
		0x08, typeString, 0x08, '@', 'M', 'I', 'S', 'T', 'S', '@', 'x',
		0x67, typeHashtable,
		typeByte, typeByte,
		0x02,
		0x05, 0x01,
		0x07, 0x00,
	}

	resp, err := DeserializeResponse(payload)
	require.NoError(t, err)
	PostProcessResponse(resp)

	msg := map[string]interface{}{
		"code": "response",
		"dictionary": map[string]interface{}{
			"operationCode": resp.OperationCode,
			"returnCode":    resp.ReturnCode,
			"debugMessage":  resp.DebugMessage,
			"parameters":    resp.Parameters,
		},
	}

	_, err = json.Marshal(msg)
	require.NoError(t, err, "marshal must succeed; hashtable at Parameters[103] needs a JSON-safe shape")
}

func TestDeserializeResponse_JoinMap_PostPatch(t *testing.T) {
	payload := []byte{
		0x02,
		0x00, 0x00,
		typeNull,
		0x02,
		0x09, typeArray | typeFloat, 0x02,
		0x00, 0x00, 0xc8, 0x42,
		0x00, 0x00, 0x48, 0x43,
		0x67, typeHashtable,
		typeByte, typeByte,
		0x02,
		0x05, 0x01,
		0x07, 0x00,
	}

	resp, err := DeserializeResponse(payload)
	require.NoError(t, err)
	PostProcessResponse(resp)

	require.Equal(t, byte(2), resp.OperationCode)
	require.Equal(t, int16(0), resp.ReturnCode)
	require.Equal(t, []float32{100.0, 200.0}, resp.Parameters[9])

	ht, ok := resp.Parameters[103].(Hashtable)
	require.True(t, ok, "params[103] must be a hashtable, got %T", resp.Parameters[103])
	require.Equal(t, byte(1), ht[byte(5)])
	require.Equal(t, byte(0), ht[byte(7)])
	require.Equal(t, byte(2), resp.Parameters[253])
}

func TestDeserialize_ZeroValues(t *testing.T) {
	cases := []struct {
		name string
		tc   byte
		want interface{}
	}{
		{"bool false", typeBoolFalse, false},
		{"bool true", typeBoolTrue, true},
		{"short zero", typeShortZero, int16(0)},
		{"int zero", typeIntZero, int32(0)},
		{"long zero", typeLongZero, int64(0)},
		{"float zero", typeFloatZero, float32(0)},
		{"double zero", typeDoubleZero, float64(0)},
		{"byte zero", typeByteZero, byte(0)},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			buf := bytes.NewBuffer(nil)
			require.Equal(t, tc.want, deserialize(buf, tc.tc))
		})
	}
}
