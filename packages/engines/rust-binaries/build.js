/**
 * --------------------------------------------------------------------
 * docmd : the zero-config documentation engine.
 *
 * @package     @docmd/core (and ecosystem)
 * @website     https://docmd.io
 * @repository  https://github.com/docmd-io/docmd
 * @license     MIT
 * @copyright   Copyright (c) 2025-present docmd.io
 *
 * [docmd-source] - Please do not remove this header.
 * --------------------------------------------------------------------
 */

'use strict';

const { execSync, execFileSync, spawnSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

const PLATFORM_MAP = {
  'darwin-arm64': 'docmd-engine-darwin-arm64.node',
  'darwin-x64':   'docmd-engine-darwin-x64.node',
  'linux-x64':    'docmd-engine-linux-x64.node',
  'linux-arm64':  'docmd-engine-linux-arm64.node',
  'win32-x64':    'docmd-engine-win32-x64.node',
};

const platformId = `${process.platform}-${process.arch}`;
const outputName = PLATFORM_MAP[platformId];

if (!outputName) {
  console.error(`Unsupported platform: ${platformId}`);
  console.error(`Supported: ${Object.keys(PLATFORM_MAP).join(', ')}`);
  process.exit(1);
}

const pkgDir     = __dirname;
const nativeDir  = path.join(pkgDir, 'native');
const binDir     = path.join(pkgDir, 'bin');
const releaseDir = path.join(nativeDir, 'target', 'release');
const outputPath = path.join(binDir, outputName);

// ---------------------------------------------------------------------------
// Ensure Rust is installed — install via rustup if missing
// This package is for maintainers only, so we auto-install Rust.
// ---------------------------------------------------------------------------

function cargoAvailable() {
  try {
    execFileSync('cargo', ['--version'], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

if (!cargoAvailable()) {
  console.log('[@docmd/engine-rust-binaries] Rust not found. Installing via rustup…');
  
  try {
    if (process.platform === 'win32') {
      // Windows: download and run rustup-init.exe
      const rustupUrl = 'https://win.rustup.rs/x86_64';
      const rustupExe = path.join(require('os').tmpdir(), 'rustup-init.exe');
      console.log('Downloading rustup-init.exe…');
      execSync(
        `powershell -Command "Invoke-WebRequest -Uri '${rustupUrl}' -OutFile '${rustupExe}'"`,
        { stdio: 'inherit' }
      );
      execSync(`"${rustupExe}" -y --default-toolchain stable`, { stdio: 'inherit' });
    } else {
      // macOS / Linux: curl | sh
      execSync(
        "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable",
        { stdio: 'inherit', shell: '/bin/sh' }
      );
    }

    // Add cargo to PATH for this process
    const cargoHome = process.env.CARGO_HOME || path.join(require('os').homedir(), '.cargo');
    process.env.PATH = `${path.join(cargoHome, 'bin')}${path.delimiter}${process.env.PATH}`;
    
    if (!cargoAvailable()) {
      throw new Error('cargo still not found after installation');
    }
    
    console.log('[@docmd/engine-rust-binaries] Rust installed successfully.');
  } catch (err) {
    console.error(`[@docmd/engine-rust-binaries] Failed to install Rust: ${err.message}`);
    console.error('Install manually from https://rustup.rs and re-run the build.');
    process.exit(1);
  }
}

// Sync version from package.json to Cargo.toml
const version = require('./package.json').version;
const cargoPath = path.join(nativeDir, 'Cargo.toml');
if (fs.existsSync(cargoPath)) {
  let cargo = fs.readFileSync(cargoPath, 'utf8');
  cargo = cargo.replace(/^version\s*=\s*"[^"]+"/m, `version     = "${version}"`);
  fs.writeFileSync(cargoPath, cargo, 'utf8');
}

// Build
console.log(`Building native addon for ${platformId}…`);

const result = spawnSync('cargo', ['build', '--release'], {
  cwd: nativeDir,
  stdio: 'inherit',
});

if (result.status !== 0) {
  console.error('cargo build failed.');
  process.exit(1);
}

// Find and copy the built library
const candidates = [
  path.join(releaseDir, 'libdocmd_engine.dylib'),  // macOS
  path.join(releaseDir, 'libdocmd_engine.so'),     // Linux
  path.join(releaseDir, 'docmd_engine.dll'),       // Windows
];

const builtFile = candidates.find(f => fs.existsSync(f));

if (!builtFile) {
  console.error(`Could not find compiled library in ${releaseDir}`);
  process.exit(1);
}

fs.mkdirSync(binDir, { recursive: true });
fs.copyFileSync(builtFile, outputPath);

const size = (fs.statSync(outputPath).size / 1024).toFixed(0);
console.log(`✓ Built: bin/${outputName} (${size}KB)`);
console.log(`\nCommit this file to the repo. Users will download it at install time.`);
