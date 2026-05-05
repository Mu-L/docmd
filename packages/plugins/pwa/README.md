# @docmd/plugin-pwa

Makes your docmd site installable and offline-capable - generates a web manifest and service worker with intelligent caching and automatic cache busting on every build. Bundled with `@docmd/core`.

```js
// docmd.config.js - all options are optional
module.exports = {
  plugins: {
    pwa: {
      themeColor: '#0097ff',
      bgColor: '#ffffff',
      logo: 'assets/images/logo.png'
    }
  }
};
```

Part of the **[docmd](https://github.com/docmd-io/docmd)** documentation engine.

## Documentation

See **[docs.docmd.io](https://docs.docmd.io)** for full usage and API reference.

## License

MIT