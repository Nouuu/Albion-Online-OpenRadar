package audio

import (
	"bytes"
	"fmt"
	"io/fs"
	"path"
	"strings"
	"sync"

	"github.com/ebitengine/oto/v3"

	"github.com/nospy/albion-openradar/internal/logger"
)

type clip interface {
	SetVolume(volume float64)
	Play()
	Close() error
}

// Player holds every bundled sound as PCM and plays one at a time.
type Player struct {
	clips   map[string][]byte
	newClip func(pcm []byte) clip
	mu      sync.Mutex
	current clip
}

// NewPlayer decodes every WAV in soundsFS once and opens one audio context.
// A machine with no audio device returns an error; the caller keeps running without sound.
func NewPlayer(soundsFS fs.FS) (*Player, error) {
	clips, err := loadClips(soundsFS)
	if err != nil {
		return nil, err
	}

	ctx, ready, err := oto.NewContext(&oto.NewContextOptions{
		SampleRate:   wantSampleRate,
		ChannelCount: wantChannels,
		Format:       oto.FormatSignedInt16LE,
	})
	if err != nil {
		return nil, err
	}
	<-ready

	return &Player{
		clips:   clips,
		newClip: func(pcm []byte) clip { return ctx.NewPlayer(bytes.NewReader(pcm)) },
	}, nil
}

// loadClips decodes what it can and warns about the rest, so one unusable file
// leaves the other sounds working.
func loadClips(soundsFS fs.FS) (map[string][]byte, error) {
	entries, err := fs.ReadDir(soundsFS, ".")
	if err != nil {
		return nil, err
	}

	clips := map[string][]byte{}
	for _, entry := range entries {
		if entry.IsDir() || !strings.EqualFold(path.Ext(entry.Name()), ".wav") {
			continue
		}
		pcm, err := decodeEntry(soundsFS, entry.Name())
		if err != nil {
			logger.PrintWarn("SND", "sound skipped, %v", err)
			continue
		}
		clips[entry.Name()] = pcm
	}
	return clips, nil
}

func decodeEntry(soundsFS fs.FS, name string) ([]byte, error) {
	raw, err := fs.ReadFile(soundsFS, name)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", name, err)
	}
	pcm, err := DecodeWAV(raw)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", name, err)
	}
	return pcm, nil
}

// Play stops whatever is sounding and starts the named clip at once.
// It reports false when the sound was not bundled.
func (p *Player) Play(file string, volume float64) bool {
	pcm, ok := p.clips[file]
	if !ok {
		return false
	}

	p.mu.Lock()
	defer p.mu.Unlock()

	if p.current != nil {
		_ = p.current.Close()
	}
	next := p.newClip(pcm)
	next.SetVolume(volume)
	next.Play()
	p.current = next
	return true
}
