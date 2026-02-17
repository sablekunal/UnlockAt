import React, { useState, useEffect } from 'react';
import { Lock, Unlock, Shield, Clock, FileUp, Terminal, CheckCircle, AlertCircle, Download, Loader2, Info } from 'lucide-react';
import { generateMasterKey, encryptBuffer, splitKey, bufToHex, hexToBuf, combineKeys, decryptBuffer } from './lib/web-crypto';

// Minimal bundling logic for browser (since result buffer includes auth tag)
function createWebBundle(encryptedData, fragmentA, iv, metadata) {
    const MAGIC = new TextEncoder().encode('UNLOCKAT');
    const VERSION = new Uint8Array([1]);

    const metadataStr = JSON.stringify(metadata);
    const metadataBuf = new TextEncoder().encode(metadataStr);
    const metadataLenBuf = new DataView(new ArrayBuffer(4));
    metadataLenBuf.setUint32(0, metadataBuf.length, false);

    const bundle = new Uint8Array(
        MAGIC.length +
        VERSION.length +
        iv.length +
        32 + // Fragment A
        4 + // Metadata Len
        metadataBuf.length +
        encryptedData.length
    );

    let offset = 0;
    bundle.set(MAGIC, offset); offset += MAGIC.length;
    bundle.set(VERSION, offset); offset += VERSION.length;
    bundle.set(iv, offset); offset += iv.length;
    bundle.set(fragmentA, offset); offset += 32;
    bundle.set(new Uint8Array(metadataLenBuf.buffer), offset); offset += 4;
    bundle.set(metadataBuf, offset); offset += metadataBuf.length;
    bundle.set(encryptedData, offset);

    return bundle;
}

function parseWebBundle(buffer) {
    const view = new DataView(buffer.buffer);
    let offset = 0;

    const MAGIC = new TextDecoder().decode(buffer.slice(0, 8));
    if (MAGIC !== 'UNLOCKAT') throw new Error('Invalid UnlockAt file format');
    offset += 8;

    const version = buffer[offset];
    offset += 1;

    const iv = buffer.slice(offset, offset + 12);
    offset += 12;

    const fragmentA = buffer.slice(offset, offset + 32);
    offset += 32;

    const metadataLen = view.getUint32(offset, false);
    offset += 4;

    const metadataBuf = buffer.slice(offset, offset + metadataLen);
    const metadata = JSON.parse(new TextDecoder().decode(metadataBuf));
    offset += metadataLen;

    const encryptedData = buffer.slice(offset);

    return { iv, fragmentA, metadata, encryptedData };
}

