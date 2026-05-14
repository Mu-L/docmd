# @docmd/engine-js

Default JavaScript engine for docmd using Node.js worker threads and native async I/O. Works everywhere without any native dependencies.

Part of the **[docmd](https://github.com/docmd-io/docmd)** documentation engine.

## Usage

This engine is used by default when no `engine` configuration is specified:

```javascript
// docmd.config.js
export default {
  // No engine specified = uses 'js' engine
};
```

Explicitly select the JS engine:

```javascript
export default {
  engine: 'js'
};
```

## Capabilities

- **file-discovery**: Parallel file system traversal
- **file-read-batch**: Batched file reading
- **git-log**: Git history extraction via `git` CLI
- **search-index**: Search index building with MiniSearch

## Documentation

See **[docs.docmd.io](https://docs.docmd.io)** for full usage and API reference.

## License

MIT