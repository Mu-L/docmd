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
 *
 * Barrel module for the OKF graph viewer.
 *
 * Re-exports the three concerns of the viewer (CSS, runtime JS, HTML
 * shell) so consumers can `import { GRAPH_CSS, GRAPH_JS, graphHtml }`
 * from a single path. The implementation lives in:
 *
 *   - `graph-styles.ts` — the flat, hairline-bordered stylesheet
 *   - `graph-runtime.ts` — the IIFE runtime that drives the SVG
 *   - `graph-template.ts` — the HTML shell + type-colour palette
 *
 * `GRAPH_JS` is a function (not a constant) so the runtime can read
 * the TypeScript-owned `TYPE_COLORS` map at build time and inline it
 * into the generated `graph.js` file.
 */

import { graphRuntime } from './graph-runtime.js';

export { GRAPH_CSS } from './graph-styles.js';
export { TYPE_COLORS, graphHtml } from './graph-template.js';

/**
 * Convenience: the runtime as a pre-rendered string, ready to write
 * to disk. Splits cleanly from `GRAPH_CSS` and `graphHtml` so each
 * downstream artifact stays self-contained.
 */
export function GRAPH_JS(): string {
  return graphRuntime();
}