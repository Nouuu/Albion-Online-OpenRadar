package ui

import (
	"testing"
)

func TestCaptureStateMsgUpdatesFields(t *testing.T) {
	d := NewDashboard("v0", 5001, true, nil, nil)
	msg := CaptureStateMsg{
		Active: []CaptureSummary{
			{Description: "Wi-Fi", Address: "192.168.1.42", Category: "wifi"},
			{Description: "Realtek", Address: "192.168.1.10", Category: "ethernet"},
		},
		LanAddresses: []string{"192.168.1.42", "192.168.1.10"},
		Status:       "running",
	}
	updated, _ := d.Update(msg)
	out, ok := updated.(Dashboard)
	if !ok {
		t.Fatal("Update did not return Dashboard")
	}
	if len(out.captureInterfaces) != 2 {
		t.Errorf("captureInterfaces len=%d, want 2", len(out.captureInterfaces))
	}
	if out.captureStatus != "running" {
		t.Errorf("status=%q, want running", out.captureStatus)
	}
	if out.lanServerURL == "" {
		t.Error("lanServerURL not derived from first LAN address")
	}
}

func TestCaptureSummaryEmpty(t *testing.T) {
	if got := captureSummary(nil); got != "(awaiting)" {
		t.Errorf("captureSummary(nil) = %q, want '(awaiting)'", got)
	}
}
