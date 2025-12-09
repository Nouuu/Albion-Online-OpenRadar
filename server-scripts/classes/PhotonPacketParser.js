import PhotonPacket from './PhotonPacket.js';
import { EventEmitter } from 'events';

class PhotonPacketParser extends EventEmitter {
	constructor() {
		super();
	}

	handle(buff) {
		this.emit('packet', new PhotonPacket(this, buff));
	}
}

export default PhotonPacketParser;