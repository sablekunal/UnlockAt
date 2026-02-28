import { generateMasterKey, encryptBuffer, splitKey, bufToHex, hexToBuf, combineKeys, decryptBuffer } from './crypto.js';

// --- State ---
let mode = 'lock'; // 'lock' or 'unlock'
let currentFile = null;
let isProcessing = false;

async function checkHealth() {
    try {
        const res = await fetch('/api/health');
        const data = await res.json();
        if (data.environment === 'production' && !data.hasPersistence) {
            addLog('🛑 CRITICAL: Vercel storage not connected!', 'error');
            addLog('Environment found: ' + data.foundVars.join(', ') || 'None', 'error');
            addLog('Please verify UNLOCKAT_REDIS_URL in Vercel.', 'error');
        } else {
            addLog(`System active. Storage: ${data.storageType}`);
        }
    } catch (e) {
        addLog('System ready (Offline mode)');
    }
}

// --- DOM Elements ---
const el = {
    modeLock: document.getElementById('mode-lock'),
    modeUnlock: document.getElementById('mode-unlock'),
    dropZone: document.getElementById('drop-zone'),
    fileInput: document.getElementById('file-input'),
    fileLabel: document.getElementById('file-label'),
    lockOptions: document.getElementById('lock-options'),
    unlockDate: document.getElementById('unlock-date'),
    metadataPreview: document.getElementById('metadata-preview'),
    metaFilename: document.getElementById('meta-filename'),
    metaDate: document.getElementById('meta-date'),
    processBtn: document.getElementById('process-btn'),
    btnText: document.getElementById('btn-text'),
    btnIcon: document.getElementById('btn-icon'),
    logs: document.getElementById('console-logs'),
    uploadView: document.getElementById('upload-view'),
    successView: document.getElementById('success-view'),
    successTitle: document.getElementById('success-title'),
    successDesc: document.getElementById('success-desc'),
    downloadLink: document.getElementById('download-link'),
    resetBtn: document.getElementById('reset-btn')
};

// --- Bundling Logic (Browser-compatible) ---
function createWebBundle(encryptedData, fragmentA, iv, metadata) {
    const MAGIC = new TextEncoder().encode('UNLOCKAT');
    const VERSION = new Uint8Array([1]);
    const metadataStr = JSON.stringify(metadata);
    const metadataBuf = new TextEncoder().encode(metadataStr);
    const metadataLenBuf = new DataView(new ArrayBuffer(4));
    metadataLenBuf.setUint32(0, metadataBuf.length, false);

    const bundle = new Uint8Array(MAGIC.length + 1 + 12 + 32 + 4 + metadataBuf.length + encryptedData.length);
    let offset = 0;
    bundle.set(MAGIC, offset); offset += MAGIC.length;
    bundle.set(VERSION, offset); offset += 1;
    bundle.set(iv, offset); offset += 12;
    bundle.set(fragmentA, offset); offset += 32;
    bundle.set(new Uint8Array(metadataLenBuf.buffer), offset); offset += 4;
    bundle.set(metadataBuf, offset); offset += metadataBuf.length;
    bundle.set(encryptedData, offset);
    return bundle;
}

function parseWebBundle(buffer) {
    const view = new DataView(buffer.buffer);
    let offset = 0;
    const magic = new TextDecoder().decode(buffer.slice(0, 8));
    if (magic !== 'UNLOCKAT') throw new Error('Invalid UnlockAt file format');
    offset += 9; // MAGIC + VERSION
    const iv = buffer.slice(offset, offset + 12); offset += 12;
    const fragmentA = buffer.slice(offset, offset + 32); offset += 32;
    const metadataLen = view.getUint32(offset, false); offset += 4;
    const metadataText = new TextDecoder().decode(buffer.slice(offset, offset + metadataLen));
    const metadata = JSON.parse(metadataText); offset += metadataLen;
    const encryptedData = buffer.slice(offset);
    return { iv, fragmentA, metadata, encryptedData };
}

