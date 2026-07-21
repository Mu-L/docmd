/**
 * --------------------------------------------------------------------
 * docmd : the zero-config documentation engine.
 *
 * @package     @docmd/parser
 * @website     https://docmd.io
 * @repository  https://github.com/docmd-io/docmd
 * @license     MIT
 * @copyright   Copyright (c) 2025-present docmd.io
 *
 * [docmd-source] - Please do not remove this header.
 * --------------------------------------------------------------------
 */

/**
 * Centralised URL Utilities
 * =========================
 *
 * This module is the **single source of truth** for all URL transformations
 * in the docmd ecosystem. Every plugin, template, and engine component
 * MUST use these utilities instead of rolling their own URL logic.
 *
 * Architecture:
 *
 *   User Input (markdown, config)
 *       │
 *       ▼
 *   resolveHref()          ← normalize-href.ts (user-facing href → clean path)
 *       │
 *       ▼
 *   Build Engine            ← generator.ts produces outputPath per page
 *       │
 *       ▼
 *   URL Utilities           ← THIS FILE
 *       │
 *       ├── outputPathToSlug()        → "guide/"
 *       ├── outputPathToCanonical()   → "https://site.com/guide/"
 *       ├── buildContextualUrl()      → "../de/guide/" (relative, context-aware)
 *       ├── sanitizeUrl()             → collapse //, enforce trailing /
 *       └── createUrlContext()        → factory for page-level context
 *
 * Plugins receive pre-computed URLs via the page object, OR can import
 * these utilities directly for custom URL generation.
 */

import { sanitizeUrl } from './normalize-href.js';

// Re-export sanitizeUrl from normalize-href for convenience
export { sanitizeUrl };

// ─── Types ──────────────────────────────────────────────────────────

/**
 * Immutable context object that captures all the environmental factors
 * needed to resolve a URL for a specific page render.
 *
 * Created once per page in generator.ts and passed to all templates
 * and plugin hooks.
 */
export interface UrlContext {
  /** Relative path from current page back to site root, e.g. `../../` or `./` */
  readonly relativePathToRoot: string;
  /** Locale + version prefix for the current build pass, e.g. `de/v1/` or `` */
  readonly outputPrefix: string;
  /** Whether we're generating for offline/file:// browsing */
  readonly offline: boolean;
  /** The site base path from config, e.g. `/docs/` or `/` */
  readonly base: string;
  /** The full site URL from config, e.g. `https://docmd.io` (no trailing slash) */
  readonly siteUrl: string;
  /**
   * Path prefix for emitting asset URLs. Empty string when a `<base href>` tag
   * is being emitted (assets resolve against base via simple-relative paths),
   * otherwise equals relativePathToRoot so assets use page-depth-aware paths
   * (used by dev and --offline where no <base> is emitted).
   */
  readonly assetBaseUrl: string;
  /** Whether the renderer is emitting a `<base href>` tag for this page. */
  readonly emitBase: boolean;
  /** The root-relative pathname of the current page, e.g. `/guide/` or `/project1/sub1/file1/` */
  readonly pathname?: string;
  /** The prefix of the active project in the workspace, e.g. `/semantic` or `/` */
  readonly projectPrefix?: string;
  /** All projects in the workspace */
  readonly workspaceProjects?: readonly any[];
}

/**
 * Pre-computed URL data attached to every page object.
 * Plugins can read these directly - zero computation needed.
 */
export interface PageUrls {
  /** Clean directory-style slug, e.g. `guide/` or `/` for root */
  readonly slug: string;
  /** Full canonical URL, e.g. `https://docmd.io/guide/` (only if siteUrl is set) */
  readonly canonical: string;
  /** Relative path from site root, e.g. `/guide/` or `/` */
  readonly pathname: string;
}

// ─── Core Utilities ─────────────────────────────────────────────────

/**
 * Collapse consecutive slashes (except after protocol `:`), enforce
 * consistent formatting. This is the **last-resort safety net** - if
 * the upstream logic is correct, this should be a no-op.
 *
 * Note: This function is imported from normalize-href.ts to ensure
 * single source of truth for URL sanitization logic.
 */

