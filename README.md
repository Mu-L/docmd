<div align="center">

  <!-- PROJECT TITLE -->
  <h3>
    <img src="https://github.com/docmd-io/docmd/blob/main/packages/ui/assets/images/docmd-logo-dark.png?raw=true" alt="docmd logo" width="210" />
    <!-- docmd -->
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
    <img width="800" alt="docmd preview" src="https://github.com/user-attachments/assets/1a74d6f7-10f9-41fa-be8a-faeee278dbb9" />
    <br/>
    <sup><i>docmd noStyle page preview in light mode</i></sup>
  </p>

</div>

## Features

- **Zero Config**: Works out of the box with sensible defaults.
- **Fast**: Generates pure static HTML. No heavy JS frameworks.
- **AI-Ready**: Automatically generates `llms.txt` for AI agents (ChatGPT, Claude, Cursor).
- **Smart Search**: Built-in, privacy-friendly full-text search.
- **Isomorphic**: Runs in Node.js (CLI) or directly in the browser.
- **Rich Content**: Native support for Tabs, Steps, Callouts, and Mermaid diagrams.
- **Theming**: Beautiful light/dark modes and multiple pre-built themes.

## Installation

```bash
npm install -g @docmd/core
```

## Usage

### CLI

The Command Line Interface is the primary way to interact with `docmd`.

```bash
docmd init      # Initialize a new project with V2 config
docmd dev       # Start a local development server with hot-reload
docmd build     # Generate a production-ready static site in ./site
docmd live      # Launch the browser-based Live Editor locally
docmd migrate   # Automatically upgrade legacy configs to latest structures
```

### API

`docmd` exports its core engine, allowing you to build documentation programmatically within your own Node.js scripts or build tools.

```javascript
const { build, buildLive } = require('@docmd/core');

// Trigger a standard documentation build
await build('./docmd.config.js', { 
  isDev: false, 
  preserve: true 
});

// Trigger a Live Editor bundle build
await buildLive(); 
```

### Live Editor

`docmd` features a modular architecture that allows the core engine to run client-side. 

Running `docmd live` builds a standalone web application where you can write Markdown and see the preview instantly without any server-side processing. You can embed the generated `docmd-live.js` bundle to add Markdown capabilities to your own applications.

## Project Structure

`docmd` keeps it simple. Your content lives in `docs/`, your config in `docmd.config.js`.

```bash
my-docs/
├── docs/                  # Your Markdown files
│   ├── index.md           # Homepage
│   └── guide.md           # Content page
├── assets/                # Images and custom CSS
├── docmd.config.js        # Configuration
└── package.json
```

## Configuration

Customize your site in seconds via `docmd.config.js`:

```javascript
module.exports = {
  siteTitle: 'My Project',
  siteUrl: 'https://mysite.com',
  srcDir: 'docs',
  outputDir: 'site',
  
  // V2 Layout Architecture
  layout: {
    spa: true, // Enable seamless page transitions
    header: { enabled: true },
    sidebar: { collapsible: true },
    
    // Unified Options Menu
    optionsMenu: {
      position: 'header', // 'header' or 'sidebar-bottom'
      components: {
        search: true,
        themeSwitch: true,
        sponsor: 'https://github.com/sponsors/me'
      }
    },

    // Multi-column Footer
    footer: {
      style: 'complete',
      copyright: '© 2026 My Project',
      columns: [
        { 
          title: 'Resources', 
          links: [{ text: 'Guide', url: '/guide' }] 
        }
      ]
    }
  },
  
  // Theme Settings
  theme: {
    name: 'sky',
    defaultMode: 'system'
  },

  // Plugins
  plugins: {
    seo: { /* ... */ },
    sitemap: { /* ... */ }
  }
}
```

## Comparison

| Feature | docmd | Docusaurus | MkDocs | Mintlify |
| :--- | :--- | :--- | :--- | :--- |
| **Language** | **Node.js** | React.js | Python | Proprietary |
| **Navigation** | **Instant SPA** | React SPA | Page Reloads | Hosted SPA |
| **Output** | **Static HTML** | React Hydration | Static HTML | Hosted |
| **JS Payload** | **Tiny (< 20kb)** | Heavy (> 200kb) | Minimal | Medium |
| **Search** | **Built-in (Offline)** | Algolia (Cloud) | Built-in (Lunr) | Built-in (Cloud) |
| **Setup** | **~1 min** | ~15 mins | ~10 mins | Instant |
| **Cost** | **Free OSS** | Free OSS | Free OSS | Freemium |

## Community & Support

- **Contributing**: We welcome PRs! See [CONTRIBUTING.md](.github/CONTRIBUTING.md).
- **Support**: If you find `docmd` useful, please consider [sponsoring the project](https://github.com/sponsors/mgks) or giving it a star ⭐.

## License

Distributed under the MIT License. See `LICENSE` for more information.

> **{ github.com/mgks }**
> 
> ![Website Badge](https://img.shields.io/badge/Visit-mgks.dev-blue?style=flat&link=https%3A%2F%2Fmgks.dev) ![Sponsor Badge](https://img.shields.io/badge/%20%20Become%20a%20Sponsor%20%20-red?style=flat&logo=github&link=https%3A%2F%2Fgithub.com%2Fsponsors%2Fmgks)
