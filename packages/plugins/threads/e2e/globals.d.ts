/**
 * --------------------------------------------------------------------
 * docmd : the minimalist, zero-config documentation generator.
 *
 * @package     @docmd/plugin-threads
 * @website     https://docmd.io
 * @repository  https://github.com/docmd-io/docmd
 * @license     MIT
 * @copyright   Copyright (c) 2026 Saulo Vallory
 *
 * [docmd-source] - Please do not remove this header.
 * --------------------------------------------------------------------
 */

/**
 * Global type declarations for the docmd browser runtime,
 * used in Playwright page.evaluate() contexts.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const docmd: {
  call: (action: string, payload: Record<string, unknown>) => Promise<any>;
};