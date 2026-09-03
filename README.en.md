<div align="center">

# Secret Message · 秘密消息

<p><strong>Pure Client-Side · 100% Offline · Zero Dependencies · Serverless End-to-End Secure Messaging</strong></p>
<p>Ephemeral ECDH P-256 Key Exchange · 12-Digit MITM Defense · AES-256-GCM Authenticated Encryption · Zero Retention</p>

<p>
  <a href="https://wyj-iirtyj.github.io/offline-secure-session/"><img src="https://img.shields.io/badge/Demo-Live%20Demo-10b981?style=flat-square&logo=github" alt="Live Demo"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-3b82f6?style=flat-square" alt="License"></a>
  <a href="package.json"><img src="https://img.shields.io/badge/Dependencies-0%20Zero-8b5cf6?style=flat-square" alt="Zero Deps"></a>
  <a href="SECURITY.md"><img src="https://img.shields.io/badge/Network-100%25%20Offline-f59e0b?style=flat-square" alt="Offline"></a>
  <a href="tests"><img src="https://img.shields.io/badge/Tests-13%2F13%20Passed-059669?style=flat-square" alt="Tests"></a>
</p>
<p>
  <img src="https://img.shields.io/badge/Key%20Exchange-ECDH%20P--256-0284c7?style=flat-square" alt="ECDH">
  <img src="https://img.shields.io/badge/KDF-HKDF--SHA--256-7c3aed?style=flat-square" alt="HKDF">
  <img src="https://img.shields.io/badge/Cipher-AES--256--GCM-dc2626?style=flat-square" alt="AES-GCM">
  <img src="https://img.shields.io/badge/Isolation-Web%20Worker-9333ea?style=flat-square" alt="Worker">
  <img src="https://img.shields.io/badge/i18n-EN%20%7C%20ZH%20%7C%20JA-ec4899?style=flat-square" alt="i18n">
</p>

<p>
  <a href="README.md">简体中文</a> &nbsp;·&nbsp;
  <b>English</b> &nbsp;·&nbsp;
  <a href="README.ja.md">日本語</a>
</p>

</div>

---

A **pure client-side, 100% offline, zero-dependency, and serverless** secure messaging tool.

Both parties exchange ephemeral public connection codes and establish a shared session key on their local devices via ECDH. After verifying a 12-digit safety number against Man-in-the-Middle (MITM) attacks, all subsequent messages are encrypted and decrypted using this local session key via AES-256-GCM.

> 🛡️ **Zero-Knowledge Guarantee**: The application never uploads your plaintext, private keys, or session keys. Private keys and session keys are non-extractable and reside solely in volatile Web Worker memory; they are instantly destroyed upon refresh, closing the tab, or clearing.

---

## ⚡ Live Demo

- **Open App**: <https://wyj-iirtyj.github.io/offline-secure-session/>
- **Source Code**: <https://github.com/wyj-IIRtyj/offline-secure-session>

The web app requires no network APIs, CDNs, external fonts, or analytics. Once the static assets are loaded via GitHub Pages, all cryptographic computations run entirely offline in your browser.

---

## ✨ Key Features

- 📱 **Mobile & Desktop Optimized**: Responsive layout supporting desktop, tablets, and smartphones (iOS Safari, Android Chrome, WeChat). Full Safe Area inset support and iOS auto-zoom prevention.
- 🌐 **Multilingual (i18n)**: Instant switching between **English, 简体中文, and 日本語** with local preference persistence.
- 🔒 **True Zero Dependencies**: No npm runtime dependencies, no remote scripts, and a strict Content Security Policy (`connect-src 'none'`). Air-gap friendly.
- 🛡️ **MITM Protection**: Mandatory 12-digit verification code verification before any encryption or decryption is unlocked.
- ⚡ **Web Worker Isolation**: Private keys and session states are isolated within a dedicated Web Worker to protect against main-thread data inspection.
- ⏱️ **Auto-Destruction**: Automatically terminates the session after 10 minutes of inactivity; refreshing or closing immediately discards all keys.

