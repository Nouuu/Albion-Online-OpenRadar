// Throwaway analysis script: dumps every Photon event/request/response in a pcap as one JSON
// line, so we can grep for a known string (a portal's target zone name) or scan for plausible
// countdown-like numeric fields around it. Not part of the build; delete after use.
package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"

	"github.com/google/gopacket"
	"github.com/google/gopacket/layers"
	"github.com/google/gopacket/pcapgo"

	"github.com/nospy/albion-openradar/internal/photon"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "usage: tmp-dump-portal <capture.anon.pcap>")
		os.Exit(2)
	}
	path := os.Args[1]

	enc := json.NewEncoder(os.Stdout)

	parser := photon.NewPhotonParser(
		func(e *photon.EventData) {
			photon.PostProcessEvent(e)
			_ = enc.Encode(map[string]interface{}{"kind": "event", "code": e.Code, "params": e.Parameters})
		},
		func(r *photon.OperationRequest) {
			photon.PostProcessRequest(r)
			_ = enc.Encode(map[string]interface{}{"kind": "request", "code": r.OperationCode, "params": r.Parameters})
		},
		func(r *photon.OperationResponse) {
			photon.PostProcessResponse(r)
			_ = enc.Encode(map[string]interface{}{"kind": "response", "code": r.OperationCode, "params": r.Parameters})
		},
	)

	f, err := os.Open(path)
	if err != nil {
		fmt.Fprintln(os.Stderr, "open:", err)
		os.Exit(1)
	}
	defer f.Close()

	r, err := pcapgo.NewReader(f)
	if err != nil {
		fmt.Fprintln(os.Stderr, "pcap reader:", err)
		os.Exit(1)
	}

	for {
		data, _, err := r.ReadPacketData()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			fmt.Fprintln(os.Stderr, "read packet:", err)
			os.Exit(1)
		}
		pkt := gopacket.NewPacket(data, r.LinkType(), gopacket.Default)
		udp, _ := pkt.Layer(layers.LayerTypeUDP).(*layers.UDP)
		if udp == nil {
			continue
		}
		parser.ReceivePacket(udp.Payload)
	}
}
