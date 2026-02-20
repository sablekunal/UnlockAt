/**
 * Browser-compatible cryptographic engine using Web Crypto API.
 */

export async function generateMasterKey() {
    return await window.crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );
}

export async function encryptBuffer(buffer, key) {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encryptedData = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        buffer
    );

    return {
        iv,
        encryptedData: new Uint8Array(encryptedData),
    };
}

export async function decryptBuffer(encryptedData, key, iv) {
    const decryptedData = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        encryptedData
    );

    return new Uint8Array(decryptedData);
}

export async function splitKey(key) {
    const rawKey = await window.crypto.subtle.exportKey('raw', key);
    const keyBytes = new Uint8Array(rawKey);

    const fragmentA = window.crypto.getRandomValues(new Uint8Array(32));
    const fragmentB = new Uint8Array(32);

    for (let i = 0; i < 32; i++) {
        fragmentB[i] = keyBytes[i] ^ fragmentA[i];
    }

    return { fragmentA, fragmentB };
}

export async function combineKeys(fragmentA, fragmentB) {
    const keyBytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
        keyBytes[i] = fragmentA[i] ^ fragmentB[i];
    }

    return await window.crypto.subtle.importKey(
        'raw',
        keyBytes,
        'AES-GCM',
        true,
        ['encrypt', 'decrypt']
    );
}

export function bufToHex(buffer) {
    return Array.from(buffer)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

export function hexToBuf(hex) {
    return new Uint8Array(hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
}
