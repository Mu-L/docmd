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

import tpl from 'lite-template';
import { renderIcon } from './utils/icon-renderer.js';

/**
 * Renders an EJS template string with provided data.
 *
 * This module is purely a template renderer — it contains NO URL logic.
 * Every URL transformation goes through the single source of truth in
 * `utils/url-utils.ts` (buildContextualUrl, buildRootRelativeUrl,
 * rewriteHtmlLinks). The generator binds those functions to the current
 * page's UrlContext and passes them in as `buildRelativeUrl` /
 * `buildAbsoluteUrl` template helpers.
 *
 * Uses lite-template natively, with a preprocessor hook to automatically
 * strip YAML frontmatter out of any recursive file includes.
 */
async function renderTemplateAsync(templateString, data, options: any = {}) {
  // Inject only the icon helper. URL helpers (buildRelativeUrl,
  // buildAbsoluteUrl) are provided by the generator via `data` — this
  // module never computes URLs itself.
  const fullData: any = {
    ...data,
    renderIcon,
  };

  try {
    const finalOptions = {
      ...options,
      async: true,
      preprocessor: (content) => {
        // Strip frontmatter from included files - frontmatter is a docmd concern,
        // not an EJS/template concern. The top-level page's frontmatter is handled
        // by processContent/lite-matter, but recursive includes should not re-render it.
        const fmRegex = /^(?:---[\r\n]+)([\s\S]*?)(?:[\r\n]+---(?:[\r\n]+|$))/;
        const fmMatch = content.match(fmRegex);
        if (fmMatch) {
          return content.slice(fmMatch[0].length);
        }
        return content;
      }
    };

    return await tpl.render(templateString, fullData, finalOptions);
  } catch (e) {
    throw new Error(`Template Render Error: ${e.message}`);
  }
}

export { renderTemplateAsync };