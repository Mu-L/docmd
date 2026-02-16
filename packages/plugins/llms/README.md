# @docmd/plugin-llms

Automatically generate an `llms.txt` file for your documentation site to provide context for AI agents (ChatGPT, Claude, Cursor, etc.).

This plugin follows the standard defined at [llmstxt.org](https://llmstxt.org/).

## Installation

This plugin is bundled with `@docmd/core`.

## Usage

Enable the plugin in your `docmd.config.js`. **Note:** A `siteUrl` is required to generate valid absolute links for AI tools.

```javascript
module.exports = {
  siteUrl: 'https://your-site.com',
  plugins: {
    llms: {} // Enables llms.txt generation
  }
}
```

## How it works
On every build, this plugin scans your pages and creates a `/llms.txt` file in your output directory. AI tools use this file to understand the structure of your documentation and find relevant information more efficiently.

## The docmd Ecosystem

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
*   [**@docmd/plugin-mermaid**](https://www.npmjs.com/package/@docmd/plugin-mermaid) - Diagrams and flowcharts.
*   [**@docmd/plugin-seo**](https://www.npmjs.com/package/@docmd/plugin-seo) - Meta tags and Open Graph data.
*   [**@docmd/plugin-sitemap**](https://www.npmjs.com/package/@docmd/plugin-sitemap) - Automatic sitemap generation.
*   [**@docmd/plugin-llms**](https://www.npmjs.com/package/@docmd/plugin-llms) - AI context generation.
*   [**@docmd/plugin-analytics**](https://www.npmjs.com/package/@docmd/plugin-analytics) - Google Analytics integration.

## License

Distributed under the MIT License. See `LICENSE` for more information.