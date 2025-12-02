import BufferCursor from 'buffercursor';
import PhotonCommand from './PhotonCommand.js';


class PhotonPacket {
	constructor(parent, buff) {
		this.parent = parent;
		this.emit = parent.emit;
		this.payload = new BufferCursor(buff);
		this.peerId = 0;
		this.flags = 0;
		this.commandCount = 0;
		this.timestmap = 0;
		this.challenge = 0;
		this.commands = [];

		this.parsePacket();
	}

	/**
	 * Parse the header of the photon packet (12 bytes)
	 * - peer id (2 byte)
	 * - flags (1 byte)
	 * - commands count (1 byte)
	 * - timestamp (4 byte)
	 * - challenge (4 byte)
	 */
	parsePhotonHeader() {
		this.peerId = this.payload.readUInt16BE();
		this.flags = this.payload.readUInt8();
		this.commandCount = this.payload.readUInt8();
		this.timestamp = this.payload.readUInt32BE();
		this.challenge = this.payload.readUInt32BE();
	}

	parsePacket() {
		this.parsePhotonHeader();

		for (let i = 0; i < this.commandCount; i++) {
			this.commands.push(new PhotonCommand(this, this.payload));
		}
	}
}

export default PhotonPacket;