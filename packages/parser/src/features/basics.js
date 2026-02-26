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

module.exports = {
  name: 'basics',
  setup(md) {
    // 1. Custom Image Renderer
    const defaultImageRenderer = md.renderer.rules.image || function(tokens, idx, options, env, self) {
      return self.renderToken(tokens, idx, options);
    };

    md.renderer.rules.image = function(tokens, idx, options, env, self) {
      const renderedImage = defaultImageRenderer(tokens, idx, options, env, self);
      const nextToken = tokens[idx + 1];
      
      // Look ahead for attributes syntax { .class } immediately after image
      if (nextToken && nextToken.type === 'attrs_block') {
        // markdown-it-attrs usually handles this, but if we need specific logic for 
        // aligning images that don't use standard attributes, we do it here.
      }
      return renderedImage;
    };

    // 2. Table Wrapper (Horizontal Scroll)
    md.renderer.rules.table_open = (tokens, idx, options, env, self) => {
      return '<div class="table-wrapper">' + self.renderToken(tokens, idx, options);
    };
    md.renderer.rules.table_close = (tokens, idx, options, env, self) => {
      return self.renderToken(tokens, idx, options) + '</div>';
    };
  }
};