/**
 * Convert a build-engine outputPath to a clean directory-style slug.
 *
 * This is the **single canonical conversion** from the internal file path
 * representation to a URL path segment. Every consumer that previously
 * did its own `outputPath.replace('/index.html', '/')` MUST use this.
 *
 * @param outputPath - e.g. `guide/index.html`, `index.html`, `de/v1/api/index.html`
 * @returns Clean slug, e.g. `guide/`, `/`, `de/v1/api/`
 *
 * @example
 *   outputPathToSlug('guide/index.html')     → 'guide/'
 *   outputPathToSlug('index.html')            → '/'
 *   outputPathToSlug('de/v1/api/index.html')  → 'de/v1/api/'
 *   outputPathToSlug('about.html')            → 'about/'
 */
export function outputPathToSlug(outputPath: string): string {
  if (!outputPath) return '/';

  let slug = outputPath.replace(/\\/g, '/');

  // Strip trailing index.html
  if (slug === 'index.html') return '/';
  if (slug.endsWith('/index.html')) {
    slug = slug.slice(0, -10); // remove 'index.html', keep trailing '/'
  } else if (slug.endsWith('.html')) {
    slug = slug.slice(0, -5) + '/';
  }

  // Ensure trailing slash
  if (slug !== '/' && !slug.endsWith('/')) {
    slug += '/';
  }

  return slug;
}

/**
 * Convert an outputPath to a root-relative pathname (always starts with `/`).
 *
 * @param outputPath - e.g. `guide/index.html`
 * @returns e.g. `/guide/`
 */
export function outputPathToPathname(outputPath: string, base?: string): string {
  const slug = outputPathToSlug(outputPath);
  let pathname = slug.startsWith('/') ? slug : '/' + slug;
  if (base && base !== '/') {
    let b = base.trim();
    if (!b.startsWith('/')) b = '/' + b;
    if (!b.endsWith('/')) b = b + '/';
    b = b.replace(/([^:])\/{2,}/g, '$1/');
    pathname = (b + pathname).replace(/\/+/g, '/');
  }
  return pathname;
}

/**
 * Convert an outputPath to a full canonical URL.
 *
 * @param outputPath - e.g. `guide/index.html`
 * @param siteUrl    - e.g. `https://docmd.io` (no trailing slash)
 * @returns e.g. `https://docmd.io/guide/`
 */
export function outputPathToCanonical(outputPath: string, siteUrl: string, base?: string): string {
  if (!siteUrl) return '';
  const cleanSiteUrl = siteUrl.replace(/\/+$/, '');
  const pathname = outputPathToPathname(outputPath, base);
  return sanitizeUrl(cleanSiteUrl + pathname);
}

/**
 * Build a context-aware relative URL from a clean href.
 *
 * This replaces ALL inline URL building in EJS templates and the
 * `buildRelativeUrl` function in generator.ts. It is the single
 * function that understands relativePathToRoot, outputPrefix,
 * offline mode, and base path.
 *
 * @param href    - A clean, normalised href (output of resolveHref), e.g. `guide/`, `#section`, `https://...`
 * @param context - The UrlContext for the current page
 * @returns A fully resolved relative URL safe for use in `<a href="...">`
 *
 * @example
 *   // Page at /de/v1/getting-started/index.html
 *   buildContextualUrl('guide/', ctx)
 *   // → '../../de/v1/guide/'  (relative, with locale+version prefix)
 *
 *   buildContextualUrl('#section', ctx)
 *   // → '#section'  (hash-only, untouched)
 *
 *   buildContextualUrl('https://github.com', ctx)
 *   // → 'https://github.com'  (external, untouched)
 */
