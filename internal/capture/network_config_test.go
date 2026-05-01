package capture

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestConfigRoundTrip(t *testing.T) {
	dir := t.TempDir()
	cfg := Config{
		CaptureInterfaces: []PersistedInterface{
			{Name: `\Device\NPF_{ABC}`, Description: "Wi-Fi"},
			{Name: `\Device\NPF_{DEF}`, Description: "Realtek"},
		},
	}
	if err := WriteConfig(dir, cfg); err != nil {
		t.Fatalf("WriteConfig: %v", err)
	}
	got, err := ReadConfig(dir)
	if err != nil {
		t.Fatalf("ReadConfig: %v", err)
	}
	if len(got.CaptureInterfaces) != 2 {
		t.Fatalf("got %d entries, want 2", len(got.CaptureInterfaces))
	}
	if got.CaptureInterfaces[0].Description != "Wi-Fi" {
		t.Errorf("entry 0 description = %q, want Wi-Fi", got.CaptureInterfaces[0].Description)
	}
}

func TestReadConfigMissing(t *testing.T) {
	dir := t.TempDir()
	cfg, err := ReadConfig(dir)
	if err != nil {
		t.Fatalf("ReadConfig on empty dir: %v", err)
	}
	if len(cfg.CaptureInterfaces) != 0 {
		t.Errorf("missing config returned %d entries, want 0", len(cfg.CaptureInterfaces))
	}
}

func TestReadConfigMalformed(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "network.json"), []byte("{not json"), 0o644); err != nil {
		t.Fatalf("WriteFile: %v", err)
	}
	cfg, err := ReadConfig(dir)
	if err == nil {
		t.Fatalf("expected error on malformed JSON, got cfg=%+v", cfg)
	}
}

func TestMigrateFromIPTxt(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "ip.txt"), []byte("192.168.1.42\n"), 0o644); err != nil {
		t.Fatalf("WriteFile ip.txt: %v", err)
	}
	resolve := func(ip string) (PersistedInterface, error) {
		if ip != "192.168.1.42" {
			t.Errorf("resolve called with %q, want 192.168.1.42", ip)
		}
		return PersistedInterface{Name: `\Device\NPF_{X}`, Description: "Wi-Fi"}, nil
	}
	migrated, err := MigrateIPTxt(dir, resolve)
	if err != nil {
		t.Fatalf("MigrateIPTxt: %v", err)
	}
	if !migrated {
		t.Fatal("expected migrated=true")
	}
	cfg, _ := ReadConfig(dir)
	if len(cfg.CaptureInterfaces) != 1 || cfg.CaptureInterfaces[0].Description != "Wi-Fi" {
		t.Errorf("migrated config wrong: %+v", cfg)
	}
	if _, err := os.Stat(filepath.Join(dir, "ip.txt")); !os.IsNotExist(err) {
		t.Errorf("ip.txt should be deleted, err=%v", err)
	}
}

func TestMigrateNoIPTxt(t *testing.T) {
	dir := t.TempDir()
	migrated, err := MigrateIPTxt(dir, nil)
	if err != nil {
		t.Fatalf("MigrateIPTxt with no ip.txt: %v", err)
	}
	if migrated {
		t.Error("expected migrated=false when no ip.txt")
	}
}

func TestMigrateSkipsWhenConfigPopulated(t *testing.T) {
	dir := t.TempDir()
	cfg := Config{CaptureInterfaces: []PersistedInterface{{Name: `\Device\NPF_{Y}`, Description: "Existing"}}}
	if err := WriteConfig(dir, cfg); err != nil {
		t.Fatalf("WriteConfig: %v", err)
	}
	if err := os.WriteFile(filepath.Join(dir, "ip.txt"), []byte("192.168.1.42\n"), 0o644); err != nil {
		t.Fatalf("WriteFile ip.txt: %v", err)
	}
	resolve := func(ip string) (PersistedInterface, error) {
		t.Fatalf("resolver should not be called when config is already populated; got ip=%q", ip)
		return PersistedInterface{}, nil
	}
	migrated, err := MigrateIPTxt(dir, resolve)
	if err != nil {
		t.Fatalf("MigrateIPTxt: %v", err)
	}
	if migrated {
		t.Error("expected migrated=false when config is populated")
	}
	if _, err := os.Stat(filepath.Join(dir, "ip.txt")); !os.IsNotExist(err) {
		t.Errorf("ip.txt should be deleted, err=%v", err)
	}
	got, err := ReadConfig(dir)
	if err != nil {
		t.Fatalf("ReadConfig: %v", err)
	}
	if len(got.CaptureInterfaces) != 1 || got.CaptureInterfaces[0].Description != "Existing" {
		t.Errorf("network.json should be unchanged, got %+v", got)
	}
}

