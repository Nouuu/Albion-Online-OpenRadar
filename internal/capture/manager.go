package capture

import (
	"context"
	"errors"
	"fmt"
	"maps"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/nospy/albion-openradar/internal/logger"
)

type Status string

const (
	StatusRunning  Status = "running"
	StatusAwaiting Status = "awaiting_interfaces"
)

type CaptureSummary struct {
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Address     string    `json:"address"`
	Category    Category  `json:"category"`
	StartedAt   time.Time `json:"startedAt"`
}

type State struct {
	Status     Status
	Active     []CaptureSummary
	LastErrors map[string]string
}

var managerStartWorker = startWorker

// ErrClosed is returned by Reconfigure once the Manager is closed.
var ErrClosed = errors.New("manager closed")

type Manager struct {
	parentCtx context.Context

	mu               sync.Mutex
	active           map[string]*managedCapturer
	wg               sync.WaitGroup
	onPacket         PacketHandler
	lastErrors       map[string]string
	closed           bool
	recordingEnabled bool
	recordingDir     string
}

type managedCapturer struct {
	cap       *Capturer
	startedAt time.Time
	cancel    context.CancelFunc
}

func NewManager(parentCtx context.Context) *Manager {
	return &Manager{
		parentCtx:  parentCtx,
		active:     make(map[string]*managedCapturer),
		lastErrors: make(map[string]string),
	}
}

func (m *Manager) OnPacket(h PacketHandler) {
	m.mu.Lock()
	m.onPacket = h
	m.mu.Unlock()
}

func (m *Manager) Reconfigure(target []NetworkInterface) error {
	m.mu.Lock()
	if m.closed {
		m.mu.Unlock()
		return ErrClosed
	}
	if m.onPacket == nil {
		m.mu.Unlock()
		return errors.New("OnPacket must be called before Reconfigure")
	}

	desired := make(map[string]NetworkInterface, len(target))
	for _, i := range target {
		desired[i.Name] = i
	}

	var openErrs []string
	var recErr error
	for name, iface := range desired {
		if _, exists := m.active[name]; exists {
			continue
		}
		c, err := captureFactory(m.parentCtx, iface)
		if err != nil {
			m.lastErrors[name] = err.Error()
			openErrs = append(openErrs, fmt.Sprintf("%s: %v", name, err))
			continue
		}
		c.OnPacket(m.onPacket)
		mc := &managedCapturer{cap: c, startedAt: time.Now(), cancel: c.cancel}
		m.active[name] = mc
		delete(m.lastErrors, name)
		if m.recordingEnabled && recErr == nil {
			if rErr := c.StartRecording(m.recordingDir); rErr != nil {
				recErr = fmt.Errorf("pcap recording could not start on %s: %w", name, rErr)
			}
		}
		managerStartWorker(c, &m.wg, func(n string, e error) {
			m.mu.Lock()
			m.lastErrors[n] = e.Error()
			delete(m.active, n)
			m.mu.Unlock()
		})
	}

	for name, mc := range m.active {
		if _, keep := desired[name]; keep {
			continue
		}
		mc.cancel()
		mc.cap.Close()
		delete(m.active, name)
		delete(m.lastErrors, name)
	}

	if recErr != nil {
		_ = m.stopRecordingLocked()
	}
	m.mu.Unlock()

	if len(openErrs) > 0 {
		return errors.Join(fmt.Errorf("partial open failures: %v", openErrs), recErr)
	}
	return recErr
}

// StartRecording enables recording on every active capturer and on any future
// ones added via Reconfigure. It is all or nothing: if one capturer fails, none
// keeps recording and the error names the failing interface. Calling it while
// already recording is a no-op.
func (m *Manager) StartRecording(dir string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.recordingEnabled {
		return nil
	}
	m.recordingEnabled = true
	m.recordingDir = dir
	for name, mc := range m.active {
		if err := mc.cap.StartRecording(dir); err != nil {
			_ = m.stopRecordingLocked()
			return fmt.Errorf("pcap recording could not start on %s: %w", name, err)
		}
	}
	return nil
}

// StopRecording disables recording on all active capturers.
func (m *Manager) StopRecording() error {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.stopRecordingLocked()
}

func (m *Manager) stopRecordingLocked() error {
	m.recordingEnabled = false
	m.recordingDir = ""
	var firstErr error
	for name, mc := range m.active {
		if err := mc.cap.StopRecording(); err != nil {
			logger.PrintWarn("PKT", "pcap recording could not stop on %s: %v", name, err)
			if firstErr == nil {
				firstErr = fmt.Errorf("%s: %w", name, err)
			}
		}
	}
	return firstErr
}

// IsRecording reports whether the Manager has recording enabled.
func (m *Manager) IsRecording() bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.recordingEnabled
}

// BytesReceived sums per-handle bytes across active capturers.
// pcap.Stats is not aggregated here; per-handle kernel stats are out of scope.
func (m *Manager) BytesReceived() uint64 {
	m.mu.Lock()
	defer m.mu.Unlock()
	var sum uint64
	for _, mc := range m.active {
		sum += mc.cap.BytesReceived()
	}
	return sum
}

func (m *Manager) State() State {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := State{
		LastErrors: make(map[string]string, len(m.lastErrors)),
	}
	maps.Copy(out.LastErrors, m.lastErrors)
	for _, mc := range m.active {
		i := mc.cap.iface
		out.Active = append(out.Active, CaptureSummary{
			Name:        i.Name,
			Description: i.Description,
			Address:     i.Address,
			Category:    Categorize(i.Name, i.Description),
			StartedAt:   mc.startedAt,
		})
	}
	slices.SortFunc(out.Active, func(a, b CaptureSummary) int { return strings.Compare(a.Name, b.Name) })
	if len(out.Active) == 0 {
		out.Status = StatusAwaiting
	} else {
		out.Status = StatusRunning
	}
	return out
}

// Close cancels all read loops, waits for workers, then closes handles.
// libpcap is unsafe to close while a Read poll is in flight, so handles
// are closed only after wg.Wait or closeCtx expires.
func (m *Manager) Close(closeCtx context.Context) {
	m.mu.Lock()
	if m.closed {
		m.mu.Unlock()
		return
	}
	m.closed = true
	for _, mc := range m.active {
		mc.cancel()
	}
	captures := make([]*Capturer, 0, len(m.active))
	for _, mc := range m.active {
		captures = append(captures, mc.cap)
	}
	m.active = nil
	m.mu.Unlock()

	done := make(chan struct{})
	go func() {
		m.wg.Wait()
		close(done)
	}()
	select {
	case <-done:
	case <-closeCtx.Done():
	}
	for _, c := range captures {
		c.Close()
	}
}

func startWorker(c *Capturer, wg *sync.WaitGroup, onError func(string, error)) {
	wg.Go(func() {
		if err := c.Start(); err != nil && !errors.Is(err, context.Canceled) {
			onError(c.iface.Name, err)
		}
	})
}
