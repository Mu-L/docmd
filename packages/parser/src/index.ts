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

import { createMarkdownProcessor, processContent, processContentAsync } from './markdown-processor.js';
import { renderTemplateAsync } from './html-renderer.js';
import { renderIcon } from './utils/icon-renderer.js';
import { validateConfig } from './utils/validator.js';

export {
  // Logic
  createMarkdownProcessor,
  processContent,
  processContentAsync,
  renderTemplateAsync,
  validateConfig,

  // Utils
  renderIcon
};

export { createDepthTrackingContainer } from './features/index.js';
export { findPageNeighbors, findBreadcrumbs } from './utils/navigation-helper.js';
export { normalizeInternalHref, normalizeNavPaths, normalizeMenubarPaths, resolveHref } from './utils/normalize-href.js';