---

## 🚀 How It Works

1. **Both Open the Page**: Each user loads the tool to generate a unique, ephemeral public connection code.
2. **Exchange Public Codes**: Send your public connection code to each other via email, messaging apps, or any untrusted channel (contains no private keys).
3. **Compute Session Key**: Paste the peer's connection code. ECDH calculates the identical shared key on both devices locally.
4. **Verify Safety Numbers**: Compare the 12-digit verification code via phone, voice, or in person to verify authenticity.
5. **Send Secret Messages**: Type your secret and encrypt. Only the verified peer can decrypt your ciphertext.

No public/private key pairs to manually import or export, and **no risk of accidentally sharing your private key**.

---

## 🔬 Cryptographic Design

| Layer | Algorithm & Spec | Details |
| :--- | :--- | :--- |
| **Key Exchange (KEX)** | ECDH P-256 (`secp256r1`) | Ephemeral asymmetric keypair; private key marked `extractable: false` |
| **Key Derivation (KDF)** | HKDF-SHA-256 | Derives session key by binding transcript hash of both handshake codes |
| **Symmetric Cipher** | AES-256-GCM | Authenticated encryption with unique 96-bit random IV per message |
| **Integrity & AAD** | GCM Auth Tag + AAD | Protocol version, session ID, and random Message ID bound as AAD |
| **Replay Defense** | Random Message ID | Duplicate message IDs are rejected in-memory to prevent accidental replaying |

---

## 🚫 Ephemeral Storage Design

Cryptographic keys are held solely in the volatile memory of a modern Web Worker as non-extractable `CryptoKey` objects.

Nothing sensitive is ever written to disk or browser storage:
- ❌ No `localStorage`
- ❌ No `sessionStorage`
- ❌ No `IndexedDB`
- ❌ No `Cookie`
- ❌ No `Service Worker` caches

Any of the following actions will permanently destroy the current session:
- Refreshing the page
- Closing the tab or browser
- Clicking "End & Clear All"
- 10 minutes of user inactivity

---

## 💻 Running Locally

No build step required:

```bash
# Clone the repository
git clone https://github.com/wyj-IIRtyj/offline-secure-session.git
cd offline-secure-session

# Start local server
npm run serve
# Or
python3 -m http.server 4173 --bind 127.0.0.1
```

Visit `http://127.0.0.1:4173`. Once loaded, you can disconnect your internet connection and use it completely offline.

---

## 🧪 Automated Tests

```bash
npm test
```

The test suite covers 13 core cryptographic and state invariants:
- [x] Private keys are non-extractable
- [x] Page state never exposes private or session keys
- [x] Parties independently derive identical session IDs
- [x] Parties independently derive identical verification codes
- [x] Session keys are non-extractable
- [x] Messaging blocked until safety number is explicitly confirmed
- [x] Bidirectional full-duplex messaging after verification
- [x] Same plaintext produces randomized ciphertext
- [x] Tampered ciphertext rejection via GCM auth tag
- [x] Ciphertext from different session rejected
- [x] Replay message rejection
- [x] Self-connection rejection
- [x] Review data service compliance

---

## 📂 Project Structure

```text
.
├── index.html                 # Markup with i18n data bindings
├── styles.css                # Minimalist, monochrome, mobile-first CSS
├── app.js                    # UI state machine and event handling
├── i18n.js                   # Multilingual translation dictionary (EN, ZH, JA)
├── crypto-worker.mjs         # Isolated Web Worker for cryptographic computations
├── session-controller.mjs    # Session lifecycle and security state machine
├── crypto-core.mjs           # ECDH / HKDF / AES-GCM Web Crypto implementation
├── tests/                    # Node.js automated test suite
├── README.md                 # Simplified Chinese documentation
├── README.en.md              # English documentation
├── README.ja.md              # Japanese documentation
├── SECURITY.md               # Security disclosure policy
└── LICENSE                   # MIT License
```

---

## 📄 License

Released under the [MIT License](LICENSE).
