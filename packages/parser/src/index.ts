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

import { createMarkdownProcessor, processContent } from './markdown-processor.js';
import { renderTemplateAsync } from './html-renderer.js';
import { renderIcon } from './utils/icon-renderer.js';
import { validateConfig } from './utils/validator.js';

export {
  // Logic
  createMarkdownProcessor,
  processContent,
  renderTemplateAsync,
  validateConfig,

  // Utils
  renderIcon
};

export { createDepthTrackingContainer } from './features/index.js';