// --- Icons ---
const Icons = {
    Shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>',
    Unlock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
    Loader: '<path d="M21 12a9 9 0 1 1-6.21-8.58"/>'
};

// --- Helpers ---
function addLog(msg, type = 'info') {
    if (el.logs.children.length === 1 && el.logs.firstChild.nodeType === 1 && el.logs.firstChild.style.fontStyle === 'italic') {
        el.logs.innerHTML = '';
    }
    const div = document.createElement('div');
    div.className = 'log-entry';
    div.innerHTML = `<span class="log-time">${new Date().toLocaleTimeString()}</span><span class="log-text ${type}">${type === 'success' ? '→ ' : type === 'error' ? '! ' : '> '}${msg}</span>`;
    el.logs.prepend(div);
}

function updateUI() {
    const ready = currentFile && (mode === 'unlock' || el.unlockDate.value);
    el.processBtn.disabled = !ready || isProcessing;
    el.btnText.textContent = isProcessing ? 'Processing...' : (mode === 'lock' ? 'Secure My File' : 'Request Decryption');
    el.btnIcon.innerHTML = isProcessing ? Icons.Loader : (mode === 'lock' ? Icons.Shield : Icons.Unlock);
}

// --- Handlers ---
el.modeLock.onclick = () => {
    mode = 'lock';
    el.modeLock.classList.add('active');
    el.modeUnlock.classList.remove('active');
    el.lockOptions.style.display = 'flex';
    el.metadataPreview.style.display = 'none';
    currentFile = null;
    el.fileLabel.textContent = 'Drop any file here';
    addLog('Switched to LOCK mode');
    updateUI();
};

el.modeUnlock.onclick = () => {
    mode = 'unlock';
    el.modeUnlock.classList.add('active');
    el.modeLock.classList.remove('active');
    el.lockOptions.style.display = 'none';
    el.metadataPreview.style.display = 'none';
    currentFile = null;
    el.fileLabel.textContent = 'Drop .unlockat file here';
    addLog('Switched to UNLOCK mode');
    updateUI();
};

el.dropZone.onclick = () => el.fileInput.click();
el.fileInput.onchange = (e) => handleFile(e.target.files[0]);
el.dropZone.ondragover = (e) => { e.preventDefault(); el.dropZone.classList.add('drag-over'); };
el.dropZone.ondragleave = () => el.dropZone.classList.remove('drag-over');
el.dropZone.ondrop = (e) => {
    e.preventDefault();
    el.dropZone.classList.remove('drag-over');
    handleFile(e.dataTransfer.files[0]);
};

async function handleFile(file) {
    if (!file) return;
    currentFile = file;
    el.fileLabel.textContent = file.name;
    addLog(`File selected: ${file.name}`);

    if (mode === 'unlock' && file.name.endsWith('.unlockat')) {
        try {
            const buffer = new Uint8Array(await file.arrayBuffer());
            const { metadata } = parseWebBundle(buffer);
            el.metaFilename.textContent = metadata.filename || 'Unknown';
            const unlockTimestamp = metadata.targetTimestamp || metadata.unlockDate; // Compatibility with old files
            el.metaDate.textContent = new Date(unlockTimestamp).toLocaleString();
            el.metadataPreview.style.display = 'block';
            addLog(`Bundle parsed. Targets: ${new Date(unlockTimestamp).toLocaleString()}`, 'success');
        } catch (err) {
            addLog(`Failed to parse bundle: ${err.message}`, 'error');
        }
    }
    updateUI();
}

el.unlockDate.onchange = () => updateUI();

el.processBtn.onclick = async () => {
    if (isProcessing) return;
    isProcessing = true;
    updateUI();
    el.logs.innerHTML = '';

    try {
        if (mode === 'lock') {
            await runLock();
        } else {
            await runUnlock();
        }
    } catch (err) {
        addLog(err.message, 'error');
    } finally {
        isProcessing = false;
        updateUI();
    }
};

