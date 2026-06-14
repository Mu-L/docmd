<div align="right">
  <sup>
    <a href="./README.md">EN</a> &nbsp;|&nbsp; <a href="./README.es.md">ES</a> &nbsp;|&nbsp; <a href="./README.de.md">DE</a> &nbsp;|&nbsp; <b>日本語</b> &nbsp;|&nbsp; <a href="./README.fr.md">FR</a> &nbsp;|&nbsp; <a href="./README.zh.md">中文</a>
  </sup>
</div>

<div align="center">

  <!-- PROJECT TITLE -->
  <h3>
    <a href="https://docmd.io">
      <img src="https://github.com/docmd-io/docmd/blob/main/packages/ui/assets/images/docmd-logo-dark.png?raw=true" alt="docmd logo" width="210" />
    </a>
  </h3>
  
  <!-- ONE LINE SUMMARY -->
  <p>
    <b>Markdownからわずか数秒で、実運用可能なドキュメントを構築できます。</b>
    <br/>
    開発者とLLMエージェントのための、AIファースト＆ゼロ構成ドキュメントエンジン。
  </p>
  
  <!-- BADGES -->
  <p>
    <a href="https://www.npmjs.com/package/@docmd/core"><img src="https://img.shields.io/npm/v/@docmd/core.svg?style=flat-square&color=CB3837" alt="npm version"></a>
    <a href="https://www.npmjs.com/package/@docmd/core?activeTab=versions"><img src="https://img.shields.io/npm/dm/@docmd/core.svg?style=flat-square&color=38bd24" alt="downloads"></a>
    <a href="https://github.com/docmd-io/docmd"><img src="https://img.shields.io/github/stars/docmd-io/docmd?style=flat-square&logo=github" alt="stars"></a>
    <a href="https://github.com/docmd-io/docmd/blob/main/LICENSE"><img src="https://img.shields.io/github/license/docmd-io/docmd.svg?style=flat-square&color=A31F34" alt="license"></a>
  </p>

  <!-- MENU -->
  <p>
    <h4>
      <a href="https://docmd.io">ウェブサイト</a> • 
      <a href="https://docs.docmd.io">ドキュメント</a> • 
      <a href="https://live.docmd.io">ライブエディタ</a> •
      <a href="https://github.com/docmd-io/docmd-skills">Agent Skills</a> •
      <a href="https://github.com/docmd-io/docmd/issues">バグを報告</a>
    </h4>
  </p>

  <!-- PREVIEW -->
  <p>
    <br/>
    <a href="https://docs.docmd.io">
      <img width="800" alt="docmd preview" src="https://raw.githubusercontent.com/docmd-io/docmd/refs/heads/main/assets/docmd-cover.webp" />
    </a>
    <br/>
    <sup><i>docmd `default` テーマ  -  ライトモード and ダークモードのプレビュー</i></sup>
  </p>

</div>

## クイックスタート

**Markdownファイルがある任意のフォルダで、即座にdocmdを実行できます：**

```bash
npx @docmd/core dev
```
起動先： `http://localhost:3000`

**これだけです。**

- ナビゲーションは自動的に生成されます
- ページは即座にレンダリングされます
- 作成されたドキュメントは、デフォルトで実運用可能な状態です

サイトの構築：

```bash
npx @docmd/core build
```

### 通常使用のためのインストール

```bash
npm install -g @docmd/core
```

または Docker で実行：

```bash
docker run -p 3000:3000 ghcr.io/docmd-io/docmd:0.8.6
```

```bash
docmd dev     # 開発サーバーの起動
docmd build   # デプロイ用のビルド作成
docmd migrate # 他のツール（Docusaurus、VitePress、MkDocsなど）からの移行
docmd deploy  # Docker, Nginx, Caddyの設定を即座に生成
```

## 特徴

即座に開始でき、摩擦なくスケーリングできるように設計されています。

### デフォルトで即座に開始

* ファイルからナビゲーションを自動生成
* 設定は一切不要
* Markdownで直接動作

### 実運用可能な出力

* 静的HTML生成
* SEO优化 (sitemap, canonical, リダイレクト)
* 極小のJavaScriptペイロード

### 組み込み機能

* 国際化 (i18n)
* バージョニング
* オフライン検索
* PWA対応
* アナリティクス
* AI文脈 (`llms.txt`)

### AI-First 統合

