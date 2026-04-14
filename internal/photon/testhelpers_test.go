package photon

import "encoding/binary"

func newSingleCommandPhotonPacket(cmdType byte, cmdPayload []byte) []byte {
	cmdLen := commandHeaderLength + len(cmdPayload)
	pkt := make([]byte, photonHeaderLength+cmdLen)
	pkt[3] = 1 // commandCount
	pkt[photonHeaderLength] = cmdType
	binary.BigEndian.PutUint32(pkt[photonHeaderLength+4:], uint32(cmdLen))
	copy(pkt[photonHeaderLength+commandHeaderLength:], cmdPayload)
	return pkt
}

func newReliableMessagePacket(msgType byte, innerPayload []byte) []byte {
	reliable := make([]byte, 2+len(innerPayload))
	reliable[1] = msgType
	copy(reliable[2:], innerPayload)
	return newSingleCommandPhotonPacket(cmdSendReliable, reliable)
}
