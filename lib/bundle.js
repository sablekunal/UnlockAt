/**
 * Simple binary bundle format for .unlockat files.
 * [8 bytes] MAGIC: "UNLOCKAT"
 * [1 byte] VERSION: 1
 * [12 bytes] IV
 * [16 bytes] AUTH_TAG
 * [32 bytes] FRAGMENT_A
 * [4 bytes] METADATA_LEN (uint32be)
 * [N bytes] METADATA (JSON)
 * [Remaining] ENCRYPTED_DATA
 */

const MAGIC = Buffer.from('UNLOCKAT');
const VERSION = 1;

export function createBundle(encryptedData, fragmentA, iv, authTag, metadata = {}) {
    const metadataStr = JSON.stringify(metadata);
    const metadataBuf = Buffer.from(metadataStr);
    const metadataLenBuf = Buffer.alloc(4);
    metadataLenBuf.writeUInt32BE(metadataBuf.length);

    return Buffer.concat([
        MAGIC,                      // 8
        Buffer.from([VERSION]),     // 1
        iv,                         // 12
        authTag,                    // 16
        fragmentA,                  // 32
        metadataLenBuf,             // 4
        metadataBuf,                // N
        encryptedData               // Remaining
    ]);
}

export function parseBundle(buffer) {
    // Basic validation
    if (buffer.subarray(0, 8).toString() !== 'UNLOCKAT') {
        throw new Error('Not a valid .unlockat file');
    }

    let offset = 8;
    const version = buffer[offset];
    offset += 1;

    if (version !== 1) {
        throw new Error(`Unsupported bundle version: ${version}`);
    }

    const iv = buffer.subarray(offset, offset + 12);
    offset += 12;

    const authTag = buffer.subarray(offset, offset + 16);
    offset += 16;

    const fragmentA = buffer.subarray(offset, offset + 32);
    offset += 32;

    const metadataLen = buffer.readUInt32BE(offset);
    offset += 4;

    const metadataBuf = buffer.subarray(offset, offset + metadataLen);
    const metadata = JSON.parse(metadataBuf.toString());
    offset += metadataLen;

    const encryptedData = buffer.subarray(offset);

    return {
        iv,
        authTag,
        fragmentA,
        metadata,
        encryptedData
    };
}
