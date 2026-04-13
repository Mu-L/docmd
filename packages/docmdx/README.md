<div align="center">

  <h3>
    <img src="https://github.com/docmd-io/docmd/blob/main/packages/ui/assets/images/docmd-logo-dark.png?raw=true" alt="docmd logo" width="160" />
  </h3>
  
  <p><b>Run docmd instantly. No setup required.</b></p>

  <p>
    <a href="https://www.npmjs.com/package/docmdx"><img src="https://img.shields.io/npm/v/docmdx.svg?style=flat-square&color=CB3837" alt="npm version"></a>
    <a href="https://github.com/docmd-io/docmd/blob/main/LICENSE"><img src="https://img.shields.io/github/license/docmd-io/docmd.svg?style=flat-square&color=A31F34" alt="license"></a>
  </p>

</div>

## What is docmdx?

A lightweight wrapper around [`@docmd/core`](https://www.npmjs.com/package/@docmd/core). Drop into any folder with Markdown files and get a production-ready documentation site.

## Quick Start

```bash
npx docmdx
```

Starts a dev server at `http://localhost:3000`. Navigation is generated automatically. No configuration needed.

### Build for Production

```bash
npx docmdx build
```

Generates a static site ready for deployment.

## Commands

| Command                         | Description                           |
| :------------------------------ | :------------------------------------ |
| `npx docmdx`                    | Start the dev server                  |
| `npx docmdx build`              | Build for production                  |
| `npx docmdx init`               | Scaffold a new project                |
| `npx docmdx plugin add <name>`  | Install an optional plugin            |
| `npx docmdx plugin remove <name>` | Remove an installed plugin          |

## How It Works

`docmdx` resolves your local or global `@docmd/core` installation and forwards commands to it. When no config file is present, it activates zero-config mode automatically.

## Full Installation

For advanced usage and the complete CLI:

```bash
npm install -g @docmd/core
```

Then use `docmd` directly:

```bash
docmd dev
docmd build
```

## Documentation

Full documentation: **[docmd.io](https://docmd.io)**

## License

MIT
