package audio

import (
	"encoding/binary"
	"errors"
	"fmt"
)

const (
	wantChannels   = 2
	wantSampleRate = 44100
	wantBits       = 16
)

// DecodeWAV returns the PCM payload of an uncompressed 16 bit little-endian WAV at 44100 Hz.
func DecodeWAV(b []byte) ([]byte, error) {
	if len(b) < 12 || string(b[0:4]) != "RIFF" || string(b[8:12]) != "WAVE" {
		return nil, errors.New("not a RIFF/WAVE file")
	}

	var pcm []byte
	var gotFmt bool

	for off := 12; off+8 <= len(b); {
		id := string(b[off : off+4])
		size := int(binary.LittleEndian.Uint32(b[off+4 : off+8]))
		body := off + 8
		if body+size > len(b) {
			return nil, fmt.Errorf("chunk %q runs past end of file", id)
		}

		switch id {
		case "fmt ":
			if size < 16 {
				return nil, errors.New("fmt chunk too short")
			}
			format := binary.LittleEndian.Uint16(b[body : body+2])
			channels := binary.LittleEndian.Uint16(b[body+2 : body+4])
			rate := binary.LittleEndian.Uint32(b[body+4 : body+8])
			bits := binary.LittleEndian.Uint16(b[body+14 : body+16])
			if format != 1 {
				return nil, fmt.Errorf("want uncompressed PCM, got format %d", format)
			}
			if channels != wantChannels || rate != wantSampleRate || bits != wantBits {
				return nil, fmt.Errorf("want %d channels %d Hz %d bit, got %d channels %d Hz %d bit",
					wantChannels, wantSampleRate, wantBits, channels, rate, bits)
			}
			gotFmt = true
		case "data":
			pcm = b[body : body+size]
		}

		off = body + size
		if size%2 == 1 {
			off++
		}
	}

	if !gotFmt {
		return nil, errors.New("no fmt chunk")
	}
	if pcm == nil {
		return nil, errors.New("no data chunk")
	}
	return pcm, nil
}
