# 🔓 UnlockAt — Secure, Time-Gated Encryption

> **"Wait for it."** UnlockAt is a premium, zero-knowledge file encryption system that allows you to lock files behind a kryptographic time-gate. Encrypt locally, store the key fragment in a decentralized "Time Oracle," and unlock it only when the designated time arrives.

![Logo](https://img.shields.io/badge/Security-Hardened-blueviolet) ![Audit](https://img.shields.io/badge/Audit-Passed-success) ![License](https://img.shields.io/badge/License-MIT-blue)

---

## 🛡️ Security Architecture

UnlockAt is built on a **Zero-Knowledge Architecture**. Neither the server nor any third party ever sees your unencrypted file or your master key.

-   **Client-Side Split-Key**: Your master key is split into `Fragment A` (stored in your `.unlockat` bundle) and `Fragment B` (sent to the Time Oracle).
-   **AES-256-GCM**: Industry-standard authenticated encryption ensures your data cannot be read OR tampered with.
-   **NTP-Synced Time Oracle**: The server enforces the unlock time using its internal clock, making local system time manipulation impossible.

### 🧪 Security Audit Results (Passed 2026-02-28)

| Scenario | Objective | Result |
| :--- | :--- | :--- |
| **Time-Travel Attack** | Attempt unlock before target date. | **✅ BLOCKED** |
| **API Leakage** | Direct API request for Fragment B. | **✅ BLOCKED** |
| **Bit-Flipping** | Tampering with file bytes to bypass checks. | **✅ REJECTED** |
| **Zero-Knowledge** | Inspect server logs for sensitive data. | **✅ PASS** |

---

## 🚀 Getting Started

### Installation
```bash
npm install -g @sablekunal/unlockat
```

### 💻 CLI Usage
**Lock a file until tomorrow:**
```bash
unlockat lock secret.pdf "2026-03-01 12:00:00"
```

**Open a locked file:**
```bash
unlockat open secret.pdf.unlockat
```

### 🌐 Web Dashboard
Run the development server to access the premium UI:
```bash
npm run dev
```
Navigate to `http://localhost:5173`. Toggle to **"Open File"** to decrypt using the browser's hardware-accelerated crypto.

---

## 🛠️ Tech Stack
-   **Frontend**: React, Tailwind CSS, Lucide Icons
-   **Backend**: Node.js, Vercel Functions, Vercel KV
-   **Crypto**: Web Crypto API (Browser), `node:crypto` (CLI)

---

## 📜 Authors
Developed with passion for secure decentralized tools.

*UnlockAt — Because some things are better left for later.*
