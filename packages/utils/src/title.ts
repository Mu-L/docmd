/**
 * --------------------------------------------------------------------
 * docmd : the zero-config documentation engine.
 *
 * @package     @docmd/utils
 * @website     https://docmd.io
 * @repository  https://github.com/docmd-io/docmd
 * @license     MIT
 * @copyright   Copyright (c) 2025-present docmd.io
 *
 * [docmd-source] - Please do not remove this header.
 * --------------------------------------------------------------------
 */

/**
 * Formats a title separator string.
 * Trims surrounding whitespace and, if non-empty, wraps with a single space on each side.
 * E.g. "-" -> " - ", "|" -> " | ", " · " -> " · ", "" -> ""
 */
export function formatTitleSeparator(rawSeparator?: string): string {
  if (typeof rawSeparator !== 'string') {
    return ' - ';
  }
  const trimmed = rawSeparator.trim();
  if (!trimmed) {
    return '';
  }
  return ` ${trimmed} `;
}

/**
 * Resolves the titleAppend boolean setting with hierarchy:
 * 1. frontmatter.titleAppend
 * 2. frontmatter.seo?.titleAppend
 * 3. config.layout?.titleAppend
 * 4. config.plugins?.seo?.titleAppend
 * 5. config.seo?.titleAppend
 * 6. config.titleAppend (root fallback)
 * Default: true
 */
export function resolveTitleAppend(config: any = {}, frontmatter: any = {}): boolean {
  if (frontmatter?.titleAppend !== undefined) {
    return frontmatter.titleAppend !== false;
  }
  if (frontmatter?.seo?.titleAppend !== undefined) {
    return frontmatter.seo.titleAppend !== false;
  }
  if (config?.layout?.titleAppend !== undefined) {
    return config.layout.titleAppend !== false;
  }
  if (config?.plugins?.seo?.titleAppend !== undefined) {
    return config.plugins.seo.titleAppend !== false;
  }
  if (config?.seo?.titleAppend !== undefined) {
    return config.seo.titleAppend !== false;
  }
  if (config?.titleAppend !== undefined) {
    return config.titleAppend !== false;
  }
  return true;
}

/**
 * Resolves the titleSeparator string setting with hierarchy:
 * 1. frontmatter.titleSeparator
 * 2. frontmatter.seo?.titleSeparator
 * 3. config.layout?.titleSeparator
 * 4. config.plugins?.seo?.titleSeparator
 * 5. config.seo?.titleSeparator
 * 6. config.titleSeparator (root fallback)
 * Default: "-" (formatted to " - ")
 */
export function resolveTitleSeparator(config: any = {}, frontmatter: any = {}): string {
  let rawSeparator: string | undefined;

  if (typeof frontmatter?.titleSeparator === 'string') {
    rawSeparator = frontmatter.titleSeparator;
  } else if (typeof frontmatter?.seo?.titleSeparator === 'string') {
    rawSeparator = frontmatter.seo.titleSeparator;
  } else if (typeof config?.layout?.titleSeparator === 'string') {
    rawSeparator = config.layout.titleSeparator;
  } else if (typeof config?.plugins?.seo?.titleSeparator === 'string') {
    rawSeparator = config.plugins.seo.titleSeparator;
  } else if (typeof config?.seo?.titleSeparator === 'string') {
    rawSeparator = config.seo.titleSeparator;
  } else if (typeof config?.titleSeparator === 'string') {
    rawSeparator = config.titleSeparator;
  } else {
    rawSeparator = '-';
  }

  return formatTitleSeparator(rawSeparator);
}

/**
 * Resolves the canonical full document title for <title> and social meta tags.
 */
export function resolveTitle(
  pageTitle: string | undefined,
  siteTitle: string | undefined,
  config: any = {},
  frontmatter: any = {}
): string {
  const pTitle = (pageTitle || '').trim();
  const sTitle = (siteTitle || '').trim();

  if (!pTitle) {
    return sTitle;
  }

  const append = resolveTitleAppend(config, frontmatter);
  if (!append || !sTitle || pTitle === sTitle) {
    return pTitle;
  }

  const separator = resolveTitleSeparator(config, frontmatter);
  return `${pTitle}${separator}${sTitle}`;
}