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

func TestManagerBytesReceivedAggregates(t *testing.T) {
	defer withStubFactory(t, nil)()
	m := NewManager(context.Background())
	m.OnPacket(func([]byte) {})
	if err := m.Reconfigure([]NetworkInterface{{Name: "a", Device: "a"}, {Name: "b", Device: "b"}}); err != nil {
		t.Fatal(err)
	}
	if got := m.BytesReceived(); got != 0 {
		t.Errorf("got %d, want 0", got)
	}
	m.Close(context.Background())
}

func TestManagerNoGoroutineLeak(t *testing.T) {
	defer withStubFactory(t, nil)()

	var workerStarted, workerExited atomic.Int32
	prev := managerStartWorker
	managerStartWorker = func(c *Capturer, wg *sync.WaitGroup, _ func(string, error)) {
		workerStarted.Add(1)
		wg.Go(func() {
			defer workerExited.Add(1)
			<-c.ctx.Done()
		})
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

func TestManager_StartRecording_PropagatesToActive(t *testing.T) {
	defer withStubFactory(t, nil)()

	m := NewManager(context.Background())
	m.OnPacket(func([]byte) {})
	if err := m.Reconfigure([]NetworkInterface{{Name: "a", Device: "a"}}); err != nil {
		t.Fatalf("Reconfigure: %v", err)
	}

	dir := t.TempDir()
	if err := m.StartRecording(dir); err != nil {
		t.Fatalf("StartRecording: %v", err)
	}

	m.mu.Lock()
	mc := m.active["a"]
	m.mu.Unlock()
	if mc == nil {
		t.Fatal("active capturer 'a' not found")
	}
	if !mc.cap.IsRecording() {
		t.Error("capturer 'a' is not recording after Manager.StartRecording")
	}

	m.Close(context.Background())
}

func TestManager_StartRecording_AppliesToFutureCapturers(t *testing.T) {
	defer withStubFactory(t, nil)()

	m := NewManager(context.Background())
	m.OnPacket(func([]byte) {})

	dir := t.TempDir()
	if err := m.StartRecording(dir); err != nil {
		t.Fatalf("StartRecording before Reconfigure: %v", err)
	}

	if err := m.Reconfigure([]NetworkInterface{{Name: "b", Device: "b"}}); err != nil {
		t.Fatalf("Reconfigure: %v", err)
	}

	m.mu.Lock()
	mc := m.active["b"]
	m.mu.Unlock()
	if mc == nil {
		t.Fatal("active capturer 'b' not found")
	}
	if !mc.cap.IsRecording() {
		t.Error("capturer 'b' added after StartRecording is not recording")
	}

	m.Close(context.Background())
}

func TestManager_StopRecording_StopsAllActive(t *testing.T) {
	defer withStubFactory(t, nil)()

	m := NewManager(context.Background())
	m.OnPacket(func([]byte) {})
	if err := m.Reconfigure([]NetworkInterface{
		{Name: "c", Device: "c"},
		{Name: "d", Device: "d"},
	}); err != nil {
		t.Fatalf("Reconfigure: %v", err)
	}

	dir := t.TempDir()
	if err := m.StartRecording(dir); err != nil {
		t.Fatalf("StartRecording: %v", err)
	}

	if err := m.StopRecording(); err != nil {
		t.Fatalf("StopRecording: %v", err)
	}

	m.mu.Lock()
	caps := make([]*Capturer, 0, len(m.active))
	for _, mc := range m.active {
		caps = append(caps, mc.cap)
	}
	m.mu.Unlock()

	for _, c := range caps {
		if c.IsRecording() {
			t.Errorf("capturer %s is still recording after StopRecording", c.iface.Name)
		}
	}

	if m.IsRecording() {
		t.Error("Manager.IsRecording() still true after StopRecording")
	}

	m.Close(context.Background())
}
