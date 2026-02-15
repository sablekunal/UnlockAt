import React, { useState, useEffect } from 'react';
import { Lock, Unlock, Shield, Clock, FileUp, Terminal, CheckCircle, AlertCircle, Download, Loader2 } from 'lucide-react';
import { generateMasterKey, encryptBuffer, splitKey, bufToHex } from './lib/web-crypto';

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

export default function App() {
    const [file, setFile] = useState(null);
    const [unlockDate, setUnlockDate] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [logs, setLogs] = useState([]);
    const [result, setResult] = useState(null);

    const addLog = (msg, type = 'info') => {
        setLogs(prev => [...prev, { msg, type, time: new Date().toLocaleTimeString() }]);
    };

    const handleFileDrop = (e) => {
        e.preventDefault();
        const droppedFile = e.dataTransfer?.files[0] || e.target.files[0];
        if (droppedFile) {
            setFile(droppedFile);
            addLog(`Selected file: ${droppedFile.name} (${(droppedFile.size / 1024).toFixed(2)} KB)`);
        }
    };

    const lockFile = async () => {
        if (!file || !unlockDate) return;

        setIsProcessing(true);
        setLogs([]);
        addLog('🚀 Starting local encryption pipeline...');

        try {
            // 1. Read file
            addLog('Reading file into local memory buffer...');
            const arrayBuffer = await file.arrayBuffer();
            const buffer = new Uint8Array(arrayBuffer);
            addLog('✅ File buffer loaded. 0 bytes uploaded to network.', 'success');

            // 2. Generate and Split keys
            addLog('Generating 256-bit entropy for Master Key...');
            const masterKey = await generateMasterKey();
            const { fragmentA, fragmentB } = await splitKey(masterKey);
            addLog('✅ Master Key generated and split locally.', 'success');

            // 3. Encrypt
            addLog('Encrypting buffer with AES-GCM...');
            const { iv, encryptedData } = await encryptBuffer(buffer, masterKey);
            addLog('✅ local encryption complete.', 'success');

            // 4. Send Fragment B to Server
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

            // 5. Create Bundle
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

    return (
        <div className="min-h-screen p-4 flex flex-col items-center justify-center">
            <div className="max-w-4xl w-full space-y-8">
                {/* Header */}
                <div className="text-center space-y-4">
                    <div className="inline-flex p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 mb-4 animate-pulse">
                        <Lock className="w-12 h-12 text-blue-400" />
                    </div>
                    <h1 className="text-6xl tracking-tight gradient-text">UNLOCKAT</h1>
                    <p className="text-xl text-gray-400 max-w-lg mx-auto">
                        Zero-knowledge file protection where <span className="text-blue-400 font-mono">TIME</span> is the only key.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-8 h-full">
                    {/* Main Action Area */}
                    <div className="glass-panel space-y-6">
                        {!result ? (
                            <>
                                <div
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={handleFileDrop}
                                    className="relative group cursor-pointer"
                                >
                                    <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-gray-700 rounded-xl group-hover:border-blue-500/50 transition-colors">
                                        <FileUp className="w-10 h-10 text-gray-500 group-hover:text-blue-400 mb-2" />
                                        <span className="text-gray-400">{file ? file.name : "Drop file to encrypt"}</span>
                                        <input type="file" className="hidden" onChange={handleFileDrop} />
                                    </label>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-left block text-sm font-medium text-gray-400 flex items-center gap-2">
                                        <Clock className="w-4 h-4" /> Unlock Date & Time
                                    </label>
                                    <input
                                        type="datetime-local"
                                        className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 outline-none focus:border-blue-500 transition-colors"
                                        value={unlockDate}
                                        onChange={(e) => setUnlockDate(e.target.value)}
                                    />
                                </div>

                                <button
                                    disabled={!file || !unlockDate || isProcessing}
                                    onClick={lockFile}
                                    className="w-full h-14 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:cursor-not-allowed rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all glow-btn"
                                >
                                    {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Shield className="w-5 h-5" />}
                                    {isProcessing ? "Processing..." : "Secure My File"}
                                </button>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full space-y-6 animate-in fade-in zoom-in duration-300">
                                <div className="p-4 rounded-full bg-green-500/10 border border-green-500/20">
                                    <CheckCircle className="w-16 h-16 text-green-400" />
                                </div>
                                <div className="text-center">
                                    <h3 className="text-2xl font-bold">Time-Lock Complete</h3>
                                    <p className="text-gray-400 mt-2">Key ID: <code className="bg-black/40 px-2 py-1 rounded text-blue-300">{result.keyId}</code></p>
                                </div>
                                <a
                                    href={result.url}
                                    download={result.filename}
                                    className="w-full h-14 bg-green-600 hover:bg-green-500 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all glow-btn"
                                >
                                    <Download className="w-5 h-5" /> Download .unlockat
                                </a>
                                <button
                                    onClick={() => { setResult(null); setFile(null); setLogs([]); }}
                                    className="text-gray-500 hover:text-white transition-colors"
                                >
                                    Lock another file
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Console Area */}
                    <div className="glass-panel text-left flex flex-col h-[400px]">
                        <div className="flex items-center gap-2 mb-4 text-gray-400 border-b border-gray-700 pb-2">
                            <Terminal className="w-4 h-4" />
                            <span className="text-xs font-mono uppercase tracking-widest text-blue-400/80">Transparency Console</span>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-2 font-mono text-sm">
                            {logs.length === 0 && <span className="text-gray-600">Waiting for activity...</span>}
                            {logs.map((log, i) => (
                                <div key={i} className="flex gap-3 animate-in slide-in-from-left-2 duration-200">
                                    <span className="text-gray-600 text-[10px] tabular-nums mt-1">{log.time}</span>
                                    <span className={log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-green-400' : 'text-gray-300'}>
                                        {log.msg}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer Info */}
                <div className="flex justify-center gap-8 pt-8">
                    <div className="flex items-center gap-2 text-gray-500">
                        <Shield className="w-4 h-4" /> <span>AES-256-GCM</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-500">
                        <Lock className="w-4 h-4" /> <span>Zero Knowledge</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-500">
                        <Clock className="w-4 h-4" /> <span>NTP Verified</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
