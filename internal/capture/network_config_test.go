package capture

import (
	"encoding/json"
	"os"
	"path/filepath"
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
