package photon

import (
	"encoding/binary"
	"fmt"
	"math"
)

// Reader wraps a byte slice with position tracking (like BufferCursor in JS)
type Reader struct {
	data []byte
	pos  int
}

// NewReader creates a Reader from a byte slice
func NewReader(data []byte) *Reader {
	return &Reader{data: data, pos: 0}
}

// Tell returns current position
func (r *Reader) Tell() int {
	return r.pos
}

// Seek sets the position
func (r *Reader) Seek(pos int) {
	r.pos = pos
}

// Skip advances position by n bytes
func (r *Reader) Skip(n int) {
	r.pos += n
}

// Remaining returns bytes remaining
func (r *Reader) Remaining() int {
	return len(r.data) - r.pos
}

// Data returns the underlying byte slice
func (r *Reader) Data() []byte {
	return r.data
}

// Slice returns a new Reader from current position to end
func (r *Reader) Slice(length int) *Reader {
	if r.pos+length > len(r.data) {
		length = len(r.data) - r.pos
	}
	newData := r.data[r.pos : r.pos+length]
	return NewReader(newData)
}

// SliceFrom returns a new Reader from pos to pos+length
func (r *Reader) SliceFrom(start, length int) *Reader {
	end := start + length
	if end > len(r.data) {
		end = len(r.data)
	}
	return NewReader(r.data[start:end])
}

// ReadUint8 reads 1 byte unsigned
func (r *Reader) ReadUint8() (uint8, error) {
	if r.pos >= len(r.data) {
		return 0, fmt.Errorf("ReadUint8: buffer overflow at pos %d", r.pos)
	}
	val := r.data[r.pos]
	r.pos++
	return val, nil
}

// ReadInt8 reads 1 byte signed
func (r *Reader) ReadInt8() (int8, error) {
	val, err := r.ReadUint8()
	return int8(val), err
}

// ReadUint16BE reads 2 bytes big-endian unsigned
func (r *Reader) ReadUint16BE() (uint16, error) {
	if r.pos+2 > len(r.data) {
		return 0, fmt.Errorf("ReadUint16BE: buffer overflow at pos %d", r.pos)
	}
	val := binary.BigEndian.Uint16(r.data[r.pos:])
	r.pos += 2
	return val, nil
}

// ReadInt16BE reads 2 bytes big-endian signed
func (r *Reader) ReadInt16BE() (int16, error) {
	val, err := r.ReadUint16BE()
	return int16(val), err
}

// ReadUint32BE reads 4 bytes big-endian unsigned
func (r *Reader) ReadUint32BE() (uint32, error) {
	if r.pos+4 > len(r.data) {
		return 0, fmt.Errorf("ReadUint32BE: buffer overflow at pos %d", r.pos)
	}
	val := binary.BigEndian.Uint32(r.data[r.pos:])
	r.pos += 4
	return val, nil
}

// ReadInt32BE reads 4 bytes big-endian signed
func (r *Reader) ReadInt32BE() (int32, error) {
	val, err := r.ReadUint32BE()
	return int32(val), err
}

// ReadUint64BE reads 8 bytes big-endian unsigned
func (r *Reader) ReadUint64BE() (uint64, error) {
	if r.pos+8 > len(r.data) {
		return 0, fmt.Errorf("ReadUint64BE: buffer overflow at pos %d", r.pos)
	}
	val := binary.BigEndian.Uint64(r.data[r.pos:])
	r.pos += 8
	return val, nil
}

// ReadInt64BE reads 8 bytes big-endian signed
func (r *Reader) ReadInt64BE() (int64, error) {
	val, err := r.ReadUint64BE()
	return int64(val), err
}

// ReadFloat32LE reads 4 bytes little-endian float (for Event 3 positions!)
func (r *Reader) ReadFloat32LE() (float32, error) {
	if r.pos+4 > len(r.data) {
		return 0, fmt.Errorf("ReadFloat32LE: buffer overflow at pos %d", r.pos)
	}
	bits := binary.LittleEndian.Uint32(r.data[r.pos:])
	r.pos += 4
	return float32frombits(bits), nil
}

// ReadFloat32BE reads 4 bytes big-endian float
func (r *Reader) ReadFloat32BE() (float32, error) {
	if r.pos+4 > len(r.data) {
		return 0, fmt.Errorf("ReadFloat32BE: buffer overflow at pos %d", r.pos)
	}
	bits := binary.BigEndian.Uint32(r.data[r.pos:])
	r.pos += 4
	return float32frombits(bits), nil
}

// ReadFloat64BE reads 8 bytes big-endian double
func (r *Reader) ReadFloat64BE() (float64, error) {
	if r.pos+8 > len(r.data) {
		return 0, fmt.Errorf("ReadFloat64BE: buffer overflow at pos %d", r.pos)
	}
	bits := binary.BigEndian.Uint64(r.data[r.pos:])
	r.pos += 8
	return float64frombits(bits), nil
}

// ReadBytes reads n bytes
func (r *Reader) ReadBytes(n int) ([]byte, error) {
	if r.pos+n > len(r.data) {
		return nil, fmt.Errorf("ReadBytes: buffer overflow at pos %d, need %d bytes", r.pos, n)
	}
	result := make([]byte, n)
	copy(result, r.data[r.pos:r.pos+n])
	r.pos += n
	return result, nil
}

// PeekUint8 reads 1 byte without advancing position
func (r *Reader) PeekUint8() (uint8, error) {
	if r.pos >= len(r.data) {
		return 0, fmt.Errorf("PeekUint8: buffer overflow at pos %d", r.pos)
	}
	return r.data[r.pos], nil
}

// Helper functions for float conversion
func float32frombits(b uint32) float32 {
	return math.Float32frombits(b)
}

func float64frombits(b uint64) float64 {
	return math.Float64frombits(b)
}
