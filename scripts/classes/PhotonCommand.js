const Protocol16Deserializer = require('./Protocol16Deserializer');

class PhotonCommand {
	constructor(parent, payload) {
		this.parent = parent;
		this.payload = payload;
		this.commandType = 0;
		this.channelId = 0;
		this.commandFlags = 0;
		this.commandLength = 0;
		this.sequenceNumber = 0;
		this.messageType = 0;
		this.data = {};

		this.parseCommand();
	}

	/**
	 * Parse the header of the command (12 bytes)
	 * - command type (1 byte)
	 * - channel id (1 byte)
	 * - command flags (1 byte)
	 * - Skip 1 byte
	 * - Read command length (4 byte)
	 * - Read sequence number (4 byte)
	 * - Read command type (1 byte)
	 */
	parseCommandHeader() {
		try {
			this.commandType = this.payload.readUInt8();
			this.channelId = this.payload.readUInt8();
			this.commandFlags = this.payload.readUInt8();
			this.payload.seek(this.payload.tell() + 1);
			this.commandLength = this.payload.readUInt32BE();
			this.sequenceNumber = this.payload.readUInt32BE();

			this.payload = this.payload.slice(this.commandLength - 12);
		} catch (err) {
			return;
		}
	}

	parseCommand() {
		this.parseCommandHeader();

		switch (this.commandType) {
			// Unreliable Command
			case 7:
				// Remove 4 first bytes to be reliable ¯\_(ツ)_/¯
				this.payload.seek(this.payload.tell() + 4);
				this.payload = this.payload.slice(this.payload.length - 4);
			// Reliable Command
			case 6:
				this.parseReliableCommand();
				break;
			// Disconnect
			case 4:
				break;
		  }
	}
	
	parseReliableCommand() {
		// Read message type and remove first 2 bytes of the command
		this.payload.seek(this.payload.tell() + 1);
		this.messageType = this.payload.readUInt8();
		this.payload = this.payload.slice(this.payload.length - 2);

		switch (this.messageType) {
		  case 2:
			this.data = Protocol16Deserializer.deserializeOperationRequest(this.payload);

			this.parent.parent.emit('request', this.data);
			break;
		  case 3:
			this.data = Protocol16Deserializer.deserializeOperationResponse(this.payload);

			this.parent.parent.emit('response', this.data);
			break;
		  case 4:
			this.data = Protocol16Deserializer.deserializeEventData(this.payload);

			// 🔍 TRACE: Log après désérialisation pour Event 29
			if (this.data.code === 29 && global.loggerServer) {
				global.loggerServer.warn('PACKET_RAW', 'PhotonCommand_Event29_AfterDeserialize', {
					code: this.data.code,
					param7_type: typeof this.data.parameters[7],
					param7_isBuffer: Buffer.isBuffer(this.data.parameters[7]),
					param7_isArray: Array.isArray(this.data.parameters[7]),
					param7_value: this.data.parameters[7],
					param999: this.data.parameters[999],
					param998: this.data.parameters[998],
					note: 'Event 29 AFTER Protocol16Deserializer.deserializeEventData()'
				});
			}

			this.parent.parent.emit('event', this.data);

			
			break;
		}
	}
}

module.exports = PhotonCommand;