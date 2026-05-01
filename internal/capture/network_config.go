package capture

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

const (
	configFilename   = "network.json"
	legacyIPFilename = "ip.txt"
)

type PersistedInterface struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type LoggingConfig struct {
	ServerLogsEnabled bool `json:"serverLogsEnabled"`
	PcapRecording     bool `json:"pcapRecording"`
}

type Config struct {
	CaptureInterfaces []PersistedInterface `json:"captureInterfaces"`
	Logging           LoggingConfig        `json:"logging"`
}

func ReadConfig(appDir string) (Config, error) {
	path := filepath.Join(appDir, configFilename)
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return Config{}, nil
		}
		return Config{}, fmt.Errorf("read %s: %w", path, err)
	}
	var cfg Config
	if err := json.Unmarshal(data, &cfg); err != nil {
		return Config{}, fmt.Errorf("parse %s: %w", path, err)
	}
	return cfg, nil
}

func WriteConfig(appDir string, cfg Config) error {
	path := filepath.Join(appDir, configFilename)
	tmp := path + ".tmp"
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal config: %w", err)
	}
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return fmt.Errorf("write tmp: %w", err)
	}
	if err := os.Rename(tmp, path); err != nil {
		_ = os.Remove(tmp)
		return fmt.Errorf("rename tmp: %w", err)
	}
	return nil
}

type IPResolver func(ip string) (PersistedInterface, error)

func MigrateIPTxt(appDir string, resolve IPResolver) (bool, error) {
	ipPath := filepath.Join(appDir, legacyIPFilename)
	data, err := os.ReadFile(ipPath)
	if err != nil {
		if os.IsNotExist(err) {
			return false, nil
		}
		return false, fmt.Errorf("read %s: %w", ipPath, err)
	}
	ip := strings.TrimSpace(string(data))
	if ip == "" {
		_ = os.Remove(ipPath)
		return false, nil
	}
	existing, err := ReadConfig(appDir)
	if err != nil {
		return false, fmt.Errorf("read existing config before migration: %w", err)
	}
	if len(existing.CaptureInterfaces) > 0 {
		_ = os.Remove(ipPath)
		return false, nil
	}
	if resolve == nil {
		return false, fmt.Errorf("no IP resolver provided for migration")
	}
	entry, err := resolve(ip)
	if err != nil {
		_ = os.Remove(ipPath)
		return false, fmt.Errorf("resolve legacy ip %q: %w", ip, err)
	}
	cfg := Config{CaptureInterfaces: []PersistedInterface{entry}}
	if err := WriteConfig(appDir, cfg); err != nil {
		return false, err
	}
	_ = os.Remove(ipPath)
	return true, nil
}
