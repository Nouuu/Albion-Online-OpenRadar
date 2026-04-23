package photon

import (
	"encoding/binary"
	"math"
	"testing"

	"github.com/stretchr/testify/require"
)

func makeMoveByteArray(x, y float32) ByteArray {
	data := make([]byte, 17)
	binary.LittleEndian.PutUint32(data[9:], math.Float32bits(x))
	binary.LittleEndian.PutUint32(data[13:], math.Float32bits(y))
	return ByteArray(data)
}

// Real Move byte arrays captured from live post-patch traffic.
// Source: capture.pcap (2026-04-14 T5 zone, harvest + zone transit). Mode byte
// 3, 30 bytes total, float32 LE positions at offsets 9/13. Player entities
// with XOR-encrypted positions were filtered out (NaN/Inf after decode).
func TestPostProcessEvent_Move_LivePcapSamples(t *testing.T) {
	cases := []struct {
		name string
		raw  ByteArray
		x, y float32
	}{
		{
			"mob_A_t0", ByteArray{3, 104, 88, 142, 195, 84, 154, 222, 8, 176, 230, 36, 195, 237, 215, 175, 67, 166, 0, 0, 176, 63, 245, 26, 37, 195, 158, 196, 175, 67},
			-164.90112, 351.68692,
		},
		{
			"mob_B_t0", ByteArray{3, 69, 127, 142, 195, 84, 154, 222, 8, 39, 231, 225, 194, 19, 187, 160, 67, 164, 0, 0, 64, 64, 148, 73, 233, 194, 164, 52, 159, 67},
			-112.95147, 321.46152,
		},
		{
			"mob_C_t0", ByteArray{3, 21, 205, 142, 195, 84, 154, 222, 8, 1, 15, 184, 194, 162, 150, 171, 67, 29, 0, 0, 128, 63, 92, 82, 178, 194, 166, 68, 173, 67},
			-92.029305, 343.17682,
		},
		{
			"mob_A_t1", ByteArray{3, 98, 158, 157, 195, 84, 154, 222, 8, 0, 3, 37, 195, 120, 205, 175, 67, 166, 0, 0, 176, 63, 245, 26, 37, 195, 158, 196, 175, 67},
			-165.01172, 351.60522,
		},
		{
			"mob_B_t1", ByteArray{3, 71, 197, 157, 195, 84, 154, 222, 8, 146, 93, 226, 194, 158, 162, 160, 67, 164, 0, 0, 64, 64, 148, 73, 233, 194, 164, 52, 159, 67},
			-113.182755, 321.27045,
		},
		{
			"mob_C_t1", ByteArray{3, 127, 42, 158, 195, 84, 154, 222, 8, 194, 237, 183, 194, 94, 160, 171, 67, 29, 0, 0, 128, 63, 92, 82, 178, 194, 166, 68, 173, 67},
			-91.96437, 343.25287,
		},
		{
			"mob_B_t2", ByteArray{3, 247, 33, 173, 195, 84, 154, 222, 8, 253, 211, 226, 194, 41, 138, 160, 67, 164, 0, 0, 64, 64, 148, 73, 233, 194, 164, 52, 159, 67},
			-113.41404, 321.07938,
		},
		{
			"mob_C_t2", ByteArray{3, 218, 111, 173, 195, 84, 154, 222, 8, 131, 204, 183, 194, 26, 170, 171, 67, 29, 0, 0, 128, 63, 92, 82, 178, 194, 166, 68, 173, 67},
			-91.89944, 343.32892,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			ev := &EventData{
				Code:       3,
				Parameters: map[byte]interface{}{1: tc.raw},
			}
			PostProcessEvent(ev)
			require.InDelta(t, float64(tc.x), ev.Parameters[4].(float32), 0.001)
			require.InDelta(t, float64(tc.y), ev.Parameters[5].(float32), 0.001)
		})
	}
}

func TestPostProcessEvent_Move_SkipsNaNAndInf(t *testing.T) {
	cases := []struct {
		name string
		bits [2]uint32
	}{
		{"NaN both", [2]uint32{0x7fc00000, 0x7fc00000}},
		{"NaN posX only", [2]uint32{0x7fc00000, math.Float32bits(12.5)}},
		{"NaN posY only", [2]uint32{math.Float32bits(12.5), 0x7fc00000}},
		{"+Inf posX", [2]uint32{0x7f800000, math.Float32bits(12.5)}},
		{"-Inf posY", [2]uint32{math.Float32bits(12.5), 0xff800000}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			raw := make([]byte, 17)
			binary.LittleEndian.PutUint32(raw[9:], tc.bits[0])
			binary.LittleEndian.PutUint32(raw[13:], tc.bits[1])
			ev := &EventData{Code: 3, Parameters: map[byte]interface{}{1: ByteArray(raw)}}
			PostProcessEvent(ev)
			_, hasX := ev.Parameters[4]
			_, hasY := ev.Parameters[5]
			require.False(t, hasX, "params[4] must be absent when a coord is NaN/Inf")
			require.False(t, hasY, "params[5] must be absent when a coord is NaN/Inf")
		})
	}
}

func TestPostProcessEvent_Move_InjectsPositions(t *testing.T) {
	ev := &EventData{
		Code: 3,
		Parameters: map[byte]interface{}{
			1: makeMoveByteArray(123.5, -456.25),
		},
	}
	PostProcessEvent(ev)
	require.InDelta(t, 123.5, ev.Parameters[4].(float32), 0.001)
	require.InDelta(t, -456.25, ev.Parameters[5].(float32), 0.001)
}

func TestPostProcessEvent_Move_ShortArray_NoOp(t *testing.T) {
	ev := &EventData{
		Code: 3,
		Parameters: map[byte]interface{}{
			1: ByteArray{0x00, 0x00, 0x00},
		},
	}
	PostProcessEvent(ev)
	_, has4 := ev.Parameters[4]
	_, has5 := ev.Parameters[5]
	require.False(t, has4)
	require.False(t, has5)
}

func TestPostProcessEvent_Fallback252_WhenAbsent(t *testing.T) {
	ev := &EventData{
		Code:       29,
		Parameters: map[byte]interface{}{},
	}
	PostProcessEvent(ev)
	require.Equal(t, byte(29), ev.Parameters[252])
}

func TestPostProcessEvent_Preserves252IfPresent(t *testing.T) {
	ev := &EventData{
		Code: 29,
		Parameters: map[byte]interface{}{
			252: byte(99),
		},
	}
	PostProcessEvent(ev)
	require.Equal(t, byte(99), ev.Parameters[252])
}

func TestPostProcessRequest_Fallback253(t *testing.T) {
	req := &OperationRequest{
		OperationCode: 21,
		Parameters:    map[byte]interface{}{},
	}
	PostProcessRequest(req)
	require.Equal(t, byte(21), req.Parameters[253])
}

func TestPostProcessResponse_Fallback253(t *testing.T) {
	resp := &OperationResponse{
		OperationCode: 42,
		Parameters:    map[byte]interface{}{},
	}
	PostProcessResponse(resp)
	require.Equal(t, byte(42), resp.Parameters[253])
}
