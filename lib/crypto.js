import crypto from 'node:crypto';

/**
 * Generates a random 256-bit (32-byte) master key.
 * @returns {Buffer}
 */
export function generateMasterKey() {
    return crypto.randomBytes(32);
}

/**
 * Encrypts a buffer using AES-256-GCM.
 * @param {Buffer} buffer - Data to encrypt.
 * @param {Buffer} key - 32-byte key.
 * @returns {Object} { iv, authTag, encryptedData }
 */
export function encryptBuffer(buffer, key) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    const encryptedData = Buffer.concat([
        cipher.update(buffer),
        cipher.final()
    ]);

    const authTag = cipher.getAuthTag();

    return {
        iv,
        authTag,
        encryptedData
    };
}

/**
 * Decrypts a buffer using AES-256-GCM.
 * @param {Buffer} encryptedData 
 * @param {Buffer} key 
 * @param {Buffer} iv 
 * @param {Buffer} authTag 
 * @returns {Buffer} Original data.
 */
export function decryptBuffer(encryptedData, key, iv, authTag) {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([
        decipher.update(encryptedData),
        decipher.final()
    ]);
}

/**
 * Splits a 32-byte key into two fragments using XOR.
 * Fragment A ^ Fragment B = Original Key.
 * @param {Buffer} key 
 * @returns {Object} { fragmentA, fragmentB }
 */
export function splitKey(key) {
    const fragmentA = crypto.randomBytes(32);
    const fragmentB = Buffer.alloc(32);

    for (let i = 0; i < 32; i++) {
        fragmentB[i] = key[i] ^ fragmentA[i];
    }

    return { fragmentA, fragmentB };
}

/**
 * Combines two fragments to reconstruct the original key.
 * @param {Buffer} fragmentA 
 * @param {Buffer} fragmentB 
 * @returns {Buffer} Original key.
 */
export function combineKeys(fragmentA, fragmentB) {
    const key = Buffer.alloc(32);

    for (let i = 0; i < 32; i++) {
        key[i] = fragmentA[i] ^ fragmentB[i];
    }

    return key;
}
