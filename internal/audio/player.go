package audio

import (
	"bytes"
	"errors"
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
	clips, skipped, err := loadClips(soundsFS)
	if err != nil {
		return nil, err
	}
	for _, reason := range skipped {
		logger.PrintWarn("SND", "sound skipped: %s", reason)
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

// loadClips decodes what it can and reports what it could not, so one unusable file
// leaves the other sounds working. It fails only when nothing at all is playable.
func loadClips(soundsFS fs.FS) (map[string][]byte, []string, error) {
	entries, err := fs.ReadDir(soundsFS, ".")
	if err != nil {
		return nil, nil, err
	}

	clips := map[string][]byte{}
	var skipped []string
	for _, entry := range entries {
		if entry.IsDir() || !strings.EqualFold(path.Ext(entry.Name()), ".wav") {
			continue
		}
		raw, err := fs.ReadFile(soundsFS, entry.Name())
		if err != nil {
			skipped = append(skipped, fmt.Sprintf("%s: %v", entry.Name(), err))
			continue
		}
		pcm, err := DecodeWAV(raw)
		if err != nil {
			skipped = append(skipped, fmt.Sprintf("%s: %v", entry.Name(), err))
			continue
		}
		clips[entry.Name()] = pcm
	}

	if len(clips) == 0 {
		return nil, skipped, errors.New("no playable sound found")
	}
	return clips, skipped, nil
}

// Has reports whether the named sound was bundled.
func (p *Player) Has(file string) bool {
	_, ok := p.clips[file]
	return ok
}

// Play stops whatever is sounding and starts the named clip at once.
func (p *Player) Play(file string, volume float64) {
	pcm, ok := p.clips[file]
	if !ok {
		return
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
}
