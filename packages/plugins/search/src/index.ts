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

import path from 'path';
import fs from 'fs/promises';
import nativeFs from 'fs';
import MiniSearch from 'minisearch';
import { fileURLToPath } from 'url';
import type { PluginDescriptor } from '@docmd/api';
import { outputPathToSlug, sanitizeUrl } from '@docmd/api';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const plugin: PluginDescriptor = {
  name: 'search',
  version: '0.8.1',
  capabilities: ['post-build', 'head', 'body', 'assets', 'translations']
};

// Resolve i18n directory (sibling to dist/ in the package)
const i18nDir = path.resolve(__dirname, '..', 'i18n');

/**
 * Load translation strings for a given locale.
 * Falls back to English if the locale file doesn't exist.
 */
function loadPluginStrings(localeId: string): Record<string, string> {
  try {
    // Try locale-specific file
    const localePath = path.join(i18nDir, `${localeId}.json`);
    if (nativeFs.existsSync(localePath)) {
      return JSON.parse(nativeFs.readFileSync(localePath, 'utf8'));
    }
  } catch { /* fallback below */ }
  // Fallback to English
  try {
    const enPath = path.join(i18nDir, 'en.json');
    if (nativeFs.existsSync(enPath)) {
      return JSON.parse(nativeFs.readFileSync(enPath, 'utf8'));
    }
  } catch { /* silent */ }
  return {};
}

/**
 * Plugin translations hook - called by the engine for each locale.
 * Returns search-specific UI strings keyed by locale.
 */
export function translations(localeId: string): Record<string, string> {
  return loadPluginStrings(localeId || 'en');
}

/**
 * Post-build hook - generates per-locale search indexes.
 * Each locale gets its own `search-index.json` covering all versions within that locale.
 * Default locale index is at root, non-default locale indexes are at `/{locale}/search-index.json`.
 *
 * When a WorkerPool is available, the CPU-intensive MiniSearch indexing is
 * offloaded to a worker thread via `runWorkerTask` to keep the main thread free.
 */
export async function onPostBuild({ config, pages, outputDir, tui, options, runWorkerTask }: any) {
  const isEnabled = config.optionsMenu ? config.optionsMenu.components.search !== false : config.search !== false;
  if (!isEnabled) return;

  const showTui = tui && !options?.quiet;
  if (showTui) tui.step('Generating search index', 'WAIT');

  // Try to offload to worker thread for better main-thread responsiveness
  if (runWorkerTask) {
    try {
      // Only send serializable page data the worker needs
      const serializablePages = pages
        .filter((p: any) => p.searchData)
        .map((p: any) => ({ outputPath: p.outputPath, searchData: p.searchData }));

      // Build a minimal serializable config for the worker
      const workerConfig = {
        i18n: config.i18n ? { locales: config.i18n.locales, default: config.i18n.default } : undefined,
        versions: config.versions ? { all: config.versions.all, current: config.versions.current } : undefined,
      };

      const workerModulePath = path.resolve(__dirname, 'worker.js');
      await runWorkerTask(workerModulePath, 'buildSearchIndex', [workerConfig, serializablePages, outputDir]);

      if (showTui) tui.step('Generating search index', 'DONE');
      return;
    } catch {
      // Worker failed — fall through to main-thread processing
    }
  }

  // Main-thread fallback (or when WorkerPool isn't available)
  await buildSearchIndexInline(config, pages, outputDir);

  if (showTui) tui.step('Generating search index', 'DONE');
}

/**
 * Inline (main-thread) search index builder — used as fallback when
 * worker offloading is not available or fails.
 */
