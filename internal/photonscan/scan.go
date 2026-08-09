// Package photonscan walks a pcap and hands back every decoded Photon message
// with its Albion code, so tools can reason about parameters rather than bytes.
package photonscan

import (
	"errors"
	"fmt"
	"io"
	"os"

	"github.com/google/gopacket"
	"github.com/google/gopacket/layers"
	"github.com/google/gopacket/pcapgo"

	"github.com/nospy/albion-openradar/internal/photon"
)

type Kind int

const (
	KindEvent Kind = iota
	KindRequest
	KindResponse
)

func (k Kind) String() string {
	switch k {
	case KindEvent:
		return "ev"
	case KindRequest:
		return "req"
	case KindResponse:
		return "res"
	}
	return "?"
}

type Message struct {
	Kind   Kind
	Code   int
	Params map[byte]any
}

// codeKey is the parameter holding the Albion code. The byte on the wire is
// the Photon message code, which is 1 for almost everything.
func codeKey(kind Kind) byte {
	if kind == KindEvent {
		return 252
	}
	return 253
}

func Scan(path string, visit func(Message)) error {
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()

	reader, err := pcapgo.NewReader(f)
	if err != nil {
		return fmt.Errorf("read %s: %w", path, err)
	}

	emit := func(kind Kind, params map[byte]any) {
		visit(Message{Kind: kind, Code: codeOf(params, codeKey(kind)), Params: params})
	}

	parser := photon.NewPhotonParser(
		func(e *photon.EventData) { emit(KindEvent, e.Parameters) },
		func(r *photon.OperationRequest) { emit(KindRequest, r.Parameters) },
		func(r *photon.OperationResponse) { emit(KindResponse, r.Parameters) },
	)

	for {
		data, _, err := reader.ReadPacketData()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			break
		}
		pkt := gopacket.NewPacket(data, reader.LinkType(), gopacket.Default)
		udp, _ := pkt.Layer(layers.LayerTypeUDP).(*layers.UDP)
		if udp == nil {
			continue
		}
		parser.ReceivePacket(udp.Payload)
	}
	return nil
}

func codeOf(params map[byte]any, key byte) int {
	switch t := params[key].(type) {
	case byte:
		return int(t)
	case int16:
		return int(t)
	case int32:
		return int(t)
	case int64:
		return int(t)
	case int:
		return t
	}
	return -1
}

// StringsIn flattens a parameter value into the strings it carries, so a
// caller does not have to know whether a field holds one name or a list.
func StringsIn(v any) []string {
	var out []string
	switch t := v.(type) {
	case string:
		if t != "" {
			out = append(out, t)
		}
	case []string:
		for _, item := range t {
			out = append(out, StringsIn(item)...)
		}
	case []any:
		for _, item := range t {
			out = append(out, StringsIn(item)...)
		}
	}
	return out
}
