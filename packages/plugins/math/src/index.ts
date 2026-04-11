/**
 * --------------------------------------------------------------------
 * docmd : the minimalist, zero-config documentation generator.
 *
 * @package     @docmd/plugin-math
 * @website     https://docmd.io
 * @repository  https://github.com/docmd-io/docmd
 * @license     MIT
 * @copyright   Copyright (c) 2025-present docmd.io
 *
 * [docmd-source] - Please do not remove this header.
 * --------------------------------------------------------------------
 */

import texmath from 'markdown-it-texmath';
import katex from 'katex';

export function markdownSetup(md: any) {
  md.use(texmath, { engine: katex, delimiters: 'dollars', katexOptions: { macros: { "\\RR": "\\mathbb{R}" } } });
}

export function getAssets() {
  return [
    {
      url: 'https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/katex.min.css',
      type: 'css',
      location: 'head'
    }
  ];
}