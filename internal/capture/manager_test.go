package capture

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func newStubCapturer(iface NetworkInterface) *Capturer {
	ctx, cancel := context.WithCancel(context.Background())
	return &Capturer{
		iface:  iface,
		ctx:    ctx,
		cancel: cancel,
	}
}

func withStubFactory(t *testing.T, opens map[string]error) func() {
	t.Helper()
	prev := captureFactory
	captureFactory = func(ctx context.Context, iface NetworkInterface) (*Capturer, error) {
		if err, ok := opens[iface.Name]; ok && err != nil {
			return nil, err
		}
		c := newStubCapturer(iface)
		c.ctx, c.cancel = context.WithCancel(ctx)
		return c, nil
	}
	return func() { captureFactory = prev }
}

func TestManagerReconfigureAddsRemoves(t *testing.T) {
	defer withStubFactory(t, nil)()

	m := NewManager(context.Background())
	m.OnPacket(func([]byte) {})

	if err := m.Reconfigure([]NetworkInterface{{Name: "a", Device: "a"}, {Name: "b", Device: "b"}}); err != nil {
		t.Fatalf("Reconfigure add: %v", err)
	}
	state := m.State()
	if len(state.Active) != 2 {
		t.Fatalf("got %d active, want 2", len(state.Active))
	}

	if err := m.Reconfigure([]NetworkInterface{{Name: "b", Device: "b"}, {Name: "c", Device: "c"}}); err != nil {
		t.Fatalf("Reconfigure swap: %v", err)
	}
	state = m.State()
	names := make(map[string]bool)
	for _, i := range state.Active {
		names[i.Name] = true
	}
	if !names["b"] || !names["c"] || names["a"] {
		t.Errorf("after swap want {b,c}, got %+v", state.Active)
	}

	if err := m.Reconfigure(nil); err != nil {
		t.Fatalf("Reconfigure empty: %v", err)
	}
	state = m.State()
	if len(state.Active) != 0 {
		t.Errorf("after empty want 0 active, got %d", len(state.Active))
	}
	if state.Status != StatusAwaiting {
		t.Errorf("status %q, want %q", state.Status, StatusAwaiting)
	}

	m.Close(context.Background())
}

func TestManagerOpenFailureIsolatesOthers(t *testing.T) {
	defer withStubFactory(t, map[string]error{"bad": errors.New("boom")})()

	m := NewManager(context.Background())
	m.OnPacket(func([]byte) {})
	err := m.Reconfigure([]NetworkInterface{
		{Name: "good", Device: "good"},
		{Name: "bad", Device: "bad"},
	})
	if err == nil {
		t.Fatal("expected partial-failure error")
	}
	state := m.State()
	if len(state.Active) != 1 || state.Active[0].Name != "good" {
		t.Errorf("after partial failure want {good}, got %+v", state.Active)
	}
	if len(state.LastErrors) == 0 || state.LastErrors["bad"] == "" {
		t.Errorf("expected lastErrors[bad], got %+v", state.LastErrors)
	}

	m.Close(context.Background())
}

func TestManagerCloseTwiceSafe(t *testing.T) {
	defer withStubFactory(t, nil)()
	m := NewManager(context.Background())
	m.OnPacket(func([]byte) {})
	_ = m.Reconfigure([]NetworkInterface{{Name: "a", Device: "a"}})
	m.Close(context.Background())
	m.Close(context.Background())
}

func TestManagerNoGoroutineLeak(t *testing.T) {
	defer withStubFactory(t, nil)()

	var workerStarted, workerExited atomic.Int32
	prev := managerStartWorker
	managerStartWorker = func(c *Capturer, wg *sync.WaitGroup, onError func(string, error)) {
		workerStarted.Add(1)
		wg.Add(1)
		go func() {
			defer wg.Done()
			defer workerExited.Add(1)
			<-c.ctx.Done()
		}()
	}
	defer func() { managerStartWorker = prev }()

	m := NewManager(context.Background())
	m.OnPacket(func([]byte) {})
	_ = m.Reconfigure([]NetworkInterface{{Name: "a", Device: "a"}, {Name: "b", Device: "b"}})

	closeCtx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
	defer cancel()
	m.Close(closeCtx)

	if got, want := workerStarted.Load(), int32(2); got != want {
		t.Errorf("workerStarted=%d, want %d", got, want)
	}
	if got, want := workerExited.Load(), int32(2); got != want {
		t.Errorf("workerExited=%d, want %d (goroutine leak)", got, want)
	}
}
