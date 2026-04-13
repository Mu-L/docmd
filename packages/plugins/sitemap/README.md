# @docmd/plugin-sitemap

Automatically generates `sitemap.xml` for your docmd site at build time. Requires `siteUrl` in your config to produce valid absolute URLs. Bundled with `@docmd/core`.

```js
// docmd.config.js
module.exports = {
  siteUrl: 'https://mysite.com', // required
  plugins: {
    sitemap: { defaultChangefreq: 'weekly', defaultPriority: 0.8 }
  }
};
```

Part of the **[docmd](https://github.com/docmd-io/docmd)** documentation engine.

## Documentation

See **[docs.docmd.io](https://docs.docmd.io)** for full usage and API reference.

## License

MIT