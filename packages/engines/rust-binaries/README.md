# @docmd/engine-rust-binaries

**Maintainer-only package.** Contains the Rust source code and pre-built native binaries for the docmd Rust engine.

## Structure

```
native/
  Cargo.toml          - Rust crate definition
  build.rs            - napi-rs build script
  src/lib.rs          - All Rust engine capabilities (edit this to add features)

bin/
  docmd-engine-darwin-arm64.node   - macOS Apple Silicon (753KB)
  docmd-engine-darwin-x64.node     - macOS Intel
  docmd-engine-linux-x64.node      - Linux x64
  docmd-engine-linux-arm64.node    - Linux ARM64
  docmd-engine-win32-x64.node      - Windows x64
```

## For Maintainers

### Adding new capabilities

1. Edit `native/src/lib.rs` - add your new task handler
2. Run `pnpm --filter @docmd/engine-rust-binaries run build`
3. Commit the updated binary in `bin/`
4. The new capability is now available to all users

### Building binaries

```bash
# Build for current platform
pnpm --filter @docmd/engine-rust-binaries run build

# You need to build on each platform:
# - macOS ARM64 (Apple Silicon Mac)
# - macOS x64 (Intel Mac)
# - Linux x64
# - Linux ARM64
# - Windows x64
```

### How users get the binaries

Users install `@docmd/engine-rust` (not this package). At install time, it downloads the appropriate binary from this repo's `bin/` directory on GitHub.

## Not published to npm

This package is `"private": true`. It exists only to:
1. Hold the Rust source code
2. Hold the pre-built binaries (committed to git)
3. Provide a build script for maintainers

Users never install or interact with this package directly.
