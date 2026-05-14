# @docmd/engine-rust

Rust-accelerated engine for docmd with native I/O and parallel processing. Provides significant performance improvements for large documentation sites.

Part of the **[docmd](https://github.com/docmd-io/docmd)** documentation engine.

## Installation

The Rust engine is optional and installed on-demand. To use it:

```javascript
// docmd.config.js
export default {
  engine: 'rust'
};
```

On first run, docmd will prompt you to install the appropriate native binary for your platform.

## Supported Platforms

| Platform | Package |
|----------|---------|
| macOS (ARM64) | `@docmd/engine-rust-darwin-arm64` |
| macOS (x64) | `@docmd/engine-rust-darwin-x64` |
| Linux (x64, glibc) | `@docmd/engine-rust-linux-x64-gnu` |
| Linux (ARM64, glibc) | `@docmd/engine-rust-linux-arm64-gnu` |
| Windows (x64) | `@docmd/engine-rust-win32-x64-msvc` |

## Capabilities

- **file-discovery**: Parallel directory traversal with native filesystem APIs
- **file-read-batch**: Memory-mapped file reading for large batches
- **git-log**: Direct libgit2 integration (no git CLI required)
- **search-index**: SIMD-accelerated text processing

## When to Use

The Rust engine is recommended for:

- Large documentation sites (1000+ pages)
- Projects with extensive Git history
- Multi-project monorepo builds
- CI/CD pipelines where build time is critical

For smaller sites or development mode, the default JS engine may be more convenient.

## Documentation

See **[docs.docmd.io](https://docs.docmd.io)** for full usage and API reference.

## License

MIT