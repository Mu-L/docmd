/**
 * --------------------------------------------------------------------
 * docmd : the minimalist, zero-config documentation generator.
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

import { createRequire } from 'module';

const require = createRequire(import.meta.url);

export async function buildLive(options: any = {}) {
  // Delegate to the standalone package
  // @ts-ignore
  const livePkg = await import('@docmd/live');

  // If explicitly asked NOT to serve (for testing), just build
  if (options.serve === false) {
    console.log('🔨 Building Live Editor ...');
    await livePkg.build(process.cwd());
  } else {
    // Default behavior: Build + Serve
    await livePkg.start();
  }
}