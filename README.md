# 🔓 UnlockAt — Secure, Time-Gated Encryption

> **"Wait for it."** UnlockAt is a premium, zero-knowledge file encryption system that allows you to lock files behind a cryptographic time-gate. Encrypt locally, store the key fragment in a decentralized "Time Oracle," and unlock it only when the designated time arrives.

![Logo](https://img.shields.io/badge/Security-Hardened-blueviolet) ![Audit](https://img.shields.io/badge/Audit-Passed-success) ![License](https://img.shields.io/badge/License-MIT-blue) ![Timezone](https://img.shields.io/badge/Global-Time--Gate-orange)

---

## 🛡️ Security Architecture

UnlockAt is built on a **Zero-Knowledge Architecture**. Neither the server nor any third party ever sees your unencrypted file or your master key.

-   **Client-Side Split-Key**: Your master key is split into `Fragment A` (stored in your `.unlockat` bundle) and `Fragment B` (sent to the Time Oracle).
-   **AES-256-GCM**: Industry-standard authenticated encryption ensures your data cannot be read OR tampered with.
-   **Global Time Synchronization**: Uses universal Unix Timestamps (UTC) to ensure files locked in one timezone (e.g., GMT+5:30) open precisely as expected anywhere else in the world.
-   **Hardened Time Oracle**: Standardized on UTC to prevent local clock manipulation and timezone desync "Access Denied" errors.

### 🧪 Security Audit Results (Passed 2026-02-28)

| Scenario | Objective | Result |
| :--- | :--- | :--- |
| **Time-Travel Attack** | Attempt unlock before target stamp. | **✅ BLOCKED** |
| **Cross-Platform** | Lock via Web, Unlock via CLI. | **✅ SUCCESS** |
| **Timezone Desync** | Unlock from a different timezone. | **✅ SUCCESS** |
| **Bit-Flipping** | Tampering with file bytes to bypass checks. | **✅ REJECTED** |
| **Zero-Knowledge** | Inspect server logs for sensitive data. | **✅ PASS** |

---

## 🌐 Instant Cloud Access

Don't want to install anything? Use the official **UnlockAt Global Time Oracle**:

### [https://unlockat.vercel.app/](https://unlockat.vercel.app/)

-   **Zero Setup**: Encrypt and decrypt directly in your browser.
-   **Hardware Accelerated**: Uses Web Crypto API for near-instant processing.
-   **Always Synchronized**: Connected to the high-performance Vercel Redis backbone for 100% key persistence.

---

## 🚀 Getting Started

### Installation
```bash
npm install -g @sablekunal/unlockat
```

### 💻 CLI Usage
**Lock a file (Timezone Aware):**
```bash
unlockat lock secret.pdf "2027-01-01 12:00:00"
```
*The CLI will automatically detect your local timezone (e.g., GMT+5:30) and sync it with the global Time Oracle.*

**Open a locked file:**
```bash
unlockat open secret.pdf.unlockat
```

### 🌐 High-Performance Web Dashboard
UnlockAt features a unified, build-less web interface optimized for SEO and speed.
- **Access**: Run `npm start` and visit `http://localhost:3000`.
- **Timezone Transparency**: Displays your local timezone and offset during the locking process.
- **Cross-Platform**: Files locked via the web can be unlocked via CLI (and vice versa).
- **SEO Ready**: Pure HTML/JS structure allows search engines to fully index the application.

---

## 🛠️ Tech Stack
-   **Frontend**: Vanilla HTML5, CSS3, ES6 Modules (No build bloat).
-   **Backend**: Node.js APIs with Unified Storage (Supports Vercel KV & Redis Marketplace).
-   **Security**: SubtleCrypto (Web) / Node:Crypto (CLI), AES-256-GCM, XOR Secret Sharing.
-   **Sync**: Unix Epoch Timestamps (UTC) for global reliability.

---

## 📜 Authors
Developed with passion for secure decentralized tools.

*UnlockAt - Because some things are better left for later.*

> Once a legend said, "*Ajj kare so kal kar, kal kare so parso. Itni jaldi kya hai, jab jeena hai barson!*"