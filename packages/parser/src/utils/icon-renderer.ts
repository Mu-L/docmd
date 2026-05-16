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

import * as lucideStatic from 'lucide-static';

// Convert kebab-case to PascalCase (e.g., arrow-right -> ArrowRight)
function kebabToPascal(str: string): string {
  return str.split('-').map((p: string) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
}

const exceptions: any = {
  'arrow-up-right-square': 'ExternalLink',
  'file-cog': 'Settings',
  'cloud-upload': 'UploadCloud'
};

function escapeHtml(str: any): string {
  const s = typeof str === 'string' ? str : String(str || '');
  return s.replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[m] as string);
}

function renderIcon(name: string, options: any = {}) {
  if (!name) return '';

  const key = exceptions[name] || kebabToPascal(name);
  const svgData = (lucideStatic as any)[key];

  if (!svgData) return ''; // Fail silently or warn via callback

  const escape = escapeHtml;

  // Inject attributes into the raw SVG string
  const attrs = [
    `class="lucide-icon icon-${escape(name)} ${escape(options.class || '')}"`,
    `width="${escape(options.width || '1em')}"`,
    `height="${escape(options.height || '1em')}"`,
    `stroke="${escape(options.stroke || 'currentColor')}"`,
    `stroke-width="${escape(options.strokeWidth || 2)}"`,
    'fill="none"',
    'stroke-linecap="round"',
    'stroke-linejoin="round"'
  ].join(' ');

  return svgData.replace('<svg', `<svg ${attrs}`);
}

export { renderIcon };