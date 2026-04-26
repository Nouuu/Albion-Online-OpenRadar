package capture

import (
	"context"
	"fmt"
	"sync"
	"time"
)

type Status string

const (
	StatusRunning  Status = "running"
	StatusAwaiting Status = "awaiting_interfaces"
)

type CaptureSummary struct {
	Name        string
	Description string
	Address     string
	Category    Category
	StartedAt   time.Time
}

type State struct {
	Status     Status
	Active     []CaptureSummary
	LastErrors map[string]string
}

var managerStartWorker = startWorker

type Manager struct {
	parentCtx context.Context

	mu         sync.Mutex
	active     map[string]*managedCapturer
	wg         sync.WaitGroup
	onPacket   PacketHandler
	lastErrors map[string]string
	closed     bool
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
		return fmt.Errorf("manager closed")
	}
	if m.onPacket == nil {
		m.mu.Unlock()
		return fmt.Errorf("OnPacket must be called before Reconfigure")
	}

	desired := make(map[string]NetworkInterface, len(target))
	for _, i := range target {
		desired[i.Name] = i
	}

	var openErrs []string
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

	m.mu.Unlock()

	if len(openErrs) > 0 {
		return fmt.Errorf("partial open failures: %v", openErrs)
	}
	return nil
}

func (m *Manager) State() State {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := State{
		LastErrors: make(map[string]string, len(m.lastErrors)),
	}
	for k, v := range m.lastErrors {
		out.LastErrors[k] = v
	}
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
	wg.Add(1)
	go func() {
		defer wg.Done()
		if err := c.Start(); err != nil && err != context.Canceled {
			onError(c.iface.Name, err)
		}
	}()
}
