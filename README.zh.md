<div align="right">
  <a href="./README.md">English</a> &nbsp;|&nbsp; <b>中文</b><!-- &nbsp;|&nbsp; <a href="./README.hi.md">हिन्दी</a>-->
</div>

<div align="center">

  <!-- 项目标题 -->
  <h3>
    <a href="https://docmd.io">
      <img src="https://github.com/docmd-io/docmd/blob/main/packages/ui/assets/images/docmd-logo-dark.png?raw=true" alt="docmd logo" width="210" />
    </a>
  </h3>
  
  <!-- 一行摘要 -->
  <p>
    <b>几秒钟内从 Markdown 构建生产就绪的文档。</b>
    <br/>
    开始时零配置。需要时完全掌控。
  </p>
  
  <!-- 徽章 -->
  <p>
    <a href="https://www.npmjs.com/package/@docmd/core"><img src="https://img.shields.io/npm/v/@docmd/core.svg?style=flat-square&color=CB3837" alt="npm 版本"></a>
    <a href="https://www.npmjs.com/package/@docmd/core?activeTab=versions"><img src="https://img.shields.io/npm/dm/@docmd/core.svg?style=flat-square&color=38bd24" alt="下载量"></a>
    <a href="https://github.com/docmd-io/docmd"><img src="https://img.shields.io/github/stars/docmd-io/docmd?style=flat-square&logo=github" alt="星标"></a>
    <a href="https://github.com/docmd-io/docmd/blob/main/LICENSE"><img src="https://img.shields.io/github/license/docmd-io/docmd.svg?style=flat-square&color=A31F34" alt="许可证"></a>
  </p>

  <!-- 菜单 -->
  <p>
    <h4>
      <a href="https://docmd.io">官网</a> • 
      <a href="https://docs.docmd.io">文档</a> • 
      <a href="https://live.docmd.io">在线编辑器</a> •
      <a href="https://github.com/docmd-io/docmd/issues">报告问题</a>
    </h4>
  </p>

  <!-- 预览 -->
  <p>
    <br/>
    <img width="800" alt="docmd preview" src="https://raw.githubusercontent.com/docmd-io/docmd/refs/heads/main/assets/docmd-cover.webp" />
    <br/>
    <sup><i>docmd `default` 主题 — 浅色和深色模式预览</i></sup>
  </p>

</div>

## 快速开始

**在任意含有 Markdown 文件的目录中立即运行 docmd：**

```bash
npx @docmd/core dev
```
启动地址：`http://localhost:3000`

**就这么简单。**

- 导航自动生成
- 页面即时渲染
- 文档默认生产就绪

构建站点：

```bash
npx @docmd/core build
```

### 常规安装

```bash
npm install -g @docmd/core
```

```bash
docmd dev    # 启动开发服务器
docmd build  # 构建部署产物
```

## 功能特性

专为即时启动、无缝扩展而设计。

### 即开即用

* 从文件自动生成导航
* 无需任何配置
* 直接支持 Markdown

### 生产就绪输出

* 静态 HTML 生成
* SEO 优化（站点地图、canonical、重定向）
* 极小 JavaScript 负载

### 内置能力

* 国际化（i18n）
* 版本管理
* 离线搜索
* PWA 支持
* 数据分析
* AI 上下文（`llms.txt`）

### 按需扩展

* 插件支持
* 自定义配置与导航
* 主题定制
* 编程 API

