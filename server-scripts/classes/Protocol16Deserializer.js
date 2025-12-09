import fs from 'fs';
import path from "path";
console.log('🔍 [Protocol16Deserializer] Module loading, global.loggerServer exists?', !!global.loggerServer);

class Protocol16Deserializer {
    // static protocol16Type = require('../enumerations/Protocol16Type.json');
    static protocol16Type = null;

    static initialize(appDir) {
    const file = fs.readFileSync(path.join(appDir, 'server-scripts/enumerations/Protocol16Type.json'), 'utf8');
    this.protocol16Type = JSON.parse(file);
        console.log('🛫 [Protocol16Deserializer] Module initialized.');
    }

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
            ouput[i] = this.deserialize(input, typeCode);
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
        return {operationCode, parameters};
    }

    static deserializeOperationResponse(input) {
        const operationCode = this.deserializeByte(input);
        const returnCode = this.deserializeShort(input);
        const debugMessage = this.deserialize(input, this.deserializeByte(input));
        const parameters = this.deserializeParameterTable(input);
        return {operationCode, returnCode, debugMessage, parameters};
    }

    static deserializeEventData(input) {
        const code = this.deserializeByte(input);
        const parameters = this.deserializeParameterTable(input);

        // Event 3 (Move) - Decode positions for mobs/resources
        // Simple float32 decode at offsets 9/13 (works for mobs, not for players)
        if (code == 3) {
            var bytes = new Uint8Array(parameters[1]);
            var position0 = new DataView(bytes.buffer, 9, 4).getFloat32(0, true);
            var position1 = new DataView(bytes.buffer, 13, 4).getFloat32(0, true);
            parameters[4] = position0;
            parameters[5] = position1;
            parameters[252] = 3;
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

export default Protocol16Deserializer;