package photon

// PhotonPacket represents a parsed Photon protocol packet
type PhotonPacket struct {
	PeerID       uint16
	Flags        uint8
	CommandCount uint8
	Timestamp    uint32
	Challenge    uint32
	Commands     []*Command
}

// ParsePacket parses a raw UDP payload into a PhotonPacket
func ParsePacket(payload []byte) (*PhotonPacket, error) {
	if len(payload) < 12 {
		return nil, nil // Too small to be valid
	}

	reader := NewReader(payload)
	packet := &PhotonPacket{}

	// Parse header (12 bytes)
	// - peer id (2 bytes)
	// - flags (1 byte)
	// - commands count (1 byte)
	// - timestamp (4 bytes)
	// - challenge (4 bytes)
	var err error
	packet.PeerID, err = reader.ReadUint16BE()
	if err != nil {
		return nil, err
	}

	packet.Flags, err = reader.ReadUint8()
	if err != nil {
		return nil, err
	}

	packet.CommandCount, err = reader.ReadUint8()
	if err != nil {
		return nil, err
	}

	packet.Timestamp, err = reader.ReadUint32BE()
	if err != nil {
		return nil, err
	}

	packet.Challenge, err = reader.ReadUint32BE()
	if err != nil {
		return nil, err
	}

	// Parse commands
	for i := 0; i < int(packet.CommandCount); i++ {
		cmd, err := ParseCommand(reader)
		if err != nil {
			// Stop parsing on error but keep what we have
			break
		}
		if cmd != nil {
			packet.Commands = append(packet.Commands, cmd)
		}
	}

	return packet, nil
}