func TestMigrateEmptyIPTxt(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "ip.txt"), []byte("  \n"), 0o644); err != nil {
		t.Fatalf("WriteFile ip.txt: %v", err)
	}
	resolve := func(ip string) (PersistedInterface, error) {
		t.Fatalf("resolver should not be called for whitespace-only ip.txt; got ip=%q", ip)
		return PersistedInterface{}, nil
	}
	migrated, err := MigrateIPTxt(dir, resolve)
	if err != nil {
		t.Fatalf("MigrateIPTxt: %v", err)
	}
	if migrated {
		t.Error("expected migrated=false for empty ip.txt")
	}
	if _, err := os.Stat(filepath.Join(dir, "ip.txt")); !os.IsNotExist(err) {
		t.Errorf("ip.txt should be deleted, err=%v", err)
	}
}

func TestMigrateNilResolverWithNonEmptyIPTxt(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "ip.txt"), []byte("192.168.1.42"), 0o644); err != nil {
		t.Fatalf("WriteFile ip.txt: %v", err)
	}
	migrated, err := MigrateIPTxt(dir, nil)
	if err == nil {
		t.Fatal("expected error when resolver is nil and ip.txt has content")
	}
	if migrated {
		t.Error("expected migrated=false")
	}
	if msg := err.Error(); !strings.Contains(msg, "no IP resolver") {
		t.Errorf("error message %q should mention missing resolver", msg)
	}
	if _, err := os.Stat(filepath.Join(dir, "ip.txt")); err != nil {
		t.Errorf("ip.txt should be preserved for retry, err=%v", err)
	}
}

func TestMigrateResolverError(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "ip.txt"), []byte("10.0.0.1"), 0o644); err != nil {
		t.Fatalf("WriteFile ip.txt: %v", err)
	}
	resolverErr := errors.New("interface not found")
	resolve := func(ip string) (PersistedInterface, error) {
		return PersistedInterface{}, resolverErr
	}
	migrated, err := MigrateIPTxt(dir, resolve)
	if err == nil {
		t.Fatal("expected error when resolver fails")
	}
	if migrated {
		t.Error("expected migrated=false")
	}
	if !errors.Is(err, resolverErr) {
		t.Errorf("error chain should wrap resolver error, got %v", err)
	}
	if _, err := os.Stat(filepath.Join(dir, "ip.txt")); !os.IsNotExist(err) {
		t.Errorf("ip.txt should be deleted on resolver error, err=%v", err)
	}
}

func TestMigrateMalformedConfigErrors(t *testing.T) {
	dir := t.TempDir()
	malformed := []byte("{not json")
	if err := os.WriteFile(filepath.Join(dir, "network.json"), malformed, 0o644); err != nil {
		t.Fatalf("WriteFile network.json: %v", err)
	}
	if err := os.WriteFile(filepath.Join(dir, "ip.txt"), []byte("192.168.1.42"), 0o644); err != nil {
		t.Fatalf("WriteFile ip.txt: %v", err)
	}
	resolve := func(ip string) (PersistedInterface, error) {
		t.Fatalf("resolver should not be called when config is malformed; got ip=%q", ip)
		return PersistedInterface{}, nil
	}
	migrated, err := MigrateIPTxt(dir, resolve)
	if err == nil {
		t.Fatal("expected error when network.json is malformed")
	}
	if migrated {
		t.Error("expected migrated=false")
	}
	if _, err := os.Stat(filepath.Join(dir, "ip.txt")); err != nil {
		t.Errorf("ip.txt should be preserved for recovery, err=%v", err)
	}
	got, err := os.ReadFile(filepath.Join(dir, "network.json"))
	if err != nil {
		t.Fatalf("ReadFile network.json: %v", err)
	}
	if string(got) != string(malformed) {
		t.Errorf("network.json should not be overwritten, got %q want %q", got, malformed)
	}
}

