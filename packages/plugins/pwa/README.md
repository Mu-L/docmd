# @docmd/plugin-pwa

Turns your **docmd** documentation into a blazingly fast, installable Progressive Web App (PWA).

## Configuration

The plugin is included in `@docmd/core` and can be enabled with a single line.

```javascript
// docmd.config.js
module.exports = {
  plugins: {
    pwa: {
      // All options are optional
      themeColor: '#0097ff',
      bgColor: '#ffffff',
      logo: 'assets/images/logo.png', // Fallback to config.logo or config.favicon
    }
  }
}
```

## Features

- **Web Manifest**: Automatically generates `manifest.webmanifest`.
- **Service Worker**: Intelligent offline caching with background updates.
- **Cache Busting**: Automatic timestamp-based cache purging on every build.
- **Ghost Removal**: Automatically unregisters workers if the plugin is disabled.

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