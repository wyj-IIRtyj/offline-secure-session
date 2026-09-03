<div align="center">

# 秘密メッセージ · Secret Message

<p><strong>完全ブラウザ完結 · 100% オフライン · ゼロ依存 · サーバー不要の暗号化メッセージ交換</strong></p>
<p>ECDH P-256 による鍵共有 · 12桁の安全コードで中間者攻撃を防止 · AES-256-GCM 認証暗号 · ゼロ永続化</p>

<p>
  <a href="https://wyj-iirtyj.github.io/offline-secure-session/"><img src="https://img.shields.io/badge/Demo-今すぐ試す-10b981?style=flat-square&logo=github" alt="Demo"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-3b82f6?style=flat-square" alt="License"></a>
  <a href="package.json"><img src="https://img.shields.io/badge/Dependencies-0%20(ゼロ依存)-8b5cf6?style=flat-square" alt="Zero Deps"></a>
  <a href="SECURITY.md"><img src="https://img.shields.io/badge/Network-100%25%20オフライン-f59e0b?style=flat-square" alt="Offline"></a>
  <a href="tests"><img src="https://img.shields.io/badge/Tests-13%2F13%20合格-059669?style=flat-square" alt="Tests"></a>
</p>
<p>
  <img src="https://img.shields.io/badge/Key%20Exchange-ECDH%20P--256-0284c7?style=flat-square" alt="ECDH">
  <img src="https://img.shields.io/badge/KDF-HKDF--SHA--256-7c3aed?style=flat-square" alt="HKDF">
  <img src="https://img.shields.io/badge/Cipher-AES--256--GCM-dc2626?style=flat-square" alt="AES-GCM">
  <img src="https://img.shields.io/badge/Isolation-Web%20Worker-9333ea?style=flat-square" alt="Worker">
  <img src="https://img.shields.io/badge/i18n-日%20%7C%20中%20%7C%20英-ec4899?style=flat-square" alt="i18n">
</p>

<p>
  <a href="README.md">简体中文</a> &nbsp;·&nbsp;
  <a href="README.en.md">English</a> &nbsp;·&nbsp;
  <b>日本語</b>
</p>

</div>

---

**完全ブラウザ完結・100% オフライン・ゼロ依存・サーバー不要** の安全なメッセージ交換ツールです。

双方が公開接続コードを交換し、それぞれの端末上で ECDH により同一のセッション鍵を算出します。中間者攻撃（MITM）を防ぐための12桁の安全確認コードを照合した後、後続のメッセージはこのセッション鍵のみを用いて AES-256-GCM で暗号化・復号されます。

> 🛡️ **ゼロ知識の安全保証**：ページがメッセージ、秘密鍵、セッション鍵を外部に送信することは一切ありません。秘密鍵およびセッション鍵はエクスポート不可であり、Web Worker の一時メモリ内のみに保持されます。再読み込み、タブを閉じる、または「終了して消去」をクリックすると直ちに破棄されます。

---

## ⚡ オンラインデモ

- **今すぐ試す**：<https://wyj-iirtyj.github.io/offline-secure-session/>
- **ソースコード**：<https://github.com/wyj-IIRtyj/offline-secure-session>

本ツールは外部 API、CDN、Web フォント、外部スクリプトに一切依存しません。GitHub Pages から静的ファイルが読み込まれた後は、すべての暗号化処理がローカルブラウザ内で完全オフラインで動作します。

---

## ✨ 主な特徴

- 📱 **マルチデバイス対応**：PC、タブレット、スマートフォン（iOS Safari、Android Chrome、LINE内ブラウザ）に完全対応。iPhone の Safe Area（ノッチ／ホームバー）および iOS 入力枠自動拡大防止に対応。
- 🌐 **多言語対応 (i18n)**：**日本語 / 简体中文 / English** をワンクリックで切り替え可能。選択言語はローカルに保存されます。
- 🔒 **完全ゼロ依存**：npm 実行時依存なし、外部 CDN なし、CSP による `connect-src 'none'` を強制。完全に通信を遮断した状態（Air-gap）でも使用可能。
- 🛡️ **中間者攻撃（MITM）防止**：12桁の安全照合コードによる事前確認を必須とし、照合前は暗号化・復号機能を一切有効化しません。
- ⚡ **Web Worker による分離**：秘密鍵とセッション鍵は独立した Web Worker のメモリ内で処理され、メインスレッドからの漏洩を防ぎます。
- ⏱️ **自動破棄（ゼロ永続化）**：10分間無操作で自動クリア。ページ更新や終了で鍵は即座に消失します。

---

## 🚀 利用の流れ

