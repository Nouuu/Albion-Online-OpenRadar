// 🔍 DEBUG: Check if global.loggerServer exists when module loads
console.log('🔍 [Protocol16Deserializer] Module loading, global.loggerServer exists?', !!global.loggerServer);

class Protocol16Deserializer {
    static protocol16Type = require('../enumerations/Protocol16Type.json');

    // Get logger instance - ALWAYS use global.loggerServer (no fallback)
    static getLogger() {
        const logger = global.loggerServer || null;
        if (!logger) {
            console.warn('⚠️ [Protocol16Deserializer] global.loggerServer is NULL!');
        }
        return logger;
    }

    static deserialize(input, typeCode) {
        switch (typeCode) {
            case this.protocol16Type.Unknown:
            case this.protocol16Type.Null:
                return null;
            case this.protocol16Type.Byte:
                return this.deserializeByte(input);
            case this.protocol16Type.Boolean:
                return this.deserializeBoolean(input);
            case this.protocol16Type.Short:
                return this.deserializeShort(input);
            case this.protocol16Type.Integer:
                return this.deserializeInteger(input);
            case this.protocol16Type.IntegerArray:
                return this.deserializeIntegerArray(input);
            case this.protocol16Type.Double:
                return this.deserializeDouble(input);
            case this.protocol16Type.Long:
                return this.deserializeLong(input);
            case this.protocol16Type.Float:
                return this.deserializeFloat(input);
            case this.protocol16Type.String:
                return this.deserializeString(input);
            case this.protocol16Type.StringArray:
                return this.deserializeStringArray(input);
            case this.protocol16Type.ByteArray:
                return this.deserializeByteArray(input);
            case this.protocol16Type.EventData:
                return this.deserializeEventData(input);
            case this.protocol16Type.Dictionary:
                return this.deserializeDictionary(input);
            case this.protocol16Type.Array:
                return this.deserializeArray(input);
            case this.protocol16Type.OperationResponse:
                return this.deserializeOperationResponse(input);
            case this.protocol16Type.OperationRequest:
                return this.deserializeOperationRequest(input);
            case this.protocol16Type.Hashtable:
                return this.deserializeHashtable(input);
            case this.protocol16Type.ObjectArray:
                return this.deserializeObjectArray(input);
            default:
                throw new Error(`Type code: ${typeCode} not implemented.`);
        }
    }

    static deserializeByte(input) {
        return input.readUInt8();
    }

    static deserializeBoolean(input) {
        return input.readUInt8() != 0;
    }

    static deserializeInteger(input) {
        return input.readUInt32BE();
    }

    static deserializeIntegerArray(input) {
        const size = this.deserializeInteger(input);
        let res = []

        for (let i = 0; i < size; i++) {
            res.push(this.deserializeInteger(input));
        }

        return res;
    }

    static deserializeShort(input) {
        return input.readUInt16BE();
    }

    static deserializeDouble(input) {
        return input.readDoubleBE();
    }

    static deserializeLong(input) {
        const res = input.buffer.readBigInt64BE(input.tell());
        input.seek(input.tell() + 8);

        return res;
    }

    static deserializeFloat(input) {
        return input.readFloatBE();
    }

    static deserializeString(input) {
        const stringSize = this.deserializeShort(input);
        if (stringSize === 0) return "";

        const res = input.toString('utf8', stringSize);

        return res;
    }

    static deserializeByteArray(input) {
        const arraySize = input.readUInt32BE();

        return input.slice(arraySize).buffer;
    }

    static deserializeArray(input) {
        const size = this.deserializeShort(input);
        const typeCode = this.deserializeByte(input);
        const res = [];

        for (let i = 0; i < size; i++) {
            res.push(this.deserialize(input, typeCode));
        }

        return res;
    }

    static deserializeStringArray(input) {
        const size = this.deserializeShort(input);
        let res = [];

        for (let i = 0; i < size; i++) {
            res.push(this.deserializeString(input));
        }

        return res;
    }

    static deserializeObjectArray(input) {
        const tableSize = this.deserializeShort(input);
        let ouput = [];

        for (let i = 0; i < tableSize; i++) {
            const typeCode = this.deserializeByte(input);
            ouput[i] = deserialize(input, typeCode);
        }

        return ouput;
    }

    static deserializeHashtable(input) {
        const tableSize = this.deserializeShort(input);

        return this.deserializeDictionaryElements(input, tableSize, 0, 0);
    }

    static deserializeDictionary(input) {
        const keyTypeCode = this.deserializeByte(input);
        const valueTypeCode = this.deserializeByte(input);
        const dictionnarySize = this.deserializeShort(input);

        return this.deserializeDictionaryElements(input, dictionnarySize, keyTypeCode, valueTypeCode);
    }

    static deserializeDictionaryElements(input, dictionnarySize, keyTypeCode, valueTypeCode) {
        let output = {};

        for (let i = 0; i < dictionnarySize; i++) {
            const key = this.deserialize(input, (keyTypeCode == 0 || keyTypeCode == 42) ? this.deserializeByte(input) : keyTypeCode);
            const value = this.deserialize(input, (valueTypeCode == 0 || valueTypeCode == 42) ? this.deserializeByte(input) : valueTypeCode);
            output[key] = value;
        }

        return output;
    }

