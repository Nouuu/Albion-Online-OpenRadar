package audio

import (
	"sync"
	"testing"
	"testing/fstest"
)

type fakeClip struct {
	pcm    []byte
	volume float64
	played bool
	closed bool
}

func (c *fakeClip) SetVolume(v float64) { c.volume = v }
func (c *fakeClip) Play()               { c.played = true }
func (c *fakeClip) Close() error        { c.closed = true; return nil }

func newTestPlayer(clips map[string][]byte) (*Player, *[]*fakeClip) {
	var built []*fakeClip
	var mu sync.Mutex
	p := &Player{
		clips: clips,
		newClip: func(pcm []byte) clip {
			c := &fakeClip{pcm: pcm}
			mu.Lock()
			built = append(built, c)
			mu.Unlock()
			return c
		},
	}
	return p, &built
}

func conformingWAV(pcm []byte) []byte {
	return buildWAV(wavChunk{"fmt ", conformingFmt()}, wavChunk{"data", pcm})
}

func TestLoadClipsDecodesEveryWAV(t *testing.T) {
	dir := fstest.MapFS{
		"alert.wav":  {Data: conformingWAV([]byte{1, 2, 3, 4})},
		"second.WAV": {Data: conformingWAV([]byte{5, 6})},
		"notes.txt":  {Data: []byte("not audio")},
	}

	clips, err := loadClips(dir)
	if err != nil {
		t.Fatalf("loadClips returned %v, want no error", err)
	}
	if len(clips) != 2 {
		t.Fatalf("loadClips returned %d clips, want the 2 WAV files only", len(clips))
	}
	if got := string(clips["alert.wav"]); got != "\x01\x02\x03\x04" {
		t.Errorf("alert.wav decoded to %q, want its PCM payload", got)
	}
	if _, ok := clips["second.WAV"]; !ok {
		t.Error("loadClips skipped second.WAV, want the extension matched whatever its case")
	}
}

func TestLoadClipsKeepsTheSoundsItCanDecode(t *testing.T) {
	dir := fstest.MapFS{
		"alert.wav":  {Data: conformingWAV([]byte{1, 2})},
		"broken.wav": {Data: []byte("not a wav")},
		"mono.wav":   {Data: buildWAV(wavChunk{"fmt ", fmtBody(1, 1, 44100, 16)}, wavChunk{"data", []byte{1, 2}})},
	}

	clips, err := loadClips(dir)
	if err != nil {
		t.Fatalf("loadClips returned %v, want one bad file not to silence the others", err)
	}
	if _, ok := clips["alert.wav"]; !ok {
		t.Error("loadClips dropped alert.wav, want the sounds it can decode kept")
	}
	if len(clips) != 1 {
		t.Errorf("loadClips returned %d clips, want only the one it can decode", len(clips))
	}
}

func TestPlayStartsTheClipAtTheVolumeAsked(t *testing.T) {
	p, built := newTestPlayer(map[string][]byte{"alert.wav": {1, 2, 3, 4}})

	if !p.Play("alert.wav", 0.25) {
		t.Fatal("Play reported the sound was not bundled, want it played")
	}

	if len(*built) != 1 {
		t.Fatalf("Play built %d clips, want 1", len(*built))
	}
	c := (*built)[0]
	if !c.played {
		t.Error("Play did not start the clip")
	}
	if c.volume != 0.25 {
		t.Errorf("Play set the volume to %v, want 0.25", c.volume)
	}
	if string(c.pcm) != "\x01\x02\x03\x04" {
		t.Errorf("Play passed %q, want the clip PCM", c.pcm)
	}
}

func TestPlayIgnoresASoundItDoesNotHold(t *testing.T) {
	p, built := newTestPlayer(map[string][]byte{"alert.wav": {1, 2}})

	if p.Play("missing.wav", 1) {
		t.Error("Play reported success for a sound it does not hold, want false")
	}

	if len(*built) != 0 {
		t.Errorf("Play built %d clips for an unknown sound, want 0", len(*built))
	}
}

func TestPlayStopsTheSoundInProgressAndStartsTheNewOneAtOnce(t *testing.T) {
	p, built := newTestPlayer(map[string][]byte{"alert.wav": {1, 2}, "other.wav": {3, 4}})

	p.Play("alert.wav", 1)
	p.Play("other.wav", 0.5)

	if len(*built) != 2 {
		t.Fatalf("Play built %d clips, want 2", len(*built))
	}
	first, second := (*built)[0], (*built)[1]
	if !first.closed {
		t.Error("the first clip is still open, want the second detection to cut it off")
	}
	if !second.played {
		t.Error("the second clip did not start, want it to start at once")
	}
	if second.closed {
		t.Error("the second clip was closed, want it left sounding")
	}
}