查看完整[路线图](https://github.com/orgs/docmd-io/discussions/2)。

## 项目结构

保持项目简洁。

```bash
my-docs/
├── docs/
├── assets/
├── docmd.config.js（可选）
└── package.json
```

## 在线编辑器

基于浏览器的编辑器，即时编写和预览文档，无需任何配置。

**立即体验：[live.docmd.io](https://live.docmd.io)**

## 配置（可选）

开始使用无需任何配置。

仅在需要更多控制时，在项目根目录添加配置文件（`docmd.config.js`）。

```js
const { defineConfig } = require('@docmd/core');

module.exports = defineConfig({
  title: '我的项目',
  url: 'https://docs.myproject.com',
});
```

### 常用选项

```js
module.exports = defineConfig({
  // 版本管理
  versions: {
    current: 'v2',
    all: [
      { id: 'v2', dir: 'docs' },
      { id: 'v1', dir: 'docs-v1' }
    ]
  },

  // 国际化
  i18n: {
    default: 'en',
    locales: [
      { id: 'en', label: 'English' },
      { id: 'zh', label: '中文' },
    ]
  }
});
```

其他常用设置包括 `src`、`out`、导航、插件和主题。

### 编程式使用

在脚本或 CI 流水线中使用：

```js
const { build, buildLive } = require('@docmd/core');

await build('./docmd.config.js', { isDev: false });
await buildLive();
```

### 需要更多？

完整配置、插件和高级用法：**[docs.docmd.io](https://docs.docmd.io)**

## 插件生态

核心功能默认已包含。

一切开箱即用。

仅当需要扩展功能时才需要插件。

| 插件 | 包含 | 说明 |
| :---------- | :------- | :------------------------------------------------- |
| `search` | ✓ | 支持模糊匹配的离线全文搜索 |
| `seo` | ✓ | SEO 标签与 Open Graph 元数据 |
| `sitemap` | ✓ | 生成 `sitemap.xml` |
| `analytics` | ✓ | 轻量级数据分析集成 |
| `llms` | ✓ | AI 上下文生成（`llms.txt`） |
| `mermaid` | ✓ | Markdown 中的 Mermaid 图表 |
| `pwa` | 可选 | 支持离线浏览的渐进式 Web 应用 |
| `threads` | 可选 | 内联讨论线程 *(by @svallory)* |
| `math` | 可选 | KaTeX/LaTeX 数学公式渲染 |

安装可选插件：

```bash
docmd add <plugin-name>
```

## 为什么选择 docmd？

| 特性 | docmd | Docusaurus | MkDocs Material | VitePress | Mintlify |
| :--------------- | :------------------------ | :------------------- | :-------------- | :--------------- | :--------------- |
| **语言** | **Node.js** | React.js | Python | Vue | SaaS |
| **配置要求** | **无** | `docusaurus.config.js` | `mkdocs.yml` | `config.mts` | `mint.json` |
| **初始负载** | **~18kb** | ~250kb | ~40kb | ~50kb | ~120kb |
| **导航** | **即时 SPA** | React SPA | 页面刷新 | Vue SPA | 托管 SPA |
| **版本管理** | **内置** | 原生（复杂） | mike 插件 | 手动 | 原生 |
| **i18n** | **内置** | 原生（复杂） | 基于插件 | 手动 | 原生 |
| **搜索** | **内置（离线）** | Algolia（云端） | 内置 | MiniSearch | 云端 |
| **AI 上下文** | **内置（`llms.txt`）** | 手动 | 无 | 无 | 专有 |
| **PWA** | **官方插件** | 社区插件 | 无 | 无 | 托管 |
| **自托管** | **是** | 是 | 是 | 是 | 否 |
| **零配置** | **`npx @docmd/core dev`** | 否 | 否 | 否 | 否 |
| **费用** | **免费（OSS）** | 免费（OSS） | 免费（OSS） | 免费（OSS） | 免费增值 |

简单起步，无缝扩展。

## 设计理念

文档工具应该隐于无形。

专注于写作，而非配置。

无配置负担。无框架复杂性。只有文档本身。

## 社区与支持

* 欢迎贡献。请参阅 [CONTRIBUTING.md](.github/CONTRIBUTING.md)
* 如果觉得有用，欢迎[赞助](https://github.com/sponsors/mgks)或给仓库点 ⭐

## 许可证

MIT 许可证。详情请见 `LICENSE`。