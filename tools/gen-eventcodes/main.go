// Command gen-eventcodes regenerates the Go mirrors of the two JS enum files
// used by the radar: web/scripts/utils/EventCodes.js and OperationCodes.js.
//
// The JS files are the committed single source of truth. Run
// `go generate ./internal/photon/eventcodes/...` (and the operationcodes
// counterpart) after editing them to rebuild the Go mirrors.
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

type spec struct {
	Source  string
	Target  string
	Package string
}

var specs = []spec{
	{Source: "web/scripts/utils/EventCodes.js", Target: "internal/photon/eventcodes/eventcodes.go", Package: "eventcodes"},
	{Source: "web/scripts/utils/OperationCodes.js", Target: "internal/photon/operationcodes/operationcodes.go", Package: "operationcodes"},
}

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run() error {
	for _, s := range specs {
		if err := generate(s); err != nil {
			return err
		}
	}
	return nil
}

func generate(s spec) error {
	raw, err := os.ReadFile(filepath.Clean(s.Source))
	if err != nil {
		return fmt.Errorf("read source %s: %w", s.Source, err)
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
		return fmt.Errorf("no entries parsed from %s", s.Source)
	}

	sort.SliceStable(entries, func(i, j int) bool { return entries[i].Value < entries[j].Value })

	var out bytes.Buffer
	fmt.Fprintf(&out, "// Code generated from %s by tools/gen-eventcodes. DO NOT EDIT.\n", s.Source)
	fmt.Fprintln(&out)
	fmt.Fprintf(&out, "package %s\n", s.Package)
	fmt.Fprintln(&out)
	fmt.Fprintln(&out, "// Constants are untyped so they can be compared against byte, int, or any")
	fmt.Fprintln(&out, "// integer type a consumer uses to hold the Albion code.")
	fmt.Fprintln(&out, "const (")
	for _, e := range entries {
		fmt.Fprintf(&out, "\t%s = %d\n", e.Name, e.Value)
	}
	fmt.Fprintln(&out, ")")

	target := filepath.Clean(s.Target)
	if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
		return fmt.Errorf("mkdir %s: %w", filepath.Dir(target), err)
	}
	if err := os.WriteFile(target, out.Bytes(), 0o644); err != nil {
		return fmt.Errorf("write target %s: %w", target, err)
	}
	fmt.Printf("wrote %d constants to %s\n", len(entries), target)
	return nil
}
