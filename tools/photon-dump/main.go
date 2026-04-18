// photon-dump extracts per-scenario fixtures from an anonymized Photon pcap.
//
// Produces two corpora:
//   internal/photon/testdata/<handler>/<scenario>.pcap  (small anonymized pcap fragments)
//   web/scripts/__fixtures__/ws/<handler>/<scenario>.json  (WS-level JSON for Vitest)
//
// Usage:
//   photon-dump -in capture.anon.pcap -out-go internal/photon/testdata -out-js web/scripts/__fixtures__/ws
//   photon-dump -in capture.anon.pcap -inventory docs/technical/PROTOCOL18_OBSERVED_CODES.md
package main

import (
	"flag"
	"fmt"
	"os"
)

func main() {
	var (
		in        = flag.String("in", "", "input anonymized pcap")
		outGo     = flag.String("out-go", "", "output dir for .pcap fragments")
		outJS     = flag.String("out-js", "", "output dir for .json WS-level fixtures")
		inventory = flag.String("inventory", "", "if set, write census markdown to this path and skip extraction")
	)
	flag.Parse()

	if *in == "" {
		fmt.Fprintln(os.Stderr, "photon-dump: -in is required")
		os.Exit(2)
	}

	if *inventory != "" {
		if err := runInventory(*in, *inventory); err != nil {
			fmt.Fprintln(os.Stderr, "inventory:", err)
			os.Exit(1)
		}
		return
	}

	if *outGo == "" || *outJS == "" {
		fmt.Fprintln(os.Stderr, "photon-dump: -out-go and -out-js are required when not running -inventory")
		os.Exit(2)
	}

	if err := runExtract(*in, *outGo, *outJS, scenarios); err != nil {
		fmt.Fprintln(os.Stderr, "extract:", err)
		os.Exit(1)
	}
}
