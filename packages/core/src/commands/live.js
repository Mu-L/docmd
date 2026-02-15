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

async function buildLive(options = {}) {
  // Delegate to the standalone package
  const livePkg = require('@docmd/live');
  
  // If explicitly asked NOT to serve (for testing), just build
  if (options.serve === false) {
      console.log('🔨 Building Live Editor ...');
      await livePkg.build();
  } else {
      // Default behavior: Build + Serve
      await livePkg.start();
  }
}

module.exports = { buildLive };