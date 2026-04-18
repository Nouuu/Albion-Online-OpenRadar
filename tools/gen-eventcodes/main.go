// Command gen-eventcodes regenerates internal/photon/eventcodes/eventcodes.go
// from web/scripts/utils/EventCodes.js.
//
// web/scripts/utils/EventCodes.js is the single source of truth for Albion
// event codes. Run `go generate ./internal/photon/eventcodes/...` to rebuild
// the Go mirror after editing the JS file.
package main

import (
	"bytes"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run() error {
	source := filepath.Clean("web/scripts/utils/EventCodes.js")
	target := filepath.Clean("internal/photon/eventcodes/eventcodes.go")

	raw, err := os.ReadFile(source)
	if err != nil {
		return fmt.Errorf("read source %s: %w", source, err)
	}

	entryRe := regexp.MustCompile(`^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(\d+)\s*,?\s*$`)
	type entry struct {
		Name  string
		Value int
	}
	var entries []entry
	for _, line := range bytes.Split(raw, []byte("\n")) {
		m := entryRe.FindSubmatch(line)
		if m == nil {
			continue
		}
		v, err := strconv.Atoi(string(m[2]))
		if err != nil {
			return fmt.Errorf("parse value for %s: %w", string(m[1]), err)
		}
		entries = append(entries, entry{Name: string(m[1]), Value: v})
	}
	if len(entries) == 0 {
		return fmt.Errorf("no entries parsed from %s", source)
	}

	sort.SliceStable(entries, func(i, j int) bool { return entries[i].Value < entries[j].Value })

	var out bytes.Buffer
	fmt.Fprintln(&out, "// Code generated from web/scripts/utils/EventCodes.js by tools/gen-eventcodes. DO NOT EDIT.")
	fmt.Fprintln(&out)
	fmt.Fprintln(&out, "package eventcodes")
	fmt.Fprintln(&out)
	fmt.Fprintln(&out, "// Constants are untyped so they can be compared against byte, int, or any")
	fmt.Fprintln(&out, "// integer type a consumer uses to hold the Albion event code.")
	fmt.Fprintln(&out, "const (")
	for _, e := range entries {
		fmt.Fprintf(&out, "\t%s = %d\n", e.Name, e.Value)
	}
	fmt.Fprintln(&out, ")")

	if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
		return fmt.Errorf("mkdir %s: %w", filepath.Dir(target), err)
	}
	if err := os.WriteFile(target, out.Bytes(), 0o644); err != nil {
		return fmt.Errorf("write target %s: %w", target, err)
	}
	fmt.Printf("wrote %d constants to %s\n", len(entries), target)
	return nil
}
