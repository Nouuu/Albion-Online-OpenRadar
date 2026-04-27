package photon

import (
	"bytes"
	"math"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestReadCompressedUint32(t *testing.T) {
	cases := []struct {
		name  string
		input []byte
		want  uint32
	}{
		{"zero", []byte{0x00}, 0},
		{"one byte max", []byte{0x7f}, 127},
		{"two bytes", []byte{0x80, 0x01}, 128},
		{"two bytes max", []byte{0xff, 0x7f}, 16383},
		{"three bytes", []byte{0x80, 0x80, 0x01}, 16384},
		{"five bytes max", []byte{0xff, 0xff, 0xff, 0xff, 0x0f}, math.MaxUint32},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			buf := bytes.NewBuffer(tc.input)
			require.Equal(t, tc.want, readCompressedUint32(buf))
		})
	}
}

func TestReadCompressedUint32_Truncated(t *testing.T) {
	buf := bytes.NewBuffer([]byte{0x80})
	require.NotPanics(t, func() { readCompressedUint32(buf) })
}

func TestReadCompressedUint32_Overflow(t *testing.T) {
	buf := bytes.NewBuffer([]byte{0xff, 0xff, 0xff, 0xff, 0xff, 0xff})
	require.Equal(t, uint32(0), readCompressedUint32(buf))
}

func TestReadCompressedInt32_Zigzag(t *testing.T) {
	cases := []struct {
		name  string
		input []byte
		want  int32
	}{
		{"zero", []byte{0x00}, 0},
		{"one", []byte{0x02}, 1},
		{"minus one", []byte{0x01}, -1},
		{"two", []byte{0x04}, 2},
		{"minus two", []byte{0x03}, -2},
		{"max int32", []byte{0xfe, 0xff, 0xff, 0xff, 0x0f}, math.MaxInt32},
		{"min int32", []byte{0xff, 0xff, 0xff, 0xff, 0x0f}, math.MinInt32},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			buf := bytes.NewBuffer(tc.input)
			require.Equal(t, tc.want, readCompressedInt32(buf))
		})
	}
}

func TestReadLEPrimitives(t *testing.T) {
	t.Run("int16", func(t *testing.T) {
		buf := bytes.NewBuffer([]byte{0x34, 0x12})
		require.Equal(t, int16(0x1234), readInt16(buf))
	})
	t.Run("float32 one", func(t *testing.T) {
		buf := bytes.NewBuffer([]byte{0x00, 0x00, 0x80, 0x3f})
		require.InEpsilon(t, float32(1.0), readFloat32(buf), 1e-6)
	})
	t.Run("float64 one", func(t *testing.T) {
		buf := bytes.NewBuffer([]byte{0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xf0, 0x3f})
		require.InEpsilon(t, 1.0, readFloat64(buf), 1e-9)
	})
}

func TestReadString(t *testing.T) {
	buf := bytes.NewBuffer([]byte{0x05, 'h', 'e', 'l', 'l', 'o'})
	require.Equal(t, "hello", readString(buf))
}

func TestReadString_Empty(t *testing.T) {
	buf := bytes.NewBuffer([]byte{0x00})
	require.Empty(t, readString(buf))
}

func TestReadString_Truncated(t *testing.T) {
	buf := bytes.NewBuffer([]byte{0x0a, 'h', 'i', '!'})
	require.Empty(t, readString(buf))
}