func TestConfigLoggingRoundTrip(t *testing.T) {
	dir := t.TempDir()
	cfg := Config{
		Logging: LoggingConfig{
			ServerLogsEnabled: true,
			PcapRecording:     true,
		},
	}
	if err := WriteConfig(dir, cfg); err != nil {
		t.Fatalf("WriteConfig: %v", err)
	}
	got, err := ReadConfig(dir)
	if err != nil {
		t.Fatalf("ReadConfig: %v", err)
	}
	if !got.Logging.ServerLogsEnabled {
		t.Error("Logging.ServerLogsEnabled: got false, want true")
	}
	if !got.Logging.PcapRecording {
		t.Error("Logging.PcapRecording: got false, want true")
	}
}

func TestConfigMissingLoggingKey(t *testing.T) {
	dir := t.TempDir()
	body := []byte(`{"captureInterfaces":[]}`)
	if err := os.WriteFile(filepath.Join(dir, "network.json"), body, 0o644); err != nil {
		t.Fatalf("WriteFile: %v", err)
	}
	got, err := ReadConfig(dir)
	if err != nil {
		t.Fatalf("ReadConfig: %v", err)
	}
	if got.Logging.ServerLogsEnabled {
		t.Error("Logging.ServerLogsEnabled: got true, want false (zero value)")
	}
	if got.Logging.PcapRecording {
		t.Error("Logging.PcapRecording: got true, want false (zero value)")
	}
}

func TestConfigLoggingExplicitFalseRoundTrip(t *testing.T) {
	dir := t.TempDir()
	cfg := Config{
		Logging: LoggingConfig{
			ServerLogsEnabled: false,
			PcapRecording:     false,
		},
	}
	if err := WriteConfig(dir, cfg); err != nil {
		t.Fatalf("WriteConfig: %v", err)
	}
	got, err := ReadConfig(dir)
	if err != nil {
		t.Fatalf("ReadConfig: %v", err)
	}
	if got.Logging.ServerLogsEnabled {
		t.Error("Logging.ServerLogsEnabled: got true, want false")
	}
	if got.Logging.PcapRecording {
		t.Error("Logging.PcapRecording: got true, want false")
	}
}

func TestMutateConfig_PreservesUntouchedFields(t *testing.T) {
	dir := t.TempDir()
	seed := Config{
		CaptureInterfaces: []PersistedInterface{{Name: "X", Description: "Y"}},
		Logging:           LoggingConfig{ServerLogsEnabled: true, PcapRecording: true},
	}
	if err := WriteConfig(dir, seed); err != nil {
		t.Fatalf("WriteConfig: %v", err)
	}

	if err := MutateConfig(dir, func(c *Config) {
		c.Logging.PcapRecording = false
	}); err != nil {
		t.Fatalf("MutateConfig: %v", err)
	}

	got, err := ReadConfig(dir)
	if err != nil {
		t.Fatalf("ReadConfig: %v", err)
	}
	if len(got.CaptureInterfaces) != 1 || got.CaptureInterfaces[0].Name != "X" {
		t.Errorf("CaptureInterfaces changed: %+v", got.CaptureInterfaces)
	}
	if !got.Logging.ServerLogsEnabled {
		t.Error("Logging.ServerLogsEnabled was reset; MutateConfig must preserve untouched fields")
	}
	if got.Logging.PcapRecording {
		t.Error("Logging.PcapRecording: want false after mutation, got true")
	}
}

func TestWriteConfigOverwritesAtomically(t *testing.T) {
	dir := t.TempDir()
	cfg1 := Config{CaptureInterfaces: []PersistedInterface{{Name: "A", Description: "First"}}}
	if err := WriteConfig(dir, cfg1); err != nil {
		t.Fatal(err)
	}
	cfg2 := Config{CaptureInterfaces: []PersistedInterface{{Name: "B", Description: "Second"}}}
	if err := WriteConfig(dir, cfg2); err != nil {
		t.Fatal(err)
	}
	got, _ := ReadConfig(dir)
	if got.CaptureInterfaces[0].Description != "Second" {
		t.Errorf("overwrite failed, got %+v", got)
	}
	entries, _ := os.ReadDir(dir)
	for _, e := range entries {
		if filepath.Ext(e.Name()) == ".tmp" {
			t.Errorf("leftover tmp file: %s", e.Name())
		}
	}
	data, _ := os.ReadFile(filepath.Join(dir, "network.json"))
	var raw map[string]any
	if err := json.Unmarshal(data, &raw); err != nil {
		t.Errorf("network.json not valid JSON: %v", err)
	}
}
