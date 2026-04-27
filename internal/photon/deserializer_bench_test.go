package photon

import (
	"encoding/binary"
	"math"
	"testing"
)

func buildBenchMoveEventPayload() []byte {
	data := make([]byte, 17)
	binary.LittleEndian.PutUint32(data[9:], math.Float32bits(100.0))
	binary.LittleEndian.PutUint32(data[13:], math.Float32bits(200.0))
	payload := []byte{
		0x03,
		0x01,
		0x01,
		0x80,
		0x11,
	}
	return append(payload, data...)
}

func BenchmarkDeserializeMoveEvent(b *testing.B) {
	payload := buildBenchMoveEventPayload()
	for range b.N {
		ev, _ := DeserializeEvent(payload)
		PostProcessEvent(ev)
	}
}
