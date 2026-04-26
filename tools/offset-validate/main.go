// offset-validate dumps every NewMob event's (typeId, HP, AP, movespeed) tuple
// from one or more pcap files. Diagnostic-only; prints JSONL to stdout.
package main

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/nospy/albion-openradar/internal/photon"
	"github.com/nospy/albion-openradar/internal/photon/eventcodes"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "usage: offset-validate <pcap> [<pcap>...]")
		os.Exit(2)
	}
	enc := json.NewEncoder(os.Stdout)
	totalEvents := 0
	totalNewMob := 0
	for _, path := range os.Args[1:] {
		source := path
		parser := photon.NewPhotonParser(
			func(ev *photon.EventData) {
				if ev == nil {
					return
				}
				totalEvents++
				if intFromParam(ev.Parameters[252]) != eventcodes.NewMob {
					return
				}
				totalNewMob++
				_ = enc.Encode(map[string]any{
					"source":  source,
					"typeId":  ev.Parameters[1],
					"hp":      ev.Parameters[13],
					"ap":      ev.Parameters[18],
					"ms":      ev.Parameters[11],
					"enchant": ev.Parameters[33],
				})
			},
			nil, nil,
		)
		if err := iterate(path, parser.ReceivePacket); err != nil {
			fmt.Fprintf(os.Stderr, "pcap %s: %v\n", path, err)
		}
	}
	fmt.Fprintf(os.Stderr, "totalEvents=%d totalNewMob=%d\n", totalEvents, totalNewMob)
}
