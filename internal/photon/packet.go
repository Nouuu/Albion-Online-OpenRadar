package photon

import (
	"encoding/binary"
	"time"
)

const (
	photonHeaderLength   = 12
	commandHeaderLength  = 12
	fragmentHeaderLength = 20

	// Caps reassembly memory at ~64 × 1 MB per parser under packet loss.
	maxPendingSegments = 64
)

const (
	cmdDisconnect     = byte(4)
	cmdSendReliable   = byte(6)
	cmdSendUnreliable = byte(7)
	cmdSendFragment   = byte(8)
)

const (
	msgRequest     = byte(2)
	msgResponse    = byte(3)
	msgEvent       = byte(4)
	msgResponseAlt = byte(7)
	msgEncrypted   = byte(131)
)

type segmentedPackage struct {
	totalLength  int
	bytesWritten int
	payload      []byte
	createdAt    time.Time
	// seenOffsets deduplicates repeated fragments under UDP loss/retransmit.
	// Without it, a duplicate fragment would bump bytesWritten twice and
	// trigger premature completion with a partially zeroed payload.
	seenOffsets map[int]struct{}
}

type PhotonParser struct {
	pendingSegments map[uint32]*segmentedPackage

	OnEvent     func(*EventData)
	OnRequest   func(*OperationRequest)
	OnResponse  func(*OperationResponse)
	OnEncrypted func()
}

func NewPhotonParser(
	onEvent func(*EventData),
	onRequest func(*OperationRequest),
	onResponse func(*OperationResponse),
) *PhotonParser {
	return &PhotonParser{
		pendingSegments: make(map[uint32]*segmentedPackage),
		OnEvent:         onEvent,
		OnRequest:       onRequest,
		OnResponse:      onResponse,
	}
}

func (p *PhotonParser) ReceivePacket(payload []byte) bool {
	if len(payload) < photonHeaderLength {
		return false
	}
	offset := 2 // skip peerId
	flags := payload[offset]
	offset++
	commandCount := int(payload[offset])
	offset++
	offset += 8 // skip timestamp + challenge

	if flags == 1 {
		if p.OnEncrypted != nil {
			p.OnEncrypted()
		}
		return false
	}

	for i := 0; i < commandCount; i++ {
		var ok bool
		offset, ok = p.handleCommand(payload, offset)
		if !ok {
			return false
		}
	}
	return true
}

func (p *PhotonParser) handleCommand(src []byte, offset int) (int, bool) {
	if !available(src, offset, commandHeaderLength) {
		return offset, false
	}
	cmdType := src[offset]
	offset += 4 // cmdType, channelId, commandFlags, reserved
	cmdLen := int(binary.BigEndian.Uint32(src[offset:]))
	offset += 4
	offset += 4 // reliableSequenceNumber
	cmdLen -= commandHeaderLength
	if cmdLen < 0 || !available(src, offset, cmdLen) {
		return offset, false
	}

	switch cmdType {
	case cmdDisconnect:
		return offset + cmdLen, true
	case cmdSendUnreliable:
		if cmdLen < 4 {
			return offset + cmdLen, false
		}
		offset += 4
		cmdLen -= 4
		return p.handleSendReliable(src, offset, cmdLen), true
	case cmdSendReliable:
		return p.handleSendReliable(src, offset, cmdLen), true
	case cmdSendFragment:
		return p.handleSendFragment(src, offset, cmdLen), true
	default:
		return offset + cmdLen, true
	}
}

func (p *PhotonParser) handleSendReliable(src []byte, offset, cmdLen int) int {
	if cmdLen < 2 || !available(src, offset, cmdLen) {
		return offset + cmdLen
	}
	offset++ // signalByte
	msgType := src[offset]
	offset++
	cmdLen -= 2

	if !available(src, offset, cmdLen) {
		return offset + cmdLen
	}

	if msgType == msgEncrypted {
		if p.OnEncrypted != nil {
			p.OnEncrypted()
		}
		return offset + cmdLen
	}

	data := src[offset : offset+cmdLen]
	offset += cmdLen

	switch msgType {
	case msgRequest:
		if req, err := DeserializeRequest(data); err == nil && p.OnRequest != nil {
			p.OnRequest(req)
		}
	case msgResponse, msgResponseAlt:
		if resp, err := DeserializeResponse(data); err == nil && p.OnResponse != nil {
			p.OnResponse(resp)
		}
	case msgEvent:
		if ev, err := DeserializeEvent(data); err == nil && p.OnEvent != nil {
			p.OnEvent(ev)
		}
	}
	return offset
}

func (p *PhotonParser) handleSendFragment(src []byte, offset, cmdLen int) int {
	if cmdLen < fragmentHeaderLength || !available(src, offset, fragmentHeaderLength) {
		return offset + cmdLen
	}

	startSeq := binary.BigEndian.Uint32(src[offset:])
	offset += 4
	cmdLen -= 4
	offset += 4 // fragmentCount
	cmdLen -= 4
	offset += 4 // fragmentNumber
	cmdLen -= 4
	totalLen := int(binary.BigEndian.Uint32(src[offset:]))
	offset += 4
	cmdLen -= 4
	fragOffset := int(binary.BigEndian.Uint32(src[offset:]))
	offset += 4
	cmdLen -= 4

	fragLen := cmdLen
	if fragLen < 0 || !available(src, offset, fragLen) ||
		totalLen < 0 || totalLen > maxArraySize*16 {
		return offset + fragLen
	}

	seg, ok := p.pendingSegments[startSeq]
	if !ok {
		p.evictIfFull()
		seg = &segmentedPackage{
			totalLength: totalLen,
			payload:     make([]byte, totalLen),
			createdAt:   time.Now(),
			seenOffsets: make(map[int]struct{}),
		}
		p.pendingSegments[startSeq] = seg
	}

	end := fragOffset + fragLen
	if _, dup := seg.seenOffsets[fragOffset]; !dup && fragOffset >= 0 && end <= len(seg.payload) {
		copy(seg.payload[fragOffset:end], src[offset:offset+fragLen])
		seg.bytesWritten += fragLen
		seg.seenOffsets[fragOffset] = struct{}{}
	}
	offset += fragLen

	if seg.bytesWritten >= seg.totalLength {
		delete(p.pendingSegments, startSeq)
		p.handleSendReliable(seg.payload, 0, len(seg.payload))
	}
	return offset
}

func (p *PhotonParser) evictIfFull() {
	if len(p.pendingSegments) < maxPendingSegments {
		return
	}
	var oldestKey uint32
	var oldestTime time.Time
	first := true
	for k, v := range p.pendingSegments {
		if first || v.createdAt.Before(oldestTime) {
			oldestKey = k
			oldestTime = v.createdAt
			first = false
		}
	}
	delete(p.pendingSegments, oldestKey)
}

func available(src []byte, offset, count int) bool {
	return count >= 0 && offset >= 0 && len(src)-offset >= count
}