1. **ページを開く**：双方がページを開き、それぞれの一時的な公開接続コードを取得します。
2. **接続コードの交換**：メール、チャットアプリ等で互いの公開接続コードを送信します（秘密鍵は含まれません）。
3. **セッション鍵の計算**：相手の接続コードを貼り付けると、ローカルで ECDH により同一の共有鍵が算出されます。
4. **12桁の数字を照合**：通話、対面、または別の信頼できる経路で画面上の12桁の数字を読み合い、完全一致を確認します。
5. **暗号メッセージの送受信**：照合後、秘密の文章を暗号化して送信します。相手のみが復号できます。

ユーザーが**公開鍵・秘密鍵のペアを手動で管理する必要はなく、秘密鍵が外部に漏れるリスクもありません**。

---

## 🔬 暗号設計

| 階層 | アルゴリズム・規格 | 説明 |
| :--- | :--- | :--- |
| **鍵交換 (KEX)** | ECDH P-256 (`secp256r1`) | 一時的な非対称鍵ペア。秘密鍵はエクスポート不可 (`extractable: false`) |
| **鍵導出 (KDF)** | HKDF-SHA-256 | 両者の接続トランスクリプトのハッシュをバインドしてセッション鍵を導出 |
| **対称暗号** | AES-256-GCM | メッセージごとに独立した96ビットの暗号論的擬似乱数 IV を使用 |
| **認証と AAD** | GCM 認証タグ + AAD | プロトコルバージョン、セッションID、ランダムメッセージIDを AAD として拘束 |
| **リプレイ攻撃防止** | ランダムメッセージID | 重複するメッセージIDはメモリ上で拒否され、誤った再処理を防止 |

---

## 🚫 ゼロ永続化設計

秘密鍵およびセッション鍵は、Web Worker の実行時メモリ内にのみ存在し、エクスポート不可な `CryptoKey` オブジェクトとして保護されます。

以下のストレージには一切書き込みを行いません：
- ❌ `localStorage`
- ❌ `sessionStorage`
- ❌ `IndexedDB`
- ❌ `Cookie`
- ❌ `Service Worker` キャッシュ

以下のいずれかの操作により、セッションおよび鍵は直ちに完全消滅します：
- ページの再読み込み
- タブまたはブラウザを閉じる
- 「終了して消去」をクリック
- 10分間の無操作アイドル

---

## 💻 ローカル実行

ビルド不要でそのまま実行できます：

```bash
# リポジトリのクローン
git clone https://github.com/wyj-IIRtyj/offline-secure-session.git
cd offline-secure-session

# ローカルサーバーの起動
npm run serve
# または
python3 -m http.server 4173 --bind 127.0.0.1
```

ブラウザで `http://127.0.0.1:4173` にアクセスしてください。読み込み後はインターネットを切断して使用できます。

---

## 🧪 自動テスト

```bash
npm test
```

13項目の厳格な暗号学的・状態テストをパスしています：
- [x] 秘密鍵のエクスポート不可検証
- [x] ページ状態への秘密鍵・セッション鍵の非露出検証
- [x] 両者が独立して同一のセッションIDを導出することを検証
- [x] 両者が独立して同一の確認コードを導出することを検証
- [x] セッション鍵のエクスポート不可検証
- [x] 安全確認完了前の暗号化・復号の強制遮断検証
- [x] 確認完了後の双方向通信検証
- [x] 同一平文に対するランダム暗号文の生成検証
- [x] GCM認証タグによる改ざん暗号文の拒否検証
- [x] 異なるセッションの暗号文の拒否検証
- [x] 重複メッセージ（リプレイ）の拒否検証
- [x] 自己接続コードによる接続拒否検証
- [x] 監査・検証用データサービスの仕様準拠

---

## 📂 プロジェクト構成

```text
.
├── index.html                 # 構造と多言語データ属性
├── styles.css                # モバイル対応、ミニマル白黒スタイル
├── app.js                    # UI 状態遷移とイベント処理
├── i18n.js                   # 日・中・英 多言語辞書
├── crypto-worker.mjs         # 暗号演算を隔離する Web Worker
├── session-controller.mjs    # セッション状態管理ステートマシン
├── crypto-core.mjs           # ECDH / HKDF / AES-GCM Web Crypto 実装
├── tests/                    # Node.js 自動テストスイート
├── README.md                 # 簡体字中国語ドキュメント
├── README.en.md              # 英語ドキュメント
├── README.ja.md              # 日本語ドキュメント
├── SECURITY.md               # セキュリティポリシー
└── LICENSE                   # MIT ライセンス
```

---

## 📄 ライセンス

[MIT License](LICENSE) の下で公開されています。
