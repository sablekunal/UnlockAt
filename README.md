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

### 🌐 High-Performance Web Dashboard
UnlockAt features a unified, build-less web interface optimized for SEO and speed.
- **Access**: Run `npm start` and visit `http://localhost:3000`.
- **SEO Ready**: Pure HTML/JS structure allows search engines to fully index the application.
- **Zero-Dependency**: No more complex frontend build steps or bloated `node_modules`.

---

## 🛠️ Tech Stack
- **Frontend**: Vanilla HTML5, CSS3, ES6 Modules.
- **Backend**: Node.js APIs (Ready for any Node.js environment).
- **Security**: AES-256-GCM, XOR Secret Sharing.

---

## 📜 Authors
Developed with passion for secure decentralized tools.

*UnlockAt - Because some things are better left for later.*

> Once a legend said, "*Ajj kare so kal kar, kal kare so parso. Itni jaldi kya hai, jab jeena hai barson!*"