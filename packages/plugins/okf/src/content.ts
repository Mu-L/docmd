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
 * Concept-type resolution + content scanning helpers used during the
 * OKF bundle build.
 *
 * `resolveType` decides what OKF type a page belongs to:
 *   1. Explicit `okf.type` in frontmatter (nested OKF block)
 *   2. Top-level `type` (or a custom field set via `typeField` config)
 *   3. `okfType` (legacy alias kept for back-compat)
 *   4. Path-based inference (e.g. `/api/...` → 'api')
 *   5. The configured `defaultType` (with `fallback: true` so the
 *      caller can warn that the page is untyped)
 *
 * `slugify` / `matchesPattern` / `extractInternalLinks` are the
 * building blocks the bundle writer uses for cross-linking.
 */

const PATH_TYPE_MAP: Array<[RegExp, string]> = [
  [/^\/guides\//, 'guide'],
  [/^\/api\//, 'api'],
  [/^\/reference\//, 'reference'],
  [/^\/concepts\//, 'concept'],
  [/^\/runbooks\//, 'runbook'],
  [/^\/datasets\//, 'dataset'],
  [/^\/metrics\//, 'metric'],
  [/^\/tables\//, 'table']
];

export function slugify(input: string): string {
  return String(input || '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'bundle';
}

export function resolveType(
  fm: any,
  pathname: string,
  defaultType: string,
  typeField = 'type'
): { type: string; fallback: boolean } {
  const fmType = (fm?.okf?.type)
    || (typeField && typeField !== 'type' ? fm?.[typeField] : null)
    || (typeField === 'type' ? fm?.type : null)
    || fm?.okfType
    || null;
  if (fmType) return { type: String(fmType), fallback: false };
  for (const [re, t] of PATH_TYPE_MAP) if (re.test(pathname)) return { type: t, fallback: false };
  return { type: defaultType, fallback: true };
}

/**
 * Glob-style pattern match used by the exclude filter. Supports `*`
 * (any chars) and `?` (single char). Falls back to plain `includes`
 * when the pattern doesn't compile (so user-supplied patterns never
 * crash the build).
 */
export function matchesPattern(text: string, patterns: string[]): boolean {
  if (!patterns || !patterns.length) return false;
  for (const p of patterns) {
    if (!p) continue;
    try {
      const re = new RegExp('^' + p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
      if (re.test(text)) return true;
    } catch { if (text.includes(p)) return true; }
  }
  return false;
}

/**
 * Scans a markdown body for internal `[label](slug)` links and
 * returns the slugs of any that resolve to a known concept in the
 * bundle. External URLs, anchor-only links, and self-references
 * are skipped.
 */
export function extractInternalLinks(md: string, ownSlug: string, known: Set<string>): string[] {
  const out: string[] = [];
  if (!md) return out;
  const re = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) {
    let href = m[1].trim();
    if (!href || href.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(href)) continue;
    href = href.split('#')[0];
    if (!href) continue;
    const slug = slugify(href.replace(/\.md$/i, ''));
    if (!slug || slug === ownSlug) continue;
    if (known.has(slug)) out.push(slug);
  }
  return out;
}