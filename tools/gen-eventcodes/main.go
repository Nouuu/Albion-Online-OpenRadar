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
	root, err := findRepoRoot()
	if err != nil {
		return err
	}
	for _, s := range specs {
		if err := generate(root, s); err != nil {
			return err
		}
	}
	return nil
}

// findRepoRoot walks up from the current working directory looking for a
// go.mod file. That lets `go generate` invoke the generator from any package
// directory while keeping spec paths repo-relative.
func findRepoRoot() (string, error) {
	dir, err := os.Getwd()
	if err != nil {
		return "", err
	}
	for {
		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			return dir, nil
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return "", fmt.Errorf("go.mod not found above %s", dir)
		}
		dir = parent
	}
}

func generate(root string, s spec) error {
	sourcePath := filepath.Join(root, filepath.FromSlash(s.Source))
	raw, err := os.ReadFile(sourcePath)
	if err != nil {
		return fmt.Errorf("read source %s: %w", sourcePath, err)
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

	targetPath := filepath.Join(root, filepath.FromSlash(s.Target))
	if err := os.MkdirAll(filepath.Dir(targetPath), 0o755); err != nil {
		return fmt.Errorf("mkdir %s: %w", filepath.Dir(targetPath), err)
	}
	if err := os.WriteFile(targetPath, out.Bytes(), 0o644); err != nil {
		return fmt.Errorf("write target %s: %w", targetPath, err)
	}
	fmt.Printf("wrote %d constants to %s\n", len(entries), targetPath)
	return nil
}
