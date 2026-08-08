// List every string a capture carries, grouped by message kind, Albion code
// and parameter index. Use it to tell game identifiers apart from text a
// player typed, and to derive the identity field table anonymize-pcap uses.
//
// Usage: go run ./tools/photon-strings <file.pcap>...
package main

import (
	"fmt"
	"io"
	"os"
	"sort"

	"github.com/nospy/albion-openradar/internal/photonscan"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "usage: photon-strings <file.pcap>...")
		os.Exit(2)
	}
	for _, path := range os.Args[1:] {
		found, err := stringsIn(path)
		if err != nil {
			fmt.Fprintln(os.Stderr, "error:", err)
			os.Exit(1)
		}
		fmt.Printf("=== %s\n", path)
		report(os.Stdout, found)
	}
}

type site struct {
	kind  photonscan.Kind
	code  int
	index byte
	value string
}

func stringsIn(path string) (map[site]int, error) {
	found := map[site]int{}
	err := photonscan.Scan(path, func(m photonscan.Message) {
		for idx, v := range m.Params {
			for _, s := range photonscan.StringsIn(v) {
				found[site{kind: m.Kind, code: m.Code, index: idx, value: s}]++
			}
		}
	})
	if err != nil {
		return nil, err
	}
	return found, nil
}

func report(w io.Writer, found map[site]int) {
	sites := make([]site, 0, len(found))
	for s := range found {
		sites = append(sites, s)
	}
	sort.Slice(sites, func(i, j int) bool {
		a, b := sites[i], sites[j]
		switch {
		case a.kind != b.kind:
			return a.kind < b.kind
		case a.code != b.code:
			return a.code < b.code
		case a.index != b.index:
			return a.index < b.index
		}
		return a.value < b.value
	})

	for _, s := range sites {
		fmt.Fprintf(w, "    %-3s %4d [%d] %-45q x%d\n", s.kind, s.code, s.index, s.value, found[s])
	}
}
