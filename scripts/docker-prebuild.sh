#!/bin/sh
# Stub out build scripts that cannot run inside Docker before pnpm -r run build.
# This file is only executed during Docker image builds.

# engine-rust-binaries: requires the Rust toolchain (cargo) which is not
# installed in the builder image. The pre-built .node binaries are committed
# to the repo and copied into the production image directly.
RUST_BIN_PKG="packages/engines/rust-binaries/package.json"
if [ -f "$RUST_BIN_PKG" ]; then
  node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('$RUST_BIN_PKG', 'utf8'));
    pkg.scripts = pkg.scripts || {};
    pkg.scripts.build = 'echo [docker] skipped rust-binaries build';
    fs.writeFileSync('$RUST_BIN_PKG', JSON.stringify(pkg, null, 2));
  "
  echo "[docker-prebuild] Stubbed rust-binaries build script"
fi

# _playground: runs a full docmd site build — a dev sandbox, not part of the
# production image. Skip it to avoid unnecessary work and potential failures.
PLAYGROUND_PKG="packages/_playground/package.json"
if [ -f "$PLAYGROUND_PKG" ]; then
  node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('$PLAYGROUND_PKG', 'utf8'));
    pkg.scripts = pkg.scripts || {};
    pkg.scripts.build = 'echo [docker] skipped playground build';
    fs.writeFileSync('$PLAYGROUND_PKG', JSON.stringify(pkg, null, 2));
  "
  echo "[docker-prebuild] Stubbed _playground build script"
fi