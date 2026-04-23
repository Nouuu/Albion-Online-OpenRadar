package photon

import (
	"encoding/binary"
	"math"

	"github.com/nospy/albion-openradar/internal/photon/eventcodes"
)

func PostProcessEvent(event *EventData) {
	if event == nil {
		return
	}
	if event.Parameters == nil {
		event.Parameters = map[byte]interface{}{}
	}
	if _, ok := event.Parameters[252]; !ok {
		event.Parameters[252] = event.Code
	}
	if event.Code == eventcodes.Move {
		extractMovePositions(event.Parameters)
	}
}

func PostProcessRequest(req *OperationRequest) {
	if req == nil {
		return
	}
	if req.Parameters == nil {
		req.Parameters = map[byte]interface{}{}
	}
	if _, ok := req.Parameters[253]; !ok {
		req.Parameters[253] = req.OperationCode
	}
}

func PostProcessResponse(resp *OperationResponse) {
	if resp == nil {
		return
	}
	if resp.Parameters == nil {
		resp.Parameters = map[byte]interface{}{}
	}
	if _, ok := resp.Parameters[253]; !ok {
		resp.Parameters[253] = resp.OperationCode
	}
}

// Mobs/resources send mode=3 with 30 bytes; players send mode=3 too but with
// XOR-encrypted floats that decode to NaN/Inf without the XorCode. Skip those
// so json.Marshal downstream does not reject the whole WebSocket batch.
func extractMovePositions(params map[byte]interface{}) {
	raw, ok := params[1].(ByteArray)
	if !ok || len(raw) < 17 {
		return
	}
	x := math.Float32frombits(binary.LittleEndian.Uint32(raw[9:13]))
	y := math.Float32frombits(binary.LittleEndian.Uint32(raw[13:17]))
	if !isFiniteFloat32(x) || !isFiniteFloat32(y) {
		return
	}
	params[4] = x
	params[5] = y
}

func isFiniteFloat32(f float32) bool {
	f64 := float64(f)
	return !math.IsNaN(f64) && !math.IsInf(f64, 0)
}