async function runLock() {
    addLog('🚀 Starting local encryption pipeline...');
    const buffer = new Uint8Array(await currentFile.arrayBuffer());
    addLog('Generating 256-bit entropy for Master Key...');
    const masterKey = await generateMasterKey();
    const { fragmentA, fragmentB } = await splitKey(masterKey);
    addLog('Encrypting buffer with AES-GCM...');
    const { iv, encryptedData } = await encryptBuffer(buffer, masterKey);

    addLog('Sending Fragment B to Time Oracle...');
    const targetTimestamp = new Date(el.unlockDate.value).getTime();
    const response = await fetch('/api/store-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fragmentB: bufToHex(fragmentB), targetTimestamp })
    });

    if (!response.ok) throw new Error('Cloud Storage failed');
    const { keyId, storage } = await response.json();

    if (storage === 'memory-fallback') {
        addLog('⚠️ WARNING: Vercel KV not detected. Key is temporary and will be lost soon!', 'error');
    }

    addLog(`✅ Server accepted Fragment B. KeyID: ${keyId}`, 'success');

    const bundle = createWebBundle(encryptedData, fragmentA, iv, {
        filename: currentFile.name,
        keyId,
        targetTimestamp
    });
    const url = URL.createObjectURL(new Blob([bundle]));

    const localDate = new Date(targetTimestamp);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const offset = -localDate.getTimezoneOffset() / 60;
    const offsetStr = `GMT${offset >= 0 ? '+' : ''}${offset}`;

    el.downloadLink.href = url;
    el.downloadLink.download = `${currentFile.name}.unlockat`;
    el.successTitle.textContent = 'File Time-Locked';
    el.successDesc.textContent = `Unlocked on ${localDate.toLocaleString()} (${timezone}, ${offsetStr})`;
    showSuccess();
    addLog(`✨ SUCCESS: Your file is now time-locked for ${localDate.toLocaleString()} (${offsetStr}).`, 'success');
}

async function runUnlock() {
    addLog('🚀 Starting local decryption pipeline...');
    const buffer = new Uint8Array(await currentFile.arrayBuffer());
    const { iv, fragmentA, metadata, encryptedData } = parseWebBundle(buffer);

    addLog(`Requesting Fragment B from Time Oracle (KeyID: ${metadata.keyId})...`);
    const response = await fetch(`/api/request-key?keyId=${metadata.keyId}`);

    if (response.status === 403) {
        const body = await response.json();
        addLog(`🛑 Access Denied: Still locked.`, 'error');
        addLog(`Remaining: ${body.remainingSeconds} seconds`, 'error');
        return;
    }

    if (!response.ok) throw new Error('Fragment B retrieval failed');
    const { fragmentB } = await response.json();
    addLog('✅ Fragment B retrieved. Reconstructing key...');
    const masterKey = await combineKeys(fragmentA, hexToBuf(fragmentB));

    addLog('Decrypting buffer locally...');
    const decrypted = await decryptBuffer(encryptedData, masterKey, iv);
    const url = URL.createObjectURL(new Blob([decrypted]));

    el.downloadLink.href = url;
    el.downloadLink.download = metadata.filename || 'decrypted_file';
    el.successTitle.textContent = 'Decryption Complete';
    el.successDesc.textContent = 'The original file has been reconstructed bit-for-bit.';
    showSuccess();
    addLog('✨ SUCCESS: Original file recovered.', 'success');
}

function showSuccess() {
    el.uploadView.style.display = 'none';
    el.successView.style.display = 'block';
}

el.resetBtn.onclick = () => {
    el.uploadView.style.display = 'block';
    el.successView.style.display = 'none';
    currentFile = null;
    el.fileLabel.textContent = mode === 'lock' ? 'Drop any file here' : 'Drop .unlockat file here';
    el.metadataPreview.style.display = 'none';
    addLog('Ready for next operation.');
    updateUI();
};

checkHealth();