* ネイティブ **MCP サーバー** (`docmd mcp`) — AI エージェントが stdio 経由でドキュメントを検索、読み取り、検証
* エージェントスキルセット ([docmd-skills](https://github.com/docmd-io/docmd-skills)) — LLM および IDE エージェント用のモジュール式スキル
* `llms.txt` / `llms-full.txt` — ビルド時に生成される完全なドキュメントコンテキスト
* Copy Markdown / Copy Context ウィジェット — AI チャット向けに最適化されたブラウザボタン

### 必要に応じて拡張可能

* プラグイン対応
* カスタム設定とナビゲーション
* テーミング
* プログラムによるAPI利用

詳細は [ロードマップ](https://github.com/orgs/docmd-io/discussions/2) をご覧ください。

## プロジェクト構造

プロジェクトをシンプルに保ちます。

```bash
my-docs/
├── docs/
├── assets/
├── docmd.config.json (オプション)
└── package.json
```

## ライブエディタ

ブラウザベースのエディタで、ドキュメントを即座に記述・プレビューできます。セットアップは不要です。

**試してみる： [live.docmd.io](https://live.docmd.io)**

## 設定 (オプション)

開始にあたって設定は不要です。

より詳細なコントロールが必要な場合のみ、プロジェクトのルートに設定ファイル (`docmd.config.json`) を追加してください。

```js
const { defineConfig } = require('@docmd/core');

module.exports = defineConfig({
  title: 'マイプロジェクト',
  url: 'https://docs.myproject.jp',
});
```

### 一般的なオプション

```js
module.exports = defineConfig({
  // バージョニング
  versions: {
    current: 'v2',
    all: [
      { id: 'v2', dir: 'docs' },
      { id: 'v1', dir: 'docs-v1' }
    ]
  },

  // 国際化
  i18n: {
    default: 'en',
    locales: [
      { id: 'en', label: 'English' },
      { id: 'zh', label: '中文' },
    ]
  }
});
```

*英語、ヒンディー語、中国語、スペイン語、ドイツ語、日本語、フランス語の組み込みサポート。他の言語も簡単に追加・サポート可能です。*

その他の一般的な設定には、`src`、`out`、ナビゲーション、プラグイン、テーミングなどがあります。

### プログラムによる利用

スクリプトやCIパイプラインでの利用：

```js
const { build, buildLive } = require('@docmd/core');

await build('./docmd.config.json', { isDev: false });
await buildLive();
```

### もっと詳しく知りたいですか？

完全な設定、プラグイン、高度な使用法については、**[docs.docmd.io](https://docs.docmd.io)** をご覧ください。

## プラグインエコシステム

コア機能はデフォルトで含まれています。

すべてが設定なしで動作します。

機能を拡張したい場合にのみ、プラグインが必要です。

| プラグイン    | 同梱     | 説明                                             |
| :---------- | :------- | :---------------------------------------------- |
| `search`    | ✓        | あいまい検索対応のオフライン全文検索                  |
| `seo`       | ✓        | SEOタグとOpen Graphメタデータ                      |
| `sitemap`   | ✓        | `sitemap.xml`を生成                              |
| `git`       | ✓        | Gitコミット履歴ロガー                              |
| `analytics` | ✓        | 軽量なアナリティクス統合                            |
| `llms`      | ✓        | AIコンテキスト生成 (`llms.txt`)                    |
| `mermaid`   | ✓        | Markdown内のMermaidダイアグラム                    |
| `openapi`   | ✓        | ビルド時のOpenAPI 3.xスペックレンダラー              |
| `pwa`       | Optional | オフラインナビゲーション用PWAサポート                 |
| `threads`   | Optional | インラインディスカッションスレッド *(by @svallory)*   |
| `math`      | Optional | KaTeX/LaTeXによる数式レンダリング                   |

オプションのプラグインをインストールする：

```bash
docmd add <plugin-name>
```

## なぜ docmd なのか？

| 特徴              | docmd                     | Docusaurus           | MkDocs Material | VitePress        | Mintlify         |
| :---------------- | :------------------------ | :------------------- | :-------------- | :--------------- | :--------------- |
| **言語**          | **Node.js**               | React.js             | Python          | Vue              | SaaS             |
| **設定の必要性**  | **なし**                  | `docusaurus.config.js` | `mkdocs.yml`  | `config.mts`     | `mint.json`      |
| **複数プロジェクト**| **ネイティブ**             | プラグイン           | プラグイン      | なし             | なし             |
| **初期ペイロード**| **~18kb**                 | ~250kb               | ~40kb           | ~50kb            | ~120kb           |
| **ナビゲーション**| **即座にSPA**             | React SPA            | フルリロード    | Vue SPA          | ホスト型SPA      |
| **バージョニング**| **組み込み**              | ネイティブ（複雑）   | mikeプラグイン   | 手動             | ネイティブ       |
| **i18n**          | **組み込み**              | ネイティブ（複雑）   | プラグインベース | 手動             | ネイティブ       |
| **検索**          | **組み込み（オフライン）**| Algolia（クラウド）  | 組み込み        | MiniSearch        | クラウド         |
| **AI文脈**        | **組み込み（`llms.txt`）**| 手動                 | なし            | なし             | プロプライエタリ |
| **MCP サーバー**  | **組み込み**              | なし                 | なし            | なし             | 組み込み         |
| **Agent Skills**  | **組み込み**              | なし                 | なし            | なし             | 組み込み         |
| **Dockerイメージ**| **公式**                  | なし                 | 公式            | なし             | N/A              |
| **PWA**           | **公式プラグイン**        | コミュニティプラグイン | なし            | なし             | ホスト型         |
| **セルフホスト**  | **はい**                  | はい                 | はい            | はい             | いいえ           |
| **コスト**        | **無料 (OSS)**            | 無料 (OSS)           | 無料 (OSS)      | 無料 (OSS)       | フリーミアム     |

シンプルに始まり、摩擦なく拡張できます。

## 理念

ドキュメント作成ツールは、黒子であるべきです。

設定ではなく執筆に集中しましょう。

設定のオーバーヘッドも、フレームワークの複雑さもありません。あるのは、ドキュメントだけです。

## コミュニティとサポート

* 貢献を歓迎します。 [CONTRIBUTING.md](.github/CONTRIBUTING.md) をご覧ください。
* もし役立つと感じたら、 [スポンサー](https://github.com/sponsors/mgks) になるか、リポジトリに星を ⭐ つけてください。

## ライセンス

MITライセンス。詳細は `LICENSE` をご覧ください。
