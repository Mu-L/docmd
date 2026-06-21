#!/usr/bin/env node

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

const pkgName = (() => { try { return require('../package.json').name; } catch { return 'this package'; } })();
console.error('\x1b[33m%s\x1b[0m', '⚠️  DEPRECATION NOTICE:');
console.error('\x1b[33m%s\x1b[0m', `   You are using the legacy package "${pkgName}".`);
console.error('\x1b[33m%s\x1b[0m', '   Please uninstall it and install "@docmd/core" for future updates.');
console.error('\x1b[33m%s\x1b[0m', '   Redirecting to new engine...\n');

// Pass control to the core binary
require('@docmd/core/bin/docmd.js');