package server

import (
	jsonv1 "encoding/json"
	"encoding/json/jsontext"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/google/gopacket"
	"github.com/google/gopacket/layers"
	"github.com/google/gopacket/pcapgo"
	"github.com/stretchr/testify/require"

	"github.com/nospy/albion-openradar/internal/photon"
)

func replayFixtures(t *testing.T) []any {
	t.Helper()
	ws := &WebSocketHandler{}
	parser := photon.NewPhotonParser(
		func(e *photon.EventData) { photon.PostProcessEvent(e); ws.BroadcastEvent(e) },
		func(r *photon.OperationRequest) { photon.PostProcessRequest(r); ws.BroadcastRequest(r) },
		func(r *photon.OperationResponse) { photon.PostProcessResponse(r); ws.BroadcastResponse(r) },
	)
	files, err := filepath.Glob(filepath.Join("..", "photon", "testdata", "*.pcap"))
	require.NoError(t, err)
	require.NotEmpty(t, files)
	for _, path := range files {
		f, err := os.Open(path)
		require.NoError(t, err)
		reader, err := pcapgo.NewReader(f)
		require.NoError(t, err)
		for {
			data, _, err := reader.ReadPacketData()
			if err != nil {
				break
			}
			pkt := gopacket.NewPacket(data, layers.LayerTypeEthernet, gopacket.Default)
			if udp, ok := pkt.Layer(layers.LayerTypeUDP).(*layers.UDP); ok {
				parser.ReceivePacket(udp.Payload)
			}
		}
		f.Close()
	}
	require.NotEmpty(t, ws.batchBuffer)
	return ws.batchBuffer
}

func canonical(t *testing.T, b []byte) string {
	t.Helper()
	v := jsontext.Value(b)
	require.NoError(t, v.Canonicalize())
	return string(v)
}

// pcap-derived
func TestEncodeBatch_MatchesStdlibV1_OnPcapFixtures(t *testing.T) {
	msgs := replayFixtures(t)
	for start := 0; start < len(msgs); start += MaxBatchSize {
		batch := msgs[start:min(start+MaxBatchSize, len(msgs))]
		got, err := encodeBatch(batch)
		require.NoError(t, err)
		want, err := jsonv1.Marshal(&WSBatchMessage{Type: "batch", Messages: batch})
		require.NoError(t, err)
		require.Equal(t, canonical(t, want), canonical(t, got), "batch starting at message %d", start)
	}
}

// synthetic
func TestEncodeBatch_InvalidUTF8_ReplacedNotRejected(t *testing.T) {
	ws := &WebSocketHandler{}
	ws.BroadcastEvent(&photon.EventData{Code: 1, Parameters: map[byte]any{1: "ab\xffcd"}})
	got, err := encodeBatch(ws.batchBuffer)
	require.NoError(t, err)
	require.Contains(t, string(got), "ab�cd")
}

// synthetic
func TestEncodeBatch_NilMapAndSlice_AsNull(t *testing.T) {
	ws := &WebSocketHandler{}
	ws.BroadcastEvent(&photon.EventData{Code: 1, Parameters: nil})
	ws.BroadcastEvent(&photon.EventData{Code: 2, Parameters: map[byte]any{0: []any(nil)}})
	got, err := encodeBatch(ws.batchBuffer)
	require.NoError(t, err)
	s := string(got)
	require.True(t, strings.Contains(s, `"parameters":null`), s)
	require.True(t, strings.Contains(s, `"0":null`), s)
}

// synthetic
func TestParseClientLogs(t *testing.T) {
	require.Len(t, parseClientLogs([]byte(`{"type":"logs","logs":["\ud800x", 2]}`)), 2)
	require.Nil(t, parseClientLogs([]byte(`{"type":"ping"}`)))
	require.Nil(t, parseClientLogs([]byte(`not json`)))
}