    static deserializeOperationRequest(input) {
        const operationCode = this.deserializeByte(input);
        const parameters = this.deserializeParameterTable(input);

        // 🔍 DEBUG: Check if player data might be in OperationRequest
        const logger = this.getLogger();
        if (logger && parameters[1] && typeof parameters[1] === 'string' && parameters[7] && Buffer.isBuffer(parameters[7])) {
            logger.info('PACKET_RAW', 'OperationRequest_PlayerLike', {
                operationCode: operationCode,
                name: parameters[1],
                param7_length: parameters[7].length,
                allParamKeys: Object.keys(parameters)
            });
        }

        return {operationCode, parameters};
    }

    static deserializeOperationResponse(input) {
        const operationCode = this.deserializeByte(input);
        const returnCode = this.deserializeShort(input);
        const debugMessage = this.deserialize(input, this.deserializeByte(input));
        const parameters = this.deserializeParameterTable(input);

        // 🔍 DEBUG: Check if player data might be in OperationResponse
        const logger = this.getLogger();
        if (logger && parameters[1] && typeof parameters[1] === 'string' && parameters[7] && Buffer.isBuffer(parameters[7])) {
            logger.info('PACKET_RAW', 'OperationResponse_PlayerLike', {
                operationCode: operationCode,
                returnCode: returnCode,
                name: parameters[1],
                param7_length: parameters[7].length,
                allParamKeys: Object.keys(parameters)
            });
        }

        return {operationCode, returnCode, debugMessage, parameters};
    }

    static deserializeEventData(input) {
        const code = this.deserializeByte(input);

        const parameters = this.deserializeParameterTable(input);

        // ✅ Event 3 (Move) - RESTORED ORIGINAL CODE that worked for mobs/resources
        // Simple offsets 9/13 universally - NO complex detection needed
        if (code == 3) {
            var bytes = new Uint8Array(parameters[1]);
            var position0 = new DataView(bytes.buffer, 9, 4).getFloat32(0, true);
            var position1 = new DataView(bytes.buffer, 13, 4).getFloat32(0, true);
            parameters[4] = position0;
            parameters[5] = position1;
            parameters[252] = 3;
        }

        // ✅ Event 29 (NewCharacter) - PLAYERS ONLY
        // NOTE: param[252] is ALREADY set by the protocol (not by us!)
        // Check parameters[252] AFTER deserialization, not the event code
        if (parameters[252] == 29) {
            const logger = this.getLogger();
            if (logger) {
                logger.info('PACKET_RAW', 'Event29_Detected_ServerSide', {
                    photonCode: code,
                    param252: parameters[252],
                    name: parameters[1],
                    objectId: parameters[0]
                });
            }

            // Extract player data for client handler
            // Validation: Event 29 is ALWAYS a player (never a mob)
            // Reference confirms: param[7] = Guid (16 bytes), params[19]/[20] = spawn position
            const hasGuid = parameters[7] && Buffer.isBuffer(parameters[7]) && parameters[7].length === 16;
            const hasName = parameters[1] && typeof parameters[1] === 'string' && parameters[1].length > 0;
            const hasObjectId = parameters[0] !== undefined;

            // 🔍 DEBUG: Log validation results server-side
            if (logger) {
                logger.info('PACKET_RAW', 'Event29_ServerSide_Validation', {
                    objectId: parameters[0],
                    name: parameters[1],
                    param7_exists: !!parameters[7],
                    param7_isBuffer: parameters[7] ? Buffer.isBuffer(parameters[7]) : false,
                    param7_length: parameters[7] ? parameters[7].length : 0,
                    hasGuid,
                    hasName,
                    hasObjectId,
                    validationPassed: hasGuid && hasName && hasObjectId,
                    param19: parameters[19],
                    param20: parameters[20],
                    allParamKeys: Object.keys(parameters)
                });
            }

            if (hasGuid && hasName && hasObjectId) {
                // Store structured player data for client
                parameters[253] = {
                    objectId: parameters[0],
                    name: parameters[1],
                    guid: parameters[7],  // Keep as Buffer (16 bytes) - persistent player ID
                    guild: parameters[8] || '',
                    spawnPosition: {
                        x: parameters[19] || 0,  // Float32 - confirmed by analysis
                        y: parameters[20] || 0   // Float32 - confirmed by analysis
                    }
                };

                // 🔍 DEBUG: Confirm param[253] created
                if (logger) {
                    logger.info('PACKET_RAW', 'Event29_Param253_Created', {
                        objectId: parameters[253].objectId,
                        name: parameters[253].name,
                        spawnX: parameters[253].spawnPosition.x,
                        spawnY: parameters[253].spawnPosition.y
                    });
                }
            }
        }

        return {code, parameters};
    }

    static deserializeParameterTable(input) {
        const tableSize = input.readUInt16BE(1);
        let table = {};
        let offset = 3;

        for (let i = 0; i < tableSize; i++) {
            const key = input.readUInt8(offset);
            const valueTypeCode = input.readUInt8(offset + 1);

            const value = this.deserialize(input, valueTypeCode)

            table[key] = value;
        }

        return table;
    }
}

module.exports = Protocol16Deserializer;