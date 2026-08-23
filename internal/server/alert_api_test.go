package server

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type fakeAlertPlayer struct {
	held   map[string]bool
	file   string
	volume float64
	plays  int
}

func (p *fakeAlertPlayer) Has(file string) bool { return p.held[file] }

func (p *fakeAlertPlayer) Play(file string, volume float64) {
	p.file = file
	p.volume = volume
	p.plays++
}

func postPlay(t *testing.T, player AlertPlayer, body string) *httptest.ResponseRecorder {
	t.Helper()
	mux := http.NewServeMux()
	NewAlertAPI(player).Register(mux)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/api/alert/play", strings.NewReader(body)))
	return rec
}

func TestAlertPlayPlaysAKnownSound(t *testing.T) {
	player := &fakeAlertPlayer{held: map[string]bool{"player.wav": true}}

	rec := postPlay(t, player, `{"file":"player.wav","volume":0.25}`)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("POST /api/alert/play returned %d, want %d", rec.Code, http.StatusNoContent)
	}
	if player.plays != 1 {
		t.Fatalf("the player was asked to play %d times, want 1", player.plays)
	}
	if player.file != "player.wav" {
		t.Errorf("the player was given %q, want player.wav", player.file)
	}
	if player.volume != 0.25 {
		t.Errorf("the player was given volume %v, want 0.25", player.volume)
	}
}

func TestAlertPlayClampsTheVolume(t *testing.T) {
	tests := []struct {
		name string
		body string
		want float64
	}{
		{"above the maximum", `{"file":"player.wav","volume":4}`, 1},
		{"below silence", `{"file":"player.wav","volume":-2}`, 0},
		{"missing from the body", `{"file":"player.wav"}`, 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			player := &fakeAlertPlayer{held: map[string]bool{"player.wav": true}}

			rec := postPlay(t, player, tt.body)

			if rec.Code != http.StatusNoContent {
				t.Fatalf("POST /api/alert/play returned %d, want %d", rec.Code, http.StatusNoContent)
			}
			if player.volume != tt.want {
				t.Errorf("the player was given volume %v, want %v", player.volume, tt.want)
			}
		})
	}
}

func TestAlertPlayRefusesASoundItDoesNotHold(t *testing.T) {
	player := &fakeAlertPlayer{held: map[string]bool{"player.wav": true}}

	rec := postPlay(t, player, `{"file":"../secrets.wav","volume":1}`)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("POST /api/alert/play returned %d, want %d", rec.Code, http.StatusNotFound)
	}
	if player.plays != 0 {
		t.Errorf("the player was asked to play %d times, want 0", player.plays)
	}
}

func TestAlertPlayRefusesAMalformedBody(t *testing.T) {
	player := &fakeAlertPlayer{held: map[string]bool{"player.wav": true}}

	rec := postPlay(t, player, `not json`)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("POST /api/alert/play returned %d, want %d", rec.Code, http.StatusBadRequest)
	}
	if player.plays != 0 {
		t.Errorf("the player was asked to play %d times, want 0", player.plays)
	}
}

func TestAlertPlaySaysSoWhenTheMachineHasNoAudio(t *testing.T) {
	rec := postPlay(t, nil, `{"file":"player.wav","volume":1}`)

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("POST /api/alert/play returned %d, want %d", rec.Code, http.StatusServiceUnavailable)
	}
	if body := rec.Body.String(); !strings.Contains(body, "audio") {
		t.Errorf("POST /api/alert/play returned %q, want it to say the machine has no audio", strings.TrimSpace(body))
	}
}
