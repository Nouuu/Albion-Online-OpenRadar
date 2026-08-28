package audio

import (
	"bytes"
	"encoding/binary"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

type wavChunk struct {
	id   string
	body []byte
}

func fmtBody(format, channels uint16, rate uint32, bits uint16) []byte {
	b := make([]byte, 16)
	binary.LittleEndian.PutUint16(b[0:2], format)
	binary.LittleEndian.PutUint16(b[2:4], channels)
	binary.LittleEndian.PutUint32(b[4:8], rate)
	binary.LittleEndian.PutUint32(b[8:12], rate*uint32(channels)*uint32(bits)/8)
	binary.LittleEndian.PutUint16(b[12:14], channels*bits/8)
	binary.LittleEndian.PutUint16(b[14:16], bits)
	return b
}

func conformingFmt() []byte { return fmtBody(1, 2, 44100, 16) }

func buildWAV(chunks ...wavChunk) []byte {
	var body bytes.Buffer
	body.WriteString("WAVE")
	for _, c := range chunks {
		body.WriteString(c.id)
		_ = binary.Write(&body, binary.LittleEndian, uint32(len(c.body)))
		body.Write(c.body)
		if len(c.body)%2 == 1 {
			body.WriteByte(0)
		}
	}
	var out bytes.Buffer
	out.WriteString("RIFF")
	_ = binary.Write(&out, binary.LittleEndian, uint32(body.Len()))
	out.Write(body.Bytes())
	return out.Bytes()
}

func TestDecodeWAVReturnsThePCMPayload(t *testing.T) {
	pcm := []byte{1, 2, 3, 4, 5, 6, 7, 8}

	got, err := decodeWAV(buildWAV(wavChunk{"fmt ", conformingFmt()}, wavChunk{"data", pcm}))
	if err != nil {
		t.Fatalf("decodeWAV returned %v, want no error", err)
	}
	if !bytes.Equal(got, pcm) {
		t.Errorf("decodeWAV returned %v, want %v", got, pcm)
	}
}

func TestDecodeWAVWalksPastChunksItDoesNotUse(t *testing.T) {
	pcm := []byte{9, 8, 7, 6}

	got, err := decodeWAV(buildWAV(
		wavChunk{"fmt ", conformingFmt()},
		wavChunk{"LIST", []byte("odd")},
		wavChunk{"data", pcm},
	))
	if err != nil {
		t.Fatalf("decodeWAV returned %v, want no error", err)
	}
	if !bytes.Equal(got, pcm) {
		t.Errorf("decodeWAV returned %v, want %v", got, pcm)
	}
}

func TestDecodeWAVRefuses(t *testing.T) {
	conforming := buildWAV(wavChunk{"fmt ", conformingFmt()}, wavChunk{"data", []byte{1, 2, 3, 4}})

	tests := []struct {
		name string
		in   []byte
		want string
	}{
		{"a file that is not RIFF/WAVE", []byte("not a wav at all"), "not a RIFF/WAVE file"},
		{"a file too short to hold a header", []byte("RIFF"), "not a RIFF/WAVE file"},
		{
			"a sample rate other than 44100",
			buildWAV(wavChunk{"fmt ", fmtBody(1, 2, 22050, 16)}, wavChunk{"data", []byte{1, 2}}),
			"got 2 channels 22050 Hz 16 bit",
		},
		{
			"a mono file",
			buildWAV(wavChunk{"fmt ", fmtBody(1, 1, 44100, 16)}, wavChunk{"data", []byte{1, 2}}),
			"got 1 channels 44100 Hz 16 bit",
		},
		{
			"a bit depth other than 16",
			buildWAV(wavChunk{"fmt ", fmtBody(1, 2, 44100, 8)}, wavChunk{"data", []byte{1, 2}}),
			"got 2 channels 44100 Hz 8 bit",
		},
		{
			"a compressed payload",
			buildWAV(wavChunk{"fmt ", fmtBody(3, 2, 44100, 16)}, wavChunk{"data", []byte{1, 2}}),
			"format 3",
		},
		{
			"a fmt chunk too short to read",
			buildWAV(wavChunk{"fmt ", make([]byte, 8)}, wavChunk{"data", []byte{1, 2}}),
			"fmt chunk too short",
		},
		{"a chunk running past the end of the file", conforming[:len(conforming)-2], "runs past end of file"},
		{
			"a file with no data chunk",
			buildWAV(wavChunk{"fmt ", conformingFmt()}),
			"no data chunk",
		},
		{
			"a file with no fmt chunk",
			buildWAV(wavChunk{"data", []byte{1, 2, 3, 4}}),
			"no fmt chunk",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := decodeWAV(tt.in)
			if err == nil {
				t.Fatalf("decodeWAV returned %v and no error, want an error naming %q", got, tt.want)
			}
			if !strings.Contains(err.Error(), tt.want) {
				t.Errorf("decodeWAV returned %q, want it to name %q", err, tt.want)
			}
		})
	}
}

func TestDecodeWAVAcceptsEveryBundledSound(t *testing.T) {
	dir := filepath.Join("..", "..", "web", "sounds")

	files, err := filepath.Glob(filepath.Join(dir, "*.wav"))
	if err != nil {
		t.Fatalf("glob %s: %v", dir, err)
	}
	if len(files) == 0 {
		t.Fatalf("found no WAV under %s, want at least the bundled alert sound", dir)
	}

	for _, file := range files {
		t.Run(filepath.Base(file), func(t *testing.T) {
			raw, err := os.ReadFile(file)
			if err != nil {
				t.Fatalf("read %s: %v", file, err)
			}
			pcm, err := decodeWAV(raw)
			if err != nil {
				t.Fatalf("decodeWAV returned %v, want the bundled sound to meet the format contract", err)
			}
			if len(pcm) == 0 {
				t.Error("decodeWAV returned an empty payload, want audio")
			}
		})
	}
}
