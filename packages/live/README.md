# @docmd/live

The browser-based engine that powers the **docmd Live Editor**.

This package bundles the core parser, UI, and themes into a standalone JavaScript bundle that can render documentation client-side without a Node.js server.

## Links
- **Live Demo:** [live.docmd.io](https://live.docmd.io)
- **Main Project:** [github.com/docmd-io/docmd](https://github.com/docmd-io/docmd)

## Usage (CLI)
You can run the editor locally:

```bash
docmd live
```

## Usage (Programmatic)
To embed the editor engine in your own tools:

```javascript
import { buildLive } from '@docmd/core';
await buildLive();
```

## The `docmd` Ecosystem

`docmd` is a modular system. Here are the official packages:

**The Engine**
*   [**@docmd/core**](https://www.npmjs.com/package/@docmd/core) - The CLI runner and build orchestrator.
*   [**@docmd/parser**](https://www.npmjs.com/package/@docmd/parser) - The pure Markdown-to-HTML logic.
*   [**@docmd/live**](https://www.npmjs.com/package/@docmd/live) - The browser-based Live Editor bundle.

**Interface & Design**
*   [**@docmd/ui**](https://www.npmjs.com/package/@docmd/ui) - Base EJS templates and assets.
*   [**@docmd/themes**](https://www.npmjs.com/package/@docmd/themes) - Official themes (Sky, Ruby, Retro).

**Plugins**
*   [**@docmd/plugin-search**](https://www.npmjs.com/package/@docmd/plugin-search) - Offline full-text search.
*   [**@docmd/plugin-pwa**](https://www.npmjs.com/package/@docmd/plugin-pwa) - Progressive Web App support.
*   [**@docmd/plugin-mermaid**](https://www.npmjs.com/package/@docmd/plugin-mermaid) - Diagrams and flowcharts.
*   [**@docmd/plugin-seo**](https://www.npmjs.com/package/@docmd/plugin-seo) - Meta tags and Open Graph data.
*   [**@docmd/plugin-sitemap**](https://www.npmjs.com/package/@docmd/plugin-sitemap) - Automatic sitemap generation.
*   [**@docmd/plugin-llms**](https://www.npmjs.com/package/@docmd/plugin-llms) - AI context generation.
*   [**@docmd/plugin-analytics**](https://www.npmjs.com/package/@docmd/plugin-analytics) - Google Analytics integration.

## License

Distributed under the MIT License. See `LICENSE` for more information.