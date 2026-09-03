<div align="center">

# 秘密消息 · Secret Message

<p><strong>纯前端 · 纯离线 · 零依赖 · 无需服务器的安全端到端消息交换</strong></p>
<p>基于 ECDH P-256 会话协商 · 安全核对码防中间人 · AES-256-GCM 认证加密 · 内存零留存</p>

<p>
  <a href="https://wyj-iirtyj.github.io/offline-secure-session/"><img src="https://img.shields.io/badge/Demo-立即在线使用-10b981?style=flat-square&logo=github" alt="Demo"></a>
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
  <img src="https://img.shields.io/badge/i18n-中%20%7C%20EN%20%7C%20日-ec4899?style=flat-square" alt="i18n">
</p>

<p>
  <b>简体中文</b> &nbsp;·&nbsp;
  <a href="README.en.md">English</a> &nbsp;·&nbsp;
  <a href="README.ja.md">日本語</a>
</p>

</div>

---

一个**纯前端、纯离线、零依赖、无需服务器**的安全消息交换工具。

双方先交换公开连接码，在各自设备上通过 ECDH 协商建立同一把会话密钥；核对安全数字码确认防中间人攻击后，后续消息都只使用这把本地会话密钥进行 AES-256-GCM 加密和解密。

> 🛡️ **安全保证**：页面绝不上传任何消息、私钥或会话密钥。私钥和会话密钥不可导出，只暂存于计算内存中；页面刷新、关闭或点击“结束并清空”后即彻底失效。

---

## ⚡ 在线体验

- **立即使用**：<https://wyj-iirtyj.github.io/offline-secure-session/>
- **源码仓库**：<https://github.com/wyj-IIRtyj/offline-secure-session>

该网页本身不依赖任何网络 API、CDN、远程字体或第三方脚本。即使通过 GitHub Pages 加载，页面加载完成后的所有密码学操作均在本机浏览器中纯离线完成。

---

## ✨ 核心特性

- 📱 **多端全适配**：支持桌面端及手机移动端（iOS / Android / 微信浏览器），原生支持 Safe Area 全面屏，防 iOS 输入框自动放大。
- 🌐 **多语言支持**：内置 **简体中文 / English / 日本語** 一键热切换，用户语言偏好本地记忆。
- 🔒 **真零依赖**：没有 npm 运行时依赖、没有外部 CDN，CSP 强制限制 `connect-src 'none'`，完全可断网运行。
- 🛡️ **抗中间人攻击（MITM）**：强制 12 位安全核对码机制，未完成双向核对前绝不暴露加解密功能。
- ⚡ **Web Worker 隔离**：私钥与会话钥匙在独立 Worker 内存中运算，杜绝主线程意外泄露。
- ⏱️ **自动防留存**：10 分钟无操作自动清空会话；刷新、关闭或重置立即销毁 Worker。

---

## 🚀 使用流程

1. **各自打开页面**：双方打开网页，各自生成唯一的公开连接码。
2. **交换公开连接码**：通过微信、邮件或其他任何不受信任信道互相发送公开码（不含私钥）。
3. **计算共同密钥**：各自粘贴对方连接码，本地 ECDH 自动算出一致的共享会话钥匙。
4. **核对 12 位数字**：通过电话、语音或当面核对屏幕上的 12 位数字，确认完全一致。
5. **开始安全收发**：核对通过后直接加密发送秘密文本，对方一键解密。

整个过程中，用户**不需要管理公钥私钥对，也无需担心私钥外泄**。

---

## 🔬 密码学架构

| 环节 | 算法与规格 | 说明 |
| :--- | :--- | :--- |
| **密钥交换 (KEX)** | ECDH P-256 (`secp256r1`) | 临时非对称密钥对，私钥不可导出 (`extractable: false`) |
| **密钥派生 (KDF)** | HKDF-SHA-256 | 结合双方连接握手报文转录哈希派生会话密钥 |
| **对称加密** | AES-256-GCM | 每次加密均使用独立的 96 位强随机 IV |
| **身份与认证** | GCM 认证标签 + AAD | 协议版本、会话 ID、随机消息 ID 均作为 AAD 绑定认证 |
| **重放攻击防御** | 随机 Message ID + 内存去重 | 拒绝解密重复消息 ID，降低误重放风险 |

---

## 🚫 零留存设计

私钥和会话密钥只存在当前 Web Worker 的运行时内存中，并且以不可导出的 `CryptoKey` 形式保存。

项目坚决不使用任何持久化媒介存储密钥：
- ❌ 不写入 `localStorage`
- ❌ 不写入 `sessionStorage`
- ❌ 不使用 `IndexedDB`
- ❌ 不使用 `Cookie`
- ❌ 不使用 `Service Worker` 缓存密钥

以下操作均会立即销毁当前连接与全部内存密钥：
- 页面刷新
- 关闭标签页
- 点击“结束并清空”
- 10 分钟闲置超时

---

## 💻 本地运行与离线部署

本项目无需构建即可直接运行：

```bash
# 克隆仓库
git clone https://github.com/wyj-IIRtyj/offline-secure-session.git
cd offline-secure-session

# 启动本地服务器
npm run serve
# 或
python3 -m http.server 4173 --bind 127.0.0.1
```

启动后在浏览器访问 `http://127.0.0.1:4173`。页面加载完成后即可拔掉网线离线使用。

---

## 🧪 自动化测试

```bash
npm test
```

自动化测试套件包含 13 项严格密码学与安全机制断言：
- [x] 私钥不可导出测试
- [x] 页面状态不暴露私钥或会话密钥
- [x] 双方独立派生相同会话 ID
- [x] 双方独立派生相同安全核对码
- [x] 会话密钥不可导出
- [x] 未完成安全核对前强制拦截加解密
- [x] 核对完成后支持双向全双工加密
- [x] 相同明文产生完全随机的不同密文
- [x] 密文篡改拦截与 GCM 认证失败拒绝
- [x] 跨会话非法密文拒绝
- [x] 重复消息 ID 重放拒绝
- [x] 自身连接码自连接拒绝
- [x] 离线审计与审核接口合规

---

## 📂 项目结构

```text
.
├── index.html                 # 结构与多语言标记
├── styles.css                # 移动端自适应、黑白直角极简样式
├── app.js                    # UI 状态机、交互与多语言驱动
├── i18n.js                   # 中/英/日多语言词条字典
├── crypto-worker.mjs         # 隔离密码学状态的 Web Worker
├── session-controller.mjs    # 安全会话状态机
├── crypto-core.mjs           # ECDH / HKDF / AES-GCM 核心实现
├── tests/                    # Node.js 原生自动化测试套件
├── README.md                 # 中文说明文档
├── README.en.md              # 英文说明文档
├── README.ja.md              # 日文说明文档
├── SECURITY.md               # 安全问题披露流程
└── LICENSE                   # MIT 开源许可证
```

---

## 📄 License

本项目基于 [MIT License](LICENSE) 开源。
