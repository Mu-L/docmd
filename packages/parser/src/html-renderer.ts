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
 * Injects docmd-specific context helpers (renderIcon, fixLink).
 * Utilizes lite-template natively, while passing a preprocessor hook 
 * to automatically strip YAML frontmatter out of any recursive file includes.
 */
async function renderTemplateAsync(templateString, data, options: any = {}) {
  // Inject core helpers into every template
  const fullData: any = {
    ...data,
    renderIcon,
    // Helper to fix links relative to root
    fixLink: (url) => fixHtmlLinks(url, data.relativePathToRoot, data.isOfflineMode, data.config?.base)
  };

  try {
    const finalOptions = {
      ...options,
      async: true,
      preprocessor: (content) => {
        // Strip frontmatter from included files — frontmatter is a docmd concern,
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

function fixHtmlLinks(url, root = './', isOffline = false, base = '/') {
  if (!url || url.startsWith('http') || url.startsWith('#') || url.startsWith('mailto:')) return url;

  let final = url;

  // Strip base if present
  if (base !== '/' && url.startsWith(base)) {
    final = '/' + url.substring(base.length);
  }

  // Make relative
  if (final.startsWith('/')) {
    final = root + final.substring(1);
  }

  // Offline adjustments
  if (isOffline) {
    if (!final.includes('.') && !final.endsWith('/')) final += '/index.html';
    else if (final.endsWith('/')) final += 'index.html';
  } else {
    // Clean URLs
    if (final.endsWith('/index.html')) final = final.substring(0, final.length - 10);
  }

  return final;
}

export { renderTemplateAsync, fixHtmlLinks };