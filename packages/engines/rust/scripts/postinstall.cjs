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

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const PLATFORM_MAP = {
  'darwin-arm64': 'docmd-engine-darwin-arm64.node',
  'darwin-x64':   'docmd-engine-darwin-x64.node',
  'linux-x64':    'docmd-engine-linux-x64.node',
  'linux-arm64':  'docmd-engine-linux-arm64.node',
  'win32-x64':    'docmd-engine-win32-x64.node',
};

const platformId = `${process.platform}-${process.arch}`;
const binaryName = PLATFORM_MAP[platformId];

if (!binaryName) {
  console.warn(`[@docmd/engine-rust] Unsupported platform: ${platformId}`);
  console.warn(`Supported: ${Object.keys(PLATFORM_MAP).join(', ')}`);
  console.warn(`The JS engine will be used as fallback.`);
  process.exit(0);
}

const pkgDir     = path.join(__dirname, '..');
const binDir     = path.join(pkgDir, 'bin');
const binaryPath = path.join(binDir, binaryName);

// Get version from this package's package.json
const version = require(path.join(pkgDir, 'package.json')).version;

// Skip if already present
if (fs.existsSync(binaryPath)) {
  console.log(`[@docmd/engine-rust] Binary already present: ${binaryName}`);
  process.exit(0);
}

// Download URLs with exact version (npm CDNs)
const URLS = [
  // unpkg (npm CDN) - exact version
  `https://unpkg.com/@docmd/engine-rust-binaries@${version}/bin/${binaryName}`,
  // jsdelivr (npm CDN) - exact version
  `https://cdn.jsdelivr.net/npm/@docmd/engine-rust-binaries@${version}/bin/${binaryName}`,
];

function download(url) {
  return new Promise((resolve, reject) => {
    const follow = (url, redirects = 0) => {
      if (redirects > 5) return reject(new Error('Too many redirects'));
      
      const proto = url.startsWith('https') ? https : require('http');
      proto.get(url, { headers: { 'User-Agent': 'docmd-engine-rust' } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
          return follow(res.headers.location, redirects + 1);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        
        fs.mkdirSync(binDir, { recursive: true });
        const tmp = binaryPath + '.tmp';
        const out = fs.createWriteStream(tmp);
        
        res.pipe(out);
        out.on('finish', () => {
          fs.renameSync(tmp, binaryPath);
          fs.chmodSync(binaryPath, 0o755);
          resolve();
        });
        out.on('error', (err) => {
          fs.rmSync(tmp, { force: true });
          reject(err);
        });
      }).on('error', reject);
    };
    follow(url);
  });
}

async function main() {
  console.log(`[@docmd/engine-rust] Downloading ${binaryName} (v${version})…`);
  
  for (const url of URLS) {
    try {
      await download(url);
      const size = (fs.statSync(binaryPath).size / 1024).toFixed(0);
      console.log(`[@docmd/engine-rust] ✓ Downloaded (${size}KB)`);
      return;
    } catch (err) {
      // Try next URL
    }
  }
  
  console.warn(`[@docmd/engine-rust] Could not download binary for v${version}.`);
  console.warn(`This version may not be published yet.`);
  console.warn(`The JS engine will be used as fallback.`);
  // Exit 0 so pnpm install doesn't fail
}

main();
