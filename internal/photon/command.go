package photon

// Command types
const (
	CommandTypeDisconnect = 4
	CommandTypeReliable   = 6
	CommandTypeUnreliable = 7
)

// Message types (for reliable commands)
const (
	MessageTypeRequest  = 2
	MessageTypeResponse = 3
	MessageTypeEvent    = 4
)

// Command represents a parsed Photon command
type Command struct {
	CommandType    uint8
	ChannelID      uint8
	CommandFlags   uint8
	CommandLength  uint32
	SequenceNumber uint32
	MessageType    uint8
	Payload        *Reader // The remaining payload for Protocol16 deserialization
}

// ParseCommand parses a command from the reader
func ParseCommand(reader *Reader) (*Command, error) {
	if reader.Remaining() < 12 {
		return nil, nil // Not enough data
	}

	cmd := &Command{}

	// Parse command header (12 bytes)
	// - command type (1 byte)
	// - channel id (1 byte)
	// - command flags (1 byte)
	// - skip 1 byte
	// - command length (4 bytes)
	// - sequence number (4 bytes)
	var err error
	cmd.CommandType, err = reader.ReadUint8()
	if err != nil {
		return nil, err
	}

	cmd.ChannelID, err = reader.ReadUint8()
	if err != nil {
		return nil, err
	}

	cmd.CommandFlags, err = reader.ReadUint8()
	if err != nil {
		return nil, err
	}

	reader.Skip(1) // Skip 1 byte

	cmd.CommandLength, err = reader.ReadUint32BE()
	if err != nil {
		return nil, err
	}

	cmd.SequenceNumber, err = reader.ReadUint32BE()
	if err != nil {
		return nil, err
	}

	// Extract command payload (commandLength - 12 bytes header)
	payloadLen := int(cmd.CommandLength) - 12
	if payloadLen < 0 || payloadLen > reader.Remaining() {
		return nil, nil // Invalid length
	}

	payloadData, err := reader.ReadBytes(payloadLen)
	if err != nil {
		return nil, err
	}
	cmdReader := NewReader(payloadData)

	switch cmd.CommandType {
	case CommandTypeUnreliable:
		// Skip 4 bytes for unreliable, then parse as reliable
		if cmdReader.Remaining() < 4 {
			return cmd, nil
		}
		cmdReader.Skip(4)
		fallthrough

	case CommandTypeReliable:
		if err := cmd.parseReliableCommand(cmdReader); err != nil {
			return cmd, nil // Return command even if parsing fails
		}

	case CommandTypeDisconnect:
		// No additional parsing needed
	}

	return cmd, nil
}

// parseReliableCommand parses the reliable command payload
func (cmd *Command) parseReliableCommand(reader *Reader) error {
	if reader.Remaining() < 2 {
		return nil
	}

	// Skip 1 byte, read message type
	reader.Skip(1)

	msgType, err := reader.ReadUint8()
	if err != nil {
		return err
	}
	cmd.MessageType = msgType

	// Store remaining payload for Protocol16 deserialization
	remainingLen := reader.Remaining()
	if remainingLen > 0 {
		data, err := reader.ReadBytes(remainingLen)
		if err != nil {
			return err
		}
		cmd.Payload = NewReader(data)
	}

	return nil
}

// IsEvent returns true if this is an event message
func (cmd *Command) IsEvent() bool {
	return cmd.MessageType == MessageTypeEvent
}

// IsRequest returns true if this is a request message
func (cmd *Command) IsRequest() bool {
	return cmd.MessageType == MessageTypeRequest
}

// IsResponse returns true if this is a response message
func (cmd *Command) IsResponse() bool {
	return cmd.MessageType == MessageTypeResponse
}
