/**
 * --------------------------------------------------------------------
 * docmd : the minimalist, zero-config documentation generator.
 *
 * @package     @docmd/core (and ecosystem)
 * @website     https://docmd.io
 * @repository  https://github.com/docmd-io/docmd
 * @license     MIT
 * @copyright   Copyright (c) 2025 docmd.io
 *
 * [docmd-source] - Please do not remove this header.
 * --------------------------------------------------------------------
 */

const path = require('path');
const { spawn } = require('child_process');
const { build } = require('./src/build');

async function start() {
  await build();

  const distDir = path.resolve(process.cwd(), 'dist');
  console.log(`\n🌍 Launching Live Editor at ${distDir}...`);
  console.log('   (Press Ctrl+C to stop)');

  // Resolve the 'serve' executable path safely
  let serveBinPath;
  try {
    const servePkgJsonPath = require.resolve('serve/package.json');
    const serveDir = path.dirname(servePkgJsonPath);
    const servePkg = require(servePkgJsonPath);

    // 'bin' can be a string or an object in package.json
    const binPath = typeof servePkg.bin === 'string' ? servePkg.bin : servePkg.bin.serve;
    serveBinPath = path.join(serveDir, binPath);

  } catch (e) {
    console.error('❌ Could not locate "serve" package. Ensure it is installed.');
    process.exit(1);
  }

  // Spawn Node directly
  const p = spawn(process.execPath, [serveBinPath, distDir], { 
      stdio: 'inherit'
  });
  
  process.on('SIGINT', () => {
      p.kill();
      process.exit();
  });
}

module.exports = { start, build };