# @docmd/plugin-math

Adds native LaTeX/KaTeX mathematics support to **docmd** sites.

- **Zero Configuration:** Seamlessly parses `$` and `$$` syntax into rendered mathematical expressions.
- **Client-Side Rendering:** Utilizes performant KaTeX rendering in the browser without server bloat.
- **Ecosystem Native:** Fully decoupled but integrates perfectly with the docmd toolchain.

## Usage & Configuration

In your `docmd.config.js`:

```javascript
export default {
  // ...
  plugins: [
    '@docmd/plugin-math'
  ]
}
```

You can use inline math with single dollar signs:
```
$E = mc^2$
```

Or block math with double dollar signs:
```
$$
\sum_{i=1}^n i^2 = \frac{n(n+1)(2n+1)}{6}
$$
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