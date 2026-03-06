<div align="center">

  <!-- PROJECT TITLE -->
  <h3>
    <img src="https://github.com/docmd-io/docmd/blob/main/packages/ui/assets/images/docmd-logo-dark.png?raw=true" alt="docmd logo" width="210" />
  </h3>
  
  <!-- ONE LINE SUMMARY -->
  <p>
    <b>The minimalist, zero-config documentation generator.</b>
  </p>
  
  <!-- BADGES -->
  <p>
    <a href="https://www.npmjs.com/package/@docmd/core"><img src="https://img.shields.io/npm/v/@docmd/core.svg?style=flat-square&color=CB3837" alt="npm version"></a>
    <a href="https://www.npmjs.com/package/@docmd/core?activeTab=versions"><img src="https://img.shields.io/npm/d18m/%40mgks%2Fdocmd?style=flat&label=%40mgks%2Fdocmd%20(legacy)" alt="downloads"></a>
    <a href="https://www.npmjs.com/package/@docmd/core?activeTab=versions"><img src="https://img.shields.io/npm/dt/@docmd/core.svg?style=flat-square&color=38bd24" alt="downloads"></a>
    <a href="https://github.com/docmd-io/docmd/stargazers"><img src="https://img.shields.io/github/stars/docmd-io/docmd?style=flat-square&logo=github" alt="stars"></a>
    <a href="https://github.com/docmd-io/docmd/blob/main/LICENSE"><img src="https://img.shields.io/github/license/docmd-io/docmd.svg?style=flat-square&color=A31F34" alt="license"></a>
  </p>

  <!-- MENU -->
  <p>
    <h4>
      <a href="https://docmd.io">View Demo</a> • 
      <a href="https://docs.docmd.io/getting-started/installation/">Documentation</a> • 
      <a href="https://live.docmd.io">Live Editor</a> •
      <a href="https://github.com/docmd-io/docmd/issues">Report Bug</a>
    </h4>
  </p>

  <!-- PREVIEW -->
  <p>
    <br/>
    <img width="800" alt="docmd preview" src="https://github.com/user-attachments/assets/92558d3a-7c0d-46bc-862e-466c42cb7be4" />
    <br/>
    <sup><i>docmd `default` theme in light appearance</i></sup>
  </p>

</div>

## Features

- **Zero Config**: Intelligent auto-routing scans your folders and builds navigation trees instantly.
- **Versioning**: Enterprise-grade versioning (v1, v2) with sticky context switching and smart routing.
- **Super Fast**: Generates pure static HTML. No hydration gap. No heavy React/Vue overhead.
- **AI-Ready**: Automatically generates `llms.txt` and `llms-full.txt` context for AI agents.
- **PWA**: Native Progressive Web App support for offline access and smart background caching.
- **Smart Search**: Built-in, privacy-friendly offline search with deep-linking to exact headers.
- **Isomorphic**: Runs seamlessly in Node.js (CLI) or directly in the browser via Live Editor.
- **Rich Content**: Native Markdown support for Tabs, Steps, Callouts, and Mermaid diagrams.
- **SEO Optimized**: Auto-generates sitemaps, canonical tags, 404 pages, and static HTML redirects.

## Getting Started

You can run `docmd` on-the-fly without installing, or add it permanently to your long term projects.

### Option 1: Zero-Config (Try it instantly)
Run `docmd` inside any folder containing markdown files. It will automatically extract your headers and build a nested navigation sidebar.
```bash
# Start local dev server
npx @docmd/core dev -z

# Generate production static site
npx @docmd/core build -z
```
> **Note:** Zero-Config (`-z`) is currently in `beta`. It is fantastic for quick previews, but for production sites, we recommend initializing a standard configuration file for maximum control.

### Option 2: Project Installation (Recommended)
For permanent projects, install `docmd` as dependency to lock your versions.

```bash
# 1. Install locally
npm install @docmd/core

# 2. Initialize your configuration
npx docmd init

# 3. Start developing
npx docmd dev
```

### Option 3: Global Installation
Install once and use the `docmd` command anywhere on your machine.

```bash
npm install -g @docmd/core

docmd dev        # Start the local dev server
docmd build      # Generate the production static site
```

## Project Structure

`docmd` keeps your repository clean. Your content lives in `docs/`, your config in `docmd.config.js`.

```bash
my-docs/
├── docs/                  # Your Markdown Files
│   ├── index.md           # Homepage
│   └── guide.md           # Content Page
├── assets/                # Images and Custom JS/CSS
├── docmd.config.js        # The docmd Configuration
└── package.json           # Node.js Dependencies
```

