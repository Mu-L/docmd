<div align="center">

  <h3>
    <img src="https://github.com/docmd-io/docmd/blob/main/packages/ui/assets/images/docmd-logo-dark.png?raw=true" alt="docmd logo" width="160" />
  </h3>

  <p><b>Run docmd instantly, from anywhere. No installation required.</b></p>

  <p>
    <a href="https://www.npmjs.com/package/docmdx"><img src="https://img.shields.io/npm/v/docmdx.svg?style=flat-square&color=CB3837" alt="npm version"></a>
    <a href="https://www.npmjs.com/package/docmdx?activeTab=versions"><img src="https://img.shields.io/npm/dt/docmdx.svg?style=flat-square&color=38bd24" alt="downloads"></a>
    <a href="https://github.com/docmd-io/docmd/blob/main/LICENSE"><img src="https://img.shields.io/github/license/docmd-io/docmd.svg?style=flat-square&color=A31F34" alt="license"></a>
  </p>

  <p>
    <a href="https://docmd.io">Website</a> &nbsp;•&nbsp;
    <a href="https://docs.docmd.io">Documentation</a> &nbsp;•&nbsp;
    <a href="https://live.docmd.io">Live Editor</a>
  </p>

</div>

---

## What is docmdx?

A lightweight launcher for [`@docmd/core`](https://www.npmjs.com/package/@docmd/core). Drop it into any folder with Markdown files and get a production-ready documentation site with no setup.

## Quick Start

```bash
npx docmdx
```

Starts a dev server at `http://localhost:3000`. Navigation is generated from your files automatically. No config needed.

```bash
npx docmdx build
```

Builds a static site, ready to deploy anywhere.

## Commands

All commands are forwarded to the underlying `@docmd/core` CLI. The `dev` and `build` commands automatically activate zero-config mode when no config file is detected.

| Command | Description |
| :--- | :--- |
| `npx docmdx` | Start the dev server |
| `npx docmdx build` | Build for production |
| `npx docmdx init` | Scaffold a new documentation project |
| `npx docmdx live` | Open in Live Editor mode |
| `npx docmdx migrate` | Migrate an older project |
| `npx docmdx plugin add <name>` | Install an optional plugin |
| `npx docmdx plugin remove <name>` | Remove an installed plugin |
| `npx docmdx stop` | Stop any running background process |

## Options

```
-p, --port <n>     Dev server port (default: 3000)
-c, --config <f>   Path to a config file
-z, --zero-config  Force zero-config mode
-V, --version      Show version
-h, --help         Show help
```

## How It Works

`docmdx` resolves your locally installed `@docmd/core` first, then falls back to a globally installed `docmd` on your PATH. Zero-config mode is activated automatically when no `docmd.config.js` is present.

## Full Installation

For ongoing use in a project or globally:

```bash
# local dependency
npm install @docmd/core

# or global CLI
npm install -g @docmd/core
```

Then use `docmd` directly:

```bash
docmd dev
docmd build
```

---

Full documentation at **[docmd.io](https://docmd.io)**