async function buildSearchIndexInline(config: any, pages: any[], outputDir: string) {
  const locales = config.i18n?.locales || [];
  const defaultLocale = config.i18n?.default || null;
  const hasVersioning = config.versions?.all?.length > 0;
  const currentVersionId = config.versions?.current;

  // Group pages by locale
  const localePages: Record<string, any[]> = { '_default': [] };
  for (const loc of locales) {
    if (loc.id !== defaultLocale) {
      localePages[loc.id] = [];
    }
  }

  for (const page of pages) {
    if (!page.searchData) continue;
    const outputPath = page.outputPath.replace(/\\/g, '/');

    let localeId = '_default';
    for (const loc of locales) {
      if (loc.id !== defaultLocale && outputPath.startsWith(loc.id + '/')) {
        localeId = loc.id;
        break;
      }
    }
    localePages[localeId] = localePages[localeId] || [];
    localePages[localeId].push(page);
  }

  for (const [localeId, locPages] of Object.entries(localePages)) {
    if (locPages.length === 0) continue;

    const searchData: any[] = [];
    const seenIds = new Set();

    for (const page of locPages) {
      let pageId = outputPathToSlug(page.outputPath);
      if (pageId.startsWith('/') && pageId !== '/') {
        pageId = pageId.slice(1);
      }

      let version: string | null = null;
      if (hasVersioning && config.versions?.all) {
        for (const v of config.versions.all) {
          const stripped = localeId !== '_default' ? pageId.replace(new RegExp(`^${localeId}/`), '') : pageId;
          if (stripped.startsWith(v.id + '/') || stripped === v.id) {
            version = v.label || v.id;
            break;
          }
        }
        if (!version) {
          const currentVersion = config.versions.all.find((v: any) => v.id === currentVersionId);
          if (currentVersion) version = currentVersion.label || currentVersion.id;
        }
      }

      if (!seenIds.has(pageId)) {
        seenIds.add(pageId);
        const entry: any = {
          id: pageId,
          title: page.searchData.title,
          text: page.searchData.content,
          headings: (page.searchData.headings || []).map((h: any) => h.text).join(' ')
        };
        if (hasVersioning && version) entry.version = version;
        searchData.push(entry);
      }

      if (page.searchData.headings && Array.isArray(page.searchData.headings)) {
        for (const heading of page.searchData.headings) {
          if (heading.id && heading.text) {
            const hId = `${pageId}#${heading.id}`;
            if (!seenIds.has(hId)) {
              seenIds.add(hId);
              const entry: any = {
                id: hId,
                title: `${page.searchData.title} > ${heading.text}`,
                text: '',
                headings: heading.text
              };
              if (hasVersioning && version) entry.version = version;
              searchData.push(entry);
            }
          }
        }
      }
    }

    const storeFields = ['title', 'id', 'text'];
    if (hasVersioning) storeFields.push('version');

    const miniSearch = new MiniSearch({
      fields: ['title', 'headings', 'text'],
      storeFields,
      searchOptions: { boost: { title: 2, headings: 1.5 }, fuzzy: 0.2 }
    });

    miniSearch.addAll(searchData);
    const json = JSON.stringify(miniSearch.toJSON());

    const indexPath = localeId === '_default'
      ? path.join(outputDir, 'search-index.json')
      : path.join(outputDir, localeId, 'search-index.json');

    await fs.mkdir(path.dirname(indexPath), { recursive: true });
    await fs.writeFile(indexPath, json);
  }
}

/**
 * Inject the search modal HTML.
 * Strings are passed as data attributes so the client JS can read them
 * regardless of locale - the engine merges plugin translations before render.
 */
export function generateScripts(config: any) {
  const isEnabled = config.optionsMenu ? config.optionsMenu.components.search !== false : config.search !== false;
  if (!isEnabled) return {};

  // Load strings for the active locale (available at render time)
  const localeId = config._activeLocale?.id || 'en';
  const strings = loadPluginStrings(localeId);

  const searchIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide-icon icon-search"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg>`;
  const closeIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide-icon icon-x"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>`;

  const modalHtml = `
  <!-- Search Modal (Injected by @docmd/plugin-search) -->
  <div id="docmd-search-modal" class="docmd-search-modal" style="display: none;"
       data-search-placeholder="${strings.searchPlaceholder || 'Search documentation...'}"
       data-search-no-results="${strings.searchNoResults || 'No results found.'}"
       data-search-error="${strings.searchError || 'Failed to load search index.'}"
       data-search-initial="${strings.searchInitial || 'Type to start searching...'}"
       data-search-navigate="${strings.searchNavigate || 'to navigate'}"
       data-search-escape="${strings.searchEscape || 'to close'}">
      <div class="docmd-search-box">
          <div class="docmd-search-header">
              ${searchIcon}
              <input type="text" id="docmd-search-input" placeholder="${strings.searchPlaceholder || 'Search documentation...'}" autocomplete="off" spellcheck="false">
              <button onclick="window.closeDocmdSearch()" class="docmd-search-close" aria-label="${strings.searchClose || 'Close search'}">
                  ${closeIcon}
              </button>
          </div>
          <div id="docmd-search-results" class="docmd-search-results"></div>
          <div class="docmd-search-footer">
              <span><kbd class="docmd-kbd">↑</kbd> <kbd class="docmd-kbd">↓</kbd> ${strings.searchNavigate || 'to navigate'}</span>
              <span><kbd class="docmd-kbd">ESC</kbd> ${strings.searchEscape || 'to close'}</span>
          </div>
      </div>
  </div>`;

  return { bodyScriptsHtml: modalHtml };
}

export function getAssets() {
  return [
    { url: 'https://cdn.jsdelivr.net/npm/minisearch@7.2.0/dist/umd/index.min.js', type: 'js', location: 'body' },
    { src: path.join(__dirname, 'docmd-search.js'), dest: 'assets/js/docmd-search.js', type: 'js', location: 'body' }
  ];
}