## Configuration
`docmd` provides a highly flexible API. Customize your site in seconds via `docmd.config.js`. Here is a robust example showing off our most powerful features:

```javascript
const { defineConfig } = require('@docmd/core');

module.exports = defineConfig({
  title: 'My Project',
  url: 'https://mysite.com',
  src: 'docs',
  out: 'site',
  
  // Enterprise Versioning
  versions: {
    current: 'v2', // Builds to root (/) for optimal SEO
    all:[
      { id: 'v2', dir: 'docs', label: 'v2.x (Latest)' },
      { id: 'v1', dir: 'docs-v1', label: 'v1.x' }
    ]
  },

  // Layout & UI Architecture
  layout: {
    spa: true,  // Enable buttery-smooth page transitions
    header: { enabled: true },
    sidebar: { collapsible: true },
    
    optionsMenu: {
      position: 'header',
      components: {
        search: true,
        themeSwitch: true
      }
    },

    footer: {
      style: 'minimal'
    }
  },
  
  // Custom Navigation (If not using Zero-Config)
  navigation:[
    { title: 'Home', path: '/', icon: 'home' },
    {
      title: 'Guide',
      icon: 'book-open',
      children:[
        { title: 'Installation', path: '/installation' },
        { title: 'API Reference', path: '/api' },
      ],
    }
  ],

  // Theme Settings
  theme: {
    name: 'sky',            // 'default', 'sky', 'ruby', 'retro'
    defaultMode: 'system',  // 'light', 'dark', 'system'
  },

  // Powerful Plugins (Zero setup required)
  plugins: {
    search: {},
    pwa: { themeColor: '#0097ff' },  // Makes your docs installable!
    llms: { fullContext: true },     // Generates llms-full.txt
    mermaid: {}
  },

  // SEO & Error Handling
  redirects: { '/old-guide': '/installation' },
  notFound: { title: 'Page Not Found', content: 'This page has moved.' }
});
```

## Advanced Usage

### Programmatic API
`docmd` exports its core engine, allowing you to build documentation programmatically within your own Node.js scripts or CI/CD pipelines.

```javascript
const { build, buildLive } = require('@docmd/core');

// Trigger a standard documentation build
await build('./docmd.config.js', { 
  isDev: false, 
  offline: false 
});

// Build the Live Editor standalone bundle
await buildLive(); 
```

### Live Editor (`docmd live`)
`docmd` features an isomorphic architecture. Running `npx @docmd/core live` builds a standalone web application where you can write Markdown and see the preview instantly without any server-side processing.

> You can also try our **[docmd live](https://live.docmd.io)** editor online.

## Comparison

| Feature | docmd | Docusaurus | MkDocs | Mintlify |
| :--- | :--- | :--- | :--- | :--- |
| **Language** | **Node.js** | React.js | Python | Proprietary |
| **Navigation** | **Instant SPA** | React SPA | Page Reloads | Hosted SPA |
| **Output** | **Static HTML** | React Hydration | Static HTML | Hosted |
| **JS Payload** | **Tiny (< 20kb)** | Heavy (> 200kb) | Minimal | Medium |
| **Versioning** | **Easy (Config + Auto)** | Complex (FS) | Plugin (Mike) | Native |
| **i18n Support** | **In Pipeline** | Native | Theme-based | Beta |
| **Search** | **Built-in (Offline)** | Algolia (Cloud) | Built-in (Lunr) | Built-in (Cloud) |
| **PWA** | **Built-in (Plugin)** | Plugin | None | Hosted |
| **AI Context** | **Built-in (llms.txt)** | Plugin | None | Proprietary |
| **Setup** | **Instant (-z)** | ~15 mins | ~10 mins | ~5 mins |
| **Cost** | **Free OSS** | Free OSS | Free OSS | Freemium |

## Community & Support
- **Contributing**: We welcome PRs! See [CONTRIBUTING.md](.github/CONTRIBUTING.md).
- **Support**: If you find `docmd` useful, please consider [sponsoring the project](https://github.com/sponsors/mgks) or giving it a star ⭐.

## License
Distributed under the MIT License. See `LICENSE` for more information.

![Website Badge](https://img.shields.io/badge/.*%20mgks.dev-blue?style=flat&link=https%3A%2F%2Fmgks.dev) ![Sponsor Badge](https://img.shields.io/badge/%20%20Become%20a%20Sponsor%20%20-red?style=flat&logo=github&link=https%3A%2F%2Fgithub.com%2Fsponsors%2Fmgks)