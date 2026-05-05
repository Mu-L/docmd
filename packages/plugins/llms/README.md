# @docmd/plugin-llms

Generates `llms.txt` and `llms-full.txt` at build time so your documentation is immediately accessible to AI agents - ChatGPT, Claude, Cursor, and any tool that follows the [llmstxt.org](https://llmstxt.org/) standard.

Bundled with `@docmd/core`. Requires `siteUrl` in your config to produce valid absolute links.

```js
// docmd.config.js
module.exports = {
  siteUrl: 'https://your-site.com',
  plugins: {
    llms: {}
  }
};
```

Part of the **[docmd](https://github.com/docmd-io/docmd)** documentation engine.

## Documentation

See **[docs.docmd.io](https://docs.docmd.io)** for full usage and API reference.

## License

MIT