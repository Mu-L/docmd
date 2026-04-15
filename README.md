<div align="right">
  <b>English<b> &nbsp;|&nbsp; <a href="./README.zh.md">中文</a> &nbsp;|&nbsp; <a href="./README.hi.md">हिन्दी</a>
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
    <b>Build production-ready documentation from Markdown in seconds.</b>
    <br/>
    Zero setup when you start. Full control when you need it.
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
      <a href="https://docmd.io">Website</a> • 
      <a href="https://docs.docmd.io/getting-started/installation/">Documentation (Preview)</a> • 
      <a href="https://live.docmd.io">Live Editor</a> •
      <a href="https://github.com/docmd-io/docmd/issues">Report Bug</a>
    </h4>
  </p>

  <!-- PREVIEW -->
  <p>
    <br/>
    <img width="800" alt="docmd preview" src="https://github.com/user-attachments/assets/05a18bd2-6f85-4c7a-9fb7-1ae5b36573b2" />
    <br/>
    <sup><i>docmd `default` theme in light appearance</i></sup>
  </p>

</div>

## Quick Start

**Run docmd instantly in any folder with Markdown files:**

```bash
npx @docmd/core dev
```
Starts: `http://localhost:3000`

**That’s it.**

- Navigation is generated automatically
- Pages render instantly
- Your docs are production-ready by default

Build your site:

```bash
npx @docmd/core build
```

### Install for regular usage

```bash
npm install -g @docmd/core
```

```bash
docmd dev    # start dev server
docmd build  # build for deployment
```

## Features

Designed to start instantly and scale without friction.

### Instant by default

* Automatic navigation from your files
* Zero configuration required
* Works directly with Markdown

### Production-ready output

* Static HTML generation
* SEO optimised (sitemap, canonical, redirects)
* Tiny JavaScript payload

### Built-in capabilities

* Internationalisation (i18n)
* Versioning
* Offline search
* PWA support
* Analytics
* AI context (`llms.txt`)

### Extensible when needed

* Plugin support
* Custom configuration and navigation
* Theming
* Programmatic API

See the full [roadmap](https://github.com/orgs/docmd-io/discussions/2).

## Project Structure

Keeps your project simple.

```bash
my-docs/
├── docs/
├── assets/
├── docmd.config.js (optional)
└── package.json
```

## Live Editor

A browser-based editor for writing and previewing docs instantly. No setup required.

**Try it: https://live.docmd.io**

## Configuration (optional)

No configuration is required to get started.

Add a config file (`docmd.config.js` in the project root) only when you need more control.

```js
const { defineConfig } = require('@docmd/core');

module.exports = defineConfig({
  title: 'My Project',
  url: 'https://docs.myproject.com',
});
```

### Common options

```js
module.exports = defineConfig({
  // Versioning
  versions: {
    current: 'v2',
    all: [
      { id: 'v2', dir: 'docs' },
      { id: 'v1', dir: 'docs-v1' }
    ]
  },

  // Internationalisation
  i18n: {
    default: 'en',
    locales: [
      { id: 'en', label: 'English', dir: 'ltr' },
      { id: 'zh', label: '中文', dir: 'ltr' },
    ]
  }
});
```

Other common settings include `src`, `out`, navigation, plugins, and theming.

### Programmatic usage

Use in scripts or CI pipelines:

```js
const { build, buildLive } = require('@docmd/core');

await build('./docmd.config.js', { isDev: false });
await buildLive();
```

### Need more?

Full configuration, plugins, and advanced usage: **[docs.docmd.io](https://docs.docmd.io)**

## Plugin Ecosystem

Core functionality is included by default.

Everything works out of the box.

Plugins are only needed when you want to extend functionality.

| Plugin      | Included | Description                                        |
| :---------- | :------- | :------------------------------------------------- |
| `search`    | ✓        | Offline full-text search with fuzzy matching       |
| `pwa`       | ✓        | Progressive Web App support for offline navigation |
| `seo`       | ✓        | SEO tags and Open Graph metadata                   |
| `sitemap`   | ✓        | Generates `sitemap.xml`                            |
| `analytics` | ✓        | Lightweight analytics integration                  |
| `llms`      | ✓        | AI context generation (`llms.txt`)                 |
| `mermaid`   | ✓        | Mermaid diagrams in Markdown                       |
| `threads`   | Optional | Inline discussion threads *(by @svallory)*         |
| `math`      | Optional | KaTeX/LaTeX math rendering                         |

Install optional plugins:

```bash
docmd plugin add <plugin-name>
```

## Why docmd?

| Feature          | docmd                     | Docusaurus           | MkDocs          | Mintlify         |
| :--------------- | :------------------------ | :------------------- | :-------------- | :--------------- |
| **Language**     | **Node.js**               | React.js             | Python          | Proprietary      |
| **Navigation**   | **Instant SPA**           | React SPA            | Page Reloads    | Hosted SPA       |
| **Output**       | **Static HTML**           | React Hydration      | Static HTML     | Hosted           |
| **JS Payload**   | **Minimal (< 20kb)**      | Heavy (> 200kb)      | Minimal         | Medium           |
| **Versioning**   | **Built-in**              | File-based (complex) | Plugin-based    | Native           |
| **i18n Support** | **Built-in**              | Native               | Theme-based     | Beta             |
| **Search**       | **Built-in (offline)**    | Algolia (cloud)      | Built-in (Lunr) | Built-in (cloud) |
| **PWA**          | **Built-in**              | Plugin               | None            | Hosted           |
| **AI Context**   | **Built-in (`llms.txt`)** | Plugin               | None            | Proprietary      |
| **Setup**        | **Instant**               | ~15 min              | ~10 min         | ~5 min           |
| **Cost**         | **Free (OSS)**            | Free (OSS)           | Free (OSS)      | Freemium         |

Starts simple. Scales without friction.

## Philosophy

Documentation tools should disappear.

Focus on writing, not setup.

No configuration overhead. No framework complexity. Just docs.

## Community & Support

* Contributions are welcome. See [CONTRIBUTING.md](.github/CONTRIBUTING.md)
* If you find it useful, consider [sponsoring](https://github.com/sponsors/mgks) or starring the repo ⭐

## License

MIT License. See `LICENSE` for details.