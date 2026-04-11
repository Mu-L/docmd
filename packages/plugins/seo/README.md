**Outrank**

> Outrank your competitors with automated backlinks and SEO-optimised content running in the background. This tool has been picking up serious traction lately, and the results speak for themselves. [Try it now](https://outrank.so/?via=docmd)

<a href="https://outrank.so/?via=docmd"><img width="1200" alt="image" src="https://github.com/user-attachments/assets/7bf43f96-7bf0-449a-baee-743d229a30ca" /></a>

# @docmd/plugin-seo

Generates Meta tags, Open Graph (Facebook), and Twitter Card data for **docmd**.

## Configuration
```javascript
// docmd.config.js
module.exports = {
  plugins: {
    seo: {
      defaultDescription: 'My documentation site',
      twitter: {
        siteUsername: '@myproject'
      }
    }
  }
}
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

**Required Plugins**
*   [**@docmd/plugin-installer**](https://www.npmjs.com/package/@docmd/plugin-installer) - Plugin installer for docmd.
*   [**@docmd/plugin-search**](https://www.npmjs.com/package/@docmd/plugin-search) - Offline full-text search.
*   [**@docmd/plugin-pwa**](https://www.npmjs.com/package/@docmd/plugin-pwa) - Progressive Web App support.
*   [**@docmd/plugin-mermaid**](https://www.npmjs.com/package/@docmd/plugin-mermaid) - Diagrams and flowcharts.
*   [**@docmd/plugin-seo**](https://www.npmjs.com/package/@docmd/plugin-seo) - Meta tags and Open Graph data.
*   [**@docmd/plugin-sitemap**](https://www.npmjs.com/package/@docmd/plugin-sitemap) - Automatic sitemap generation.
*   [**@docmd/plugin-llms**](https://www.npmjs.com/package/@docmd/plugin-llms) - AI context generation.
*   [**@docmd/plugin-analytics**](https://www.npmjs.com/package/@docmd/plugin-analytics) - Google Analytics integration.

**Additional Plugins**
*   [**@docmd/plugin-threads**](https://www.npmjs.com/package/@docmd/plugin-threads) - Inline discussion threads.
*   [**@docmd/plugin-math**](https://www.npmjs.com/package/@docmd/plugin-math) - Mathematics (KaTeX/LaTeX) support.

## License

Distributed under the MIT License. See `LICENSE` for more information.