export default function App() {
    const [mode, setMode] = useState('lock'); // 'lock' or 'unlock'
    const [file, setFile] = useState(null);
    const [unlockDate, setUnlockDate] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [logs, setLogs] = useState([]);
    const [result, setResult] = useState(null);
    const [previewMetadata, setPreviewMetadata] = useState(null);

    const addLog = (msg, type = 'info') => {
        setLogs(prev => [...prev, { msg, type, time: new Date().toLocaleTimeString() }]);
    };

    const handleFileDrop = async (e) => {
        e.preventDefault();
        const droppedFile = e.dataTransfer?.files[0] || e.target.files[0];
        if (droppedFile) {
            setFile(droppedFile);
            setResult(null);
            addLog(`Selected file: ${droppedFile.name} (${(droppedFile.size / 1024).toFixed(2)} KB)`);

            if (mode === 'unlock' && droppedFile.name.endsWith('.unlockat')) {
                try {
                    addLog('Scanning .unlockat bundle metadata...');
                    const buffer = new Uint8Array(await droppedFile.arrayBuffer());
                    const parsed = parseWebBundle(buffer);
                    setPreviewMetadata(parsed.metadata);
                    addLog(`Bundle identified. Target: ${new Date(parsed.metadata.unlockDate).toLocaleString()}`, 'success');
                } catch (err) {
                    setPreviewMetadata(null);
                    addLog(`Failed to parse bundle: ${err.message}`, 'error');
                }
            }
        }
    };

    const lockFile = async () => {
        if (!file || !unlockDate) return;

        setIsProcessing(true);
        setLogs([]);
        addLog('🚀 Starting local encryption pipeline...');

        try {
            addLog('Reading file into local memory buffer...');
            const arrayBuffer = await file.arrayBuffer();
            const buffer = new Uint8Array(arrayBuffer);
            addLog(`✅ File buffer loaded. 0 bytes uploaded to network.`, 'success');

            addLog('Generating 256-bit entropy for Master Key...');
            const masterKey = await generateMasterKey();
            const { fragmentA, fragmentB } = await splitKey(masterKey);
            addLog('✅ Master Key generated and split locally.', 'success');

            addLog('Encrypting buffer with AES-GCM...');
            const { iv, encryptedData } = await encryptBuffer(buffer, masterKey);
            addLog('✅ Local encryption complete.', 'success');

            addLog(`Sending Fragment B to Time Oracle (Target: ${unlockDate})...`);
            const response = await fetch('/api/store-key', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fragmentB: bufToHex(fragmentB),
                    targetDate: unlockDate
                })
            });

            if (!response.ok) throw new Error('Failed to store key fragment');
            const { keyId } = await response.json();
            addLog(`✅ Server accepted Fragment B. KeyID: ${keyId}`, 'success');

            addLog('Bundling encrypted data into .unlockat archive...');
            const metadata = { filename: file.name, keyId, unlockDate };
            const bundle = createWebBundle(encryptedData, fragmentA, iv, metadata);

            const blob = new Blob([bundle], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);

            setResult({ url, filename: `${file.name}.unlockat`, keyId });
            addLog('✨ SUCCESS: Your file is now time-locked.', 'success');
        } catch (err) {
            addLog(`❌ Error: ${err.message}`, 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const unlockFile = async () => {
        if (!file) return;

        setIsProcessing(true);
        setLogs([]);
        addLog('🚀 Starting local decryption pipeline...');

        try {
            addLog('Parsing .unlockat bundle...');
            const buffer = new Uint8Array(await file.arrayBuffer());
            const { iv, fragmentA, metadata, encryptedData } = parseWebBundle(buffer);

            addLog(`Requesting Fragment B from Time Oracle (KeyID: ${metadata.keyId})...`);
            const response = await fetch(`/api/request-key?keyId=${metadata.keyId}`);

            if (response.status === 403) {
                const body = await response.json();
                addLog(`🛑 Access Denied: File is still locked.`, 'error');
                addLog(`Remaining: ${body.remainingSeconds} seconds`, 'info');
                throw new Error('File locked');
            }

            if (!response.ok) throw new Error('Failed to retrieve key fragment');

            const { fragmentB } = await response.json();
            addLog('✅ Fragment B retrieved. Reconstructing Master Key locally...', 'success');

            const masterKey = await combineKeys(fragmentA, hexToBuf(fragmentB));

            addLog('Decrypting buffer with AES-GCM...');
            const decryptedBuffer = await decryptBuffer(encryptedData, masterKey, iv);
            addLog('✅ Decryption complete.', 'success');

            const blob = new Blob([decryptedBuffer], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);

            setResult({ url, filename: metadata.filename || 'decrypted_file' });
            addLog('✨ SUCCESS: Original file recovered.', 'success');
        } catch (err) {
            if (err.message !== 'File locked') {
                addLog(`❌ Error: ${err.message}`, 'error');
            }
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="min-h-screen p-4 flex flex-col items-center justify-center">
            <div className="max-w-4xl w-full space-y-8">
                {/* Header */}
                <div className="text-center space-y-4">
                    <div className="inline-flex p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 mb-4 animate-pulse">
                        <Lock className="w-12 h-12 text-blue-400" />
                    </div>
                    <h1 className="text-6xl tracking-tight gradient-text font-black">UNLOCKAT</h1>
                    <p className="text-xl text-gray-400 max-w-lg mx-auto">
                        Zero-knowledge file protection where <span className="text-blue-400 font-mono">TIME</span> is the only key.
                    </p>
                </div>

                {/* Mode Toggle */}
                <div className="flex justify-center">
                    <div className="bg-white/5 p-1 rounded-xl border border-white/10 flex gap-1">
                        <button
                            onClick={() => { setMode('lock'); setFile(null); setResult(null); setPreviewMetadata(null); }}
                            className={`px-6 py-2 rounded-lg flex items-center gap-2 transition-all ${mode === 'lock' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                        >
                            <Lock className="w-4 h-4" /> Lock File
                        </button>
                        <button
                            onClick={() => { setMode('unlock'); setFile(null); setResult(null); setPreviewMetadata(null); }}
                            className={`px-6 py-2 rounded-lg flex items-center gap-2 transition-all ${mode === 'unlock' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                        >
                            <Unlock className="w-4 h-4" /> Open File
                        </button>
                    </div>
                </div>

                <div className="grid md:grid-cols-2 gap-8 items-start">
                    {/* Main Action Area */}
                    <div className="glass-panel space-y-6">
                        {!result ? (
                            <>
                                <div
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={handleFileDrop}
                                    className="relative group cursor-pointer"
                                >
                                    <label className="flex flex-col items-center justify-center h-56 border-2 border-dashed border-gray-700/50 rounded-2xl group-hover:border-blue-500/50 transition-all bg-white/[0.02]">
                                        <FileUp className="w-12 h-12 text-gray-500 group-hover:text-blue-400 mb-3 transition-colors" />
                                        <span className="text-gray-400 font-medium">{file ? file.name : `Drop ${mode === 'lock' ? 'any file' : '.unlockat file'} here`}</span>
                                        <span className="text-xs text-gray-600 mt-2">Maximum size: 50MB</span>
                                        <input type="file" className="hidden" onChange={handleFileDrop} accept={mode === 'unlock' ? '.unlockat' : '*'} />
                                    </label>
                                </div>

                                {mode === 'lock' ? (
                                    <div className="space-y-2">
                                        <label className="text-left block text-sm font-medium text-gray-400 flex items-center gap-2">
                                            <Clock className="w-4 h-4 text-blue-400" /> Unlock Date & Time
                                        </label>
                                        <input
                                            type="datetime-local"
                                            className="w-full bg-black/40 border border-white/10 rounded-xl p-4 outline-none focus:border-blue-500/50 transition-all font-mono"
                                            value={unlockDate}
                                            onChange={(e) => setUnlockDate(e.target.value)}
                                        />
                                    </div>
                                ) : previewMetadata && (
                                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-3 animate-in fade-in slide-in-from-bottom-2">
                                        <div className="flex items-start gap-3">
                                            <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                                            <div className="text-left">
                                                <p className="text-sm font-bold text-gray-300">Bundle Metadata</p>
                                                <p className="text-xs text-gray-500">Key ID: <span className="font-mono text-blue-400">{previewMetadata.keyId}</span></p>
                                                <p className="text-xs text-gray-500">Unlocks: {new Date(previewMetadata.unlockDate).toLocaleString()}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <button
                                    disabled={!file || (mode === 'lock' && !unlockDate) || isProcessing}
                                    onClick={mode === 'lock' ? lockFile : unlockFile}
                                    className={`w-full h-14 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all glow-btn ${isProcessing ? 'bg-gray-800' : 'bg-blue-600 hover:bg-blue-500 shadow-xl shadow-blue-900/20'}`}
                                >
                                    {isProcessing ? <Loader2 className="w-6 h-6 animate-spin" /> : mode === 'lock' ? <Shield className="w-6 h-6" /> : <Unlock className="w-6 h-6" />}
                                    {isProcessing ? "Processing..." : mode === 'lock' ? "Secure My File" : "Request Decryption"}
                                </button>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center p-8 space-y-6 animate-in fade-in zoom-in duration-300">
                                <div className="p-5 rounded-full bg-green-500/10 border border-green-500/20 shadow-2xl shadow-green-900/10">
                                    <CheckCircle className="w-20 h-20 text-green-400" />
                                </div>
                                <div className="text-center">
                                    <h3 className="text-3xl font-black text-white">{mode === 'lock' ? 'Time-Lock Active' : 'Decryption Complete'}</h3>
                                    <p className="text-gray-400 mt-2">
                                        {mode === 'lock'
                                            ? `Save your .unlockat file. It will be accessible on ${new Date(unlockDate).toLocaleString()}.`
                                            : "Your original file has been recovered bit-for-bit."}
                                    </p>
                                </div>
                                <a
                                    href={result.url}
                                    download={result.filename}
                                    className="w-full h-14 bg-green-600 hover:bg-green-500 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all glow-btn shadow-xl shadow-green-900/20"
                                >
                                    <Download className="w-6 h-6" /> Download {mode === 'lock' ? '.unlockat' : 'Original'}
                                </a>
                                <button
                                    onClick={() => { setResult(null); setFile(null); setLogs([]); setPreviewMetadata(null); }}
                                    className="text-gray-500 hover:text-white transition-colors text-sm font-medium"
                                >
                                    {mode === 'lock' ? 'Lock another file' : 'Open another bundle'}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Console Area */}
                    <div className="glass-panel text-left flex flex-col h-[400px] bg-black/40">
                        <div className="flex items-center justify-between gap-2 mb-4 text-gray-400 border-b border-white/5 pb-3">
                            <div className="flex items-center gap-2">
                                <Terminal className="w-4 h-4 text-blue-400" />
                                <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-blue-400/80">Transparency Console</span>
                            </div>
                            <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-2.5 font-mono text-[12px] pr-2 custom-scrollbar">
                            {logs.length === 0 && <div className="h-full flex items-center justify-center text-gray-600 italic">Awaiting local operations...</div>}
                            {logs.map((log, i) => (
                                <div key={i} className="flex gap-4 group animate-in slide-in-from-left-4 duration-300">
                                    <span className="text-gray-600 tabular-nums shrink-0 opacity-50">{log.time}</span>
                                    <span className={log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-green-400' : 'text-gray-300'}>
                                        {log.type === 'success' ? '→ ' : log.type === 'error' ? '! ' : '> '}
                                        {log.msg}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer Info */}
                <div className="flex justify-center gap-12 pt-8 text-[11px] font-mono tracking-widest text-gray-600 uppercase">
                    <div className="flex items-center gap-2 group hover:text-gray-400 transition-colors cursor-default">
                        <Shield className="w-3.5 h-3.5" /> <span>AES-256-GCM</span>
                    </div>
                    <div className="flex items-center gap-2 group hover:text-gray-400 transition-colors cursor-default">
                        <Lock className="w-3.5 h-3.5" /> <span>Zero Knowledge</span>
                    </div>
                    <div className="flex items-center gap-2 group hover:text-gray-400 transition-colors cursor-default">
                        <Clock className="w-3.5 h-3.5" /> <span>NTP Oracle</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
