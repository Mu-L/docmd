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

const lucideStatic = require('lucide-static');

// Convert kebab-case to PascalCase (e.g., arrow-right -> ArrowRight)
function kebabToPascal(str) {
  return str.split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
}

const exceptions = {
  'arrow-up-right-square': 'ExternalLink',
  'file-cog': 'Settings',
  'cloud-upload': 'UploadCloud'
};

function renderIcon(name, options = {}) {
  if (!name) return '';
  
  const key = exceptions[name] || kebabToPascal(name);
  const svgData = lucideStatic[key];

  if (!svgData) return ''; // Fail silently or warn via callback

  // Inject attributes into the raw SVG string
  const attrs = [
    `class="lucide-icon icon-${name} ${options.class || ''}"`,
    `width="${options.width || '1em'}"`,
    `height="${options.height || '1em'}"`,
    `stroke="${options.stroke || 'currentColor'}"`,
    `stroke-width="${options.strokeWidth || 2}"`,
    'fill="none"',
    'stroke-linecap="round"',
    'stroke-linejoin="round"'
  ].join(' ');

  return svgData.replace('<svg', `<svg ${attrs}`);
}

module.exports = { renderIcon };