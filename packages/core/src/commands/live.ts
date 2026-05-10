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

import { createRequire } from 'module';

const _require = createRequire(import.meta.url);

import { fsUtils as fs } from '@docmd/utils';
import path from 'path';
import { TUI } from '@docmd/api';

export async function buildLive(options: any = {}) {
  // Delegate to the standalone package
  const livePkg = await import('@docmd/live');

  // If explicitly asked NOT to serve (for testing), just build
  if (options.serve === false) {
    TUI.section('Building Live Editor');
    TUI.step('Compiling standalone runtime', 'WAIT');
    await livePkg.build(process.cwd());
    TUI.footer();
  } else {
    // Default behavior: Build + Serve
    await livePkg.start();
  }
}