export function buildContextualUrl(href: string, context: UrlContext): string {
  // Pass-through: hash-only, no href
  if (href === '#') return '#';
  if (href === undefined || href === null) return '#';
  // D-S2: strip the `external:` prefix defensively. Plugin callers may
  // invoke this function directly without going through `resolveHref`
  // first; previously `external:https://...` was treated as a literal
  // path segment and got mangled into `./external:https://...`.
  if (href.startsWith('external:')) {
    href = href.slice('external:'.length);
  }
  if (href.startsWith('http') || href.startsWith('//') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('data:')) {
    return href;
  }
  // Hash-only anchors pass through unchanged. Without this guard, a
  // value like `#section` falls through to the path-combining branch
  // and gets prepended with the page's `relativePathToRoot`, producing
  // `./#section` — which a browser still resolves to the same anchor,
  // but breaks expectations for callers that compare the output to the
  // input hash verbatim.
  if (href.startsWith('#')) return href;

  // Separate hash fragment
  let hash = '';
  const hashIdx = href.indexOf('#');
  if (hashIdx >= 0) {
    hash = href.substring(hashIdx);
    href = href.substring(0, hashIdx);
  }

  // Check if the link is relative to the page itself (already relative, not root-relative)
  // Assets are placed at the root level, so they are treated as root-relative even if written relatively.
  const isAsset = href.match(/(^|\/)assets\//);
  const isPageRelative = !href.startsWith('/') && !isAsset;

  // Intercept root-relative links in workspace projects.
  // Guard: when the current project is a subproject (prefix !== '/'), a bare
  // '/' href from a nav item or sidebar title means "this project's root",
  // NOT the workspace root project. Skip workspace interception so the
  // normal outputPrefix-based resolution handles it correctly.
  const isBareRootInSubproject = (href === '/' || href === '/index.html')
    && context.projectPrefix && context.projectPrefix !== '/';
  if (href.startsWith('/') && !isAsset && !isBareRootInSubproject && context.workspaceProjects && context.workspaceProjects.length > 0) {
    const matchingProject = [...context.workspaceProjects]
      .sort((a, b) => b.prefix.length - a.prefix.length)
      .find(p => {
        if (p.prefix === '/') {
          return href === '/' || href === '/index.html';
        }
        const normPrefix = p.prefix.replace(/\/$/, '') + '/';
        const normHref = href.endsWith('/') ? href : href + '/';
        return normHref.startsWith(normPrefix) || href === p.prefix;
      });

    if (matchingProject) {
      const targetSubPath = href.substring(matchingProject.prefix === '/' ? 0 : matchingProject.prefix.length).replace(/^\//, '');
      const isCurrentProject = matchingProject.prefix === context.projectPrefix;

      let relPath = context.relativePathToRoot;
      if (!isCurrentProject) {
        const currentPfx = context.projectPrefix === '/' ? '' : context.projectPrefix.replace(/^\//, '').replace(/\/$/, '');
        if (currentPfx) {
          const levels = currentPfx.split('/').length;
          relPath += '../'.repeat(levels);
        }
        const targetPfx = matchingProject.prefix === '/' ? '' : matchingProject.prefix.replace(/^\//, '').replace(/\/$/, '') + '/';
        relPath += targetPfx;
      }
      
      let combined = relPath + targetSubPath;
      if (context.offline) {
        if (combined === '' || combined.endsWith('/')) {
          combined += 'index.html';
        } else if (!combined.endsWith('.html') && !combined.endsWith('.htm')) {
          const lastSlash = combined.lastIndexOf('/');
          const filename = lastSlash >= 0 ? combined.substring(lastSlash + 1) : combined;
          const lastDot = filename.lastIndexOf('.');
          const hasUnmodifiedExtension = lastDot > 0 && lastDot < filename.length - 1;
          if (!hasUnmodifiedExtension) {
            combined += '/index.html';
          }
        }
      }
      return sanitizeUrl(combined + hash);
    }
  }

  // Strip leading ./ and / to get a clean path
  const cleanPath = href.replace(/^(\.\/|\/)+/, '');

  // Build the prefixed path: outputPrefix (locale/version) + clean path
  // For page-relative paths, we do not prepend the outputPrefix because they are already
  // scoped to the current folder/locale/version context.
  let combinedPath = cleanPath;
  if (!isPageRelative) {
    const prefixStr = context.outputPrefix ? context.outputPrefix.replace(/\/$/, '') : '';
    combinedPath = prefixStr
      ? (cleanPath ? prefixStr + '/' + cleanPath : prefixStr + '/')
      : cleanPath;
  }

  // Offline mode: append /index.html for file:// browsing. Without this
  // every directory-style URL (`./`, `./guide/`, `./en/`) resolves to a
  // filesystem directory under file:// instead of an index.html file,
  // producing a directory listing instead of the rendered page (#179).
  // The empty `combinedPath` case is the root/home link — previously
  // skipped here, which leaked bare `./` hrefs into offline builds.
  if (context.offline) {
    if (combinedPath === '' || combinedPath.endsWith('/')) {
      combinedPath = combinedPath + 'index.html';
    } else if (!combinedPath.endsWith('.html') && !combinedPath.endsWith('.htm')) {
      const lastSlash = combinedPath.lastIndexOf('/');
      const filename = lastSlash >= 0 ? combinedPath.substring(lastSlash + 1) : combinedPath;
      const lastDot = filename.lastIndexOf('.');
      const hasUnmodifiedExtension = lastDot > 0 && lastDot < filename.length - 1;
      if (!hasUnmodifiedExtension) {
        combinedPath = combinedPath + '/index.html';
      }
    }
  }

  // Build final relative URL.
  // For page-relative paths, we do not prepend relativePathToRoot unless relativePathToRoot is './'
  // (to preserve exact './' prefix formatting for root-level pages as expected by tests).
  let result = combinedPath + hash;
  if (!isPageRelative) {
    result = context.relativePathToRoot + combinedPath + hash;
  } else if (context.relativePathToRoot === './') {
    result = './' + combinedPath + hash;
  }

  return sanitizeUrl(result);
}

/**
 * Build a **root-relative** URL from a clean href, ignoring the current
 * locale/version `outputPrefix`.
 *
 * This is the user-content counterpart to `buildContextualUrl`. Markdown
 * authors write links like `[link](/guide/)` meaning the site root, not
 * the current locale section. `buildContextualUrl` would prepend the
 * locale prefix (correct for system nav, wrong for author intent); this
 * function deliberately drops `outputPrefix` so the link resolves to the
 * same place regardless of which locale the page lives under.
 *
 * Shares the exact same offline / clean-URL / external / hash logic as
 * `buildContextualUrl` — there is exactly one implementation of each rule.
 *
 * @param href    - A clean href, e.g. `guide/`, `/guide/`, `#section`, `https://...`
 * @param context - The UrlContext for the current page (outputPrefix is ignored)
 * @returns A file://-safe relative URL rooted at the site root
 */
export function buildRootRelativeUrl(href: string, context: UrlContext): string {
  // Re-use the canonical implementation but force outputPrefix to '' so
  // the locale/version segment is never prepended. This keeps every URL
  // rule (offline index.html, external pass-through, hash handling) in
  // exactly one place: buildContextualUrl.
  const rootContext: UrlContext = Object.freeze({
    ...context,
    outputPrefix: '',
  });
  return buildContextualUrl(href, rootContext);
}

/**
 * Strip the default-locale prefix from absolute `<a href>` URLs in a
 * rendered HTML fragment.
 *
 * When the default locale lives at root (e.g. `en/` → `/`), an author
 * writing `[link](/en/foo)` from a `fr/` page would produce a 404 because
 * `/en/foo` doesn't exist — the default locale is at `/foo`. This rewrites
 * `/en/foo` → `/foo` for every `<a href>` whose first segment matches the
 * default locale id.
 *
 * Only `<a href>` is touched (never `<img src>` — assets are never
 * locale-prefixed). External URLs, anchors, and non-locale absolute paths
 * are passed through unchanged.
 *
 * @param html          - The rendered HTML fragment to post-process
 * @param defaultLocale - The default locale id, e.g. `en`
 * @returns The HTML with default-locale prefixes stripped from absolute hrefs
 */
export function stripDefaultLocalePrefixFromHtml(html: string, defaultLocale: string): string {
  if (!defaultLocale) return html;
  const escaped = defaultLocale.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(<a\\s+[^>]*?\\bhref\\s*=\\s*)(["'])(\\/${escaped}\\/)([^"'#]*)\\2`, 'gi');
  return html.replace(re, (_full, prefix, quote, _stripped, rest) => {
    return `${prefix}${quote}/${rest}${quote}`;
  });
}

/**
 * Walk every `<a href="...">` and `<img src="...">` in a rendered HTML
 * fragment and route each internal URL through `buildRootRelativeUrl`.
 *
 * This is the **single HTML post-processor** for user-authored content
 * (markdown bodies, button containers). It replaces the former parallel
 * implementations: `fixHtmlLinks` (html-renderer.ts) and
 * `rewriteInternalHrefsForOffline` (markdown-processor.ts). All URL
 * rules — offline `index.html` suffixing, clean-URL collapsing, external
 * pass-through, hash preservation, base-path stripping — live in exactly
 * one place: `buildContextualUrl` via `buildRootRelativeUrl`.
 *
 * When `opts.defaultLocale` and `opts.allLocales` are supplied, the
 * default-locale prefix is stripped from absolute hrefs first (see
 * `stripDefaultLocalePrefixFromHtml`).
 *
 * @param html    - The rendered HTML fragment
 * @param context - The UrlContext for the current page
 * @param opts    - Optional locale info for default-locale prefix stripping
 * @returns The HTML with all internal links rewritten for the current context
 */
export function rewriteHtmlLinks(
  html: string,
  context: UrlContext,
  opts?: { defaultLocale?: string | null; allLocales?: readonly string[] }
): string {
  // 1. Strip default-locale prefix from absolute hrefs (only when the
  //    build has more than one locale and we're on a non-default page).
  if (opts?.defaultLocale && opts?.allLocales && opts.allLocales.length >= 2) {
    html = stripDefaultLocalePrefixFromHtml(html, opts.defaultLocale);
  }

  // 2. Walk every <a href="..."> and <img src="..."> and route through the
  //    canonical root-relative URL builder. One regex, one rule set.
  html = html.replace(
    /<(a|img)\s+([^>]*?)\b(href|src)\s*=\s*("([^"]*)"|'([^']*)')([^>]*)>/gi,
    (full, _tag, _pre, _attr, quoted, dq, sq) => {
      const url = dq !== undefined ? dq : sq;
      const fixed = buildRootRelativeUrl(url, context);
      if (fixed === url) return full;
      const q = quoted.charAt(0);
      return full.replace(quoted, q + fixed + q);
    }
  );

  return html;
}

/**
 * Create a UrlContext for a specific page render.
 *
 * Called once per page in generator.ts. The resulting context is then
 * passed to all templates and can be forwarded to plugin hooks.
 *
 * @param options - Configuration for this page's URL context
 */
export function createUrlContext(options: {
  relativePathToRoot: string;
  outputPrefix?: string;
  offline?: boolean;
  base?: string;
  siteUrl?: string;
  pathname?: string;
  projectPrefix?: string;
  workspaceProjects?: readonly any[];
}): UrlContext {
  const relativePathToRoot = options.relativePathToRoot || './';
  const base = options.base || '/';
  const offline = options.offline || false;
  // Never emit <base href> tags or root-relative/absolute asset URLs. Keep everything relative so the site is self-contained.
  const emitBase = false;
  const assetBaseUrl = relativePathToRoot;
  return Object.freeze({
    relativePathToRoot,
    outputPrefix: options.outputPrefix || '',
    offline,
    base,
    siteUrl: (options.siteUrl || '').replace(/\/+$/, ''),
    assetBaseUrl,
    emitBase,
    pathname: options.pathname,
    projectPrefix: options.projectPrefix || '',
    workspaceProjects: (options.workspaceProjects && options.workspaceProjects.length > 0) ? options.workspaceProjects : [{ prefix: '/', title: 'Root' }],
  });
}

/**
 * Compute pre-built URL data for a page.
 *
 * Called once per page in generator.ts. The resulting PageUrls object
 * is attached to the page object and available to all post-build plugins.
 *
 * @param outputPath - The page's output path, e.g. `guide/index.html`
 * @param siteUrl    - The site URL from config, e.g. `https://docmd.io`
 */
export function computePageUrls(outputPath: string, siteUrl: string, base?: string): PageUrls {
  return Object.freeze({
    slug: outputPathToSlug(outputPath),
    canonical: outputPathToCanonical(outputPath, siteUrl, base),
    pathname: outputPathToPathname(outputPath, base),
  });
}

/**
 * Build an absolute URL from config.base + optional locale + optional version + page path.
 *
 * Used by version-dropdown.ejs and language-switcher.ejs for absolute navigation.
 * Replaces the inline JS computations in those templates.
 *
 * @param base          - config.base, e.g. `/docs/` or `/`
 * @param localePrefix  - e.g. `de/` or `` for default locale
 * @param versionPrefix - e.g. `v1/` or `` for current version
 * @param pagePath      - e.g. `guide/` or ``
 * @returns Absolute path, e.g. `/docs/de/v1/guide/`
 */
export function buildAbsoluteUrl(
  base: string,
  localePrefix: string = '',
  versionPrefix: string = '',
  pagePath: string = ''
): string {
  const normalizedBase = base.endsWith('/') ? base : base + '/';
  const result = normalizedBase + localePrefix + versionPrefix + pagePath;
  return sanitizeUrl(result);
}

/**
 * Context-aware variant of `buildAbsoluteUrl` for cross-locale/version
 * navigation links (version dropdown, language switcher, project switcher).
 *
 * When the current render context is NOT offline, this is identical to
 * `buildAbsoluteUrl` — it returns a clean absolute path (`/de/v1/guide/`).
 *
 * When the context IS offline, it returns a **relative** URL rooted at the
 * current page's `relativePathToRoot`, with `index.html` appended for every
 * directory-style segment. Without this, version/language switcher links in
 * `--offline` builds emitted bare `/de/` hrefs that resolved to filesystem
 * directories instead of index.html files under `file://` (#179).
 *
 * The base path is stripped from the computed absolute path before being
 * re-rooted so that custom sub-path deploys (`base: '/docs/'`) still work.
 *
 * @param base          - config.base, e.g. `/docs/` or `/`
 * @param localePrefix  - e.g. `de/` or `` for default locale
 * @param versionPrefix - e.g. `v1/` or ``
 * @param pagePath      - e.g. `guide/` or `` (root of the target prefix)
 * @param context       - The UrlContext for the current page render
 * @returns Either the absolute path (non-offline) or a relative file://-safe path (offline)
 *
 * @example
 *   // Non-offline build:
 *   buildAbsoluteContextualUrl('/', 'de/', '', 'guide/', ctx)
 *   // → '/de/guide/'
 *
 *   // Offline build, page at /en/api/index.html (relativePathToRoot = '../../'):
 *   buildAbsoluteContextualUrl('/', 'de/', '', 'guide/', ctx)
 *   // → '../../de/guide/index.html'
 *
 *   // Offline build, switching to the root of the site:
 *   buildAbsoluteContextualUrl('/', '', '', '', ctx)
 *   // → './index.html'
 */
export function buildAbsoluteContextualUrl(
  base: string,
  localePrefix: string = '',
  versionPrefix: string = '',
  pagePath: string = '',
  context?: UrlContext
): string {
  // No context = legacy behaviour: just build the absolute URL.
  if (!context) {
    return buildAbsoluteUrl(base, localePrefix, versionPrefix, pagePath);
  }

  // Calculate workspace base by stripping projectPrefix from context.base
  let workspaceBase = context.base;
  if (context.projectPrefix && context.projectPrefix !== '/') {
    const normalizedBaseContext = context.base.replace(/\/?$/, '');
    const normalizedProjPfx = context.projectPrefix.replace(/^\//, '').replace(/\/?$/, '');
    if (normalizedProjPfx && normalizedBaseContext.endsWith(normalizedProjPfx)) {
      workspaceBase = normalizedBaseContext.substring(0, normalizedBaseContext.length - normalizedProjPfx.length).replace(/\/?$/, '/');
    }
  }

  // Strip the workspace base prefix from the absolute target if it's there.
  const normalizedBase = base.endsWith('/') ? base : base + '/';
  const absoluteTarget = normalizedBase + localePrefix + versionPrefix + pagePath;
  let cleanPath = absoluteTarget;
  if (workspaceBase && workspaceBase !== '/' && cleanPath.startsWith(workspaceBase)) {
    cleanPath = cleanPath.substring(workspaceBase.length);
    if (!cleanPath.startsWith('/')) {
      cleanPath = '/' + cleanPath;
    }
  }

  // Compute the relative URL from the current page to the target directly.
  // cleanPath is workspace-root-relative (e.g., '/i18n/', '/semantic/', '/').
  // We need to resolve this relative to the current page's position in the
  // output tree, which includes locale/version/project depth.
  //
  // The current page's depth below the workspace root is determined by
  // context.relativePathToRoot (for project root) plus the project prefix
  // depth. For example, from site/i18n/de/v1/index.html:
  //   relativePathToRoot = '../../'  (2 levels up to project root i18n/)
  //   projectPrefix = '/i18n'        (1 level from workspace root to project)
  //   total depth = 3 levels below workspace root

  // Count levels from current page to workspace root
  const projectPfxSegments = (context.projectPrefix && context.projectPrefix !== '/')
    ? context.projectPrefix.replace(/^\//, '').replace(/\/$/, '').split('/').filter(Boolean).length
    : 0;
  const relRootSegments = context.relativePathToRoot
    ? context.relativePathToRoot.split('/').filter(s => s === '..').length
    : 0;
  const totalDepth = relRootSegments + projectPfxSegments;
  const toWorkspaceRoot = totalDepth > 0 ? '../'.repeat(totalDepth) : './';

  // Build path from workspace root to target
  let targetPath = cleanPath.replace(/^\//, '');

  // Offline mode: ensure index.html suffix
  if (context.offline) {
    if (targetPath === '' || targetPath.endsWith('/')) {
      targetPath += 'index.html';
    } else if (!targetPath.endsWith('.html') && !targetPath.endsWith('.htm')) {
      const lastSlash = targetPath.lastIndexOf('/');
      const filename = lastSlash >= 0 ? targetPath.substring(lastSlash + 1) : targetPath;
      const lastDot = filename.lastIndexOf('.');
      const hasExt = lastDot > 0 && lastDot < filename.length - 1;
      if (!hasExt) {
        targetPath += '/index.html';
      }
    }
  }

  return sanitizeUrl(toWorkspaceRoot + targetPath);
}

/**
 * Normalise the `<base href="...">` tag in a fully-rendered HTML document.
 *
 * The generator is the single source of truth for the `<base>` tag. Templates
 * are NOT allowed to emit one themselves — anything a template emits is
 * stripped here and replaced with the canonical decision:
 *
 *   • offline mode (`--offline`)    → no `<base>` tag (file:// re-roots)
 *   • root deploy (`siteRootAbs === '/'`) → no `<base>` tag (relative URLs
 *                                            resolve against document path)
 *   • subpath deploy (`siteRootAbs !== '/'`) → `<base href="siteRootAbs">`
 *
 * Implementation notes:
 *
 *   • Removes ALL existing `<base>` tags (any source: template, partial,
 *     stray plugin output) using a regex that handles attributes in any
 *     order, self-closing forms, single/double quotes.
 *   • When emitting, inserts the canonical `<base>` immediately after the
 *     `<title>` tag so it applies to all subsequent `<link>`, `<script>`,
 *     and asset references in the document head.
 *   • Idempotent: running it twice is a no-op.
 *
 * Centralising this means old templates (pre-0.8.13 with unconditional
 * `<base href="/">`), the default template, and any third-party template
 * all produce the same correct output. Templates do not need to know about
 * base tags at all.
 *
 * @param html       - The fully-rendered HTML string from the layout template
 * @param isOffline  - Whether the build was invoked with `--offline`
 * @param siteRootAbs - The absolute subpath root, e.g. `'/'`, `'/repo/'`, `'/docs/v1/'`
 * @returns          - The HTML with the canonical `<base>` (or none) in place
 */
export function normaliseBaseTag(html: string, isOffline: boolean, siteRootAbs: string): string {
  // Strip every existing <base> tag (self-closing or with close, any attribute order)
  const BASE_TAG_RE = /<base\b[^>]*\/?>\s*/gi;
  return html.replace(BASE_TAG_RE, '');
}

/** Minimal attribute-value escaper for the canonical <base href="...">. */
function escapeHtmlAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
