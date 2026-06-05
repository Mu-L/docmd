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
import MiniSearch from 'minisearch';
import { outputPathToSlug } from '@docmd/api';

export async function buildSearchIndex(config: any, pages: any[], outputDir: string) {
  // Determine locale configuration
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

    // Determine which locale this page belongs to
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

  // Build an index per locale
  for (const [localeId, locPages] of Object.entries(localePages)) {
    if (locPages.length === 0) continue;

    const searchData: any[] = [];
    const seenIds = new Set();

    for (const page of locPages) {
      let pageId = outputPathToSlug(page.outputPath);
      
      if (pageId.startsWith('/') && pageId !== '/') {
        pageId = pageId.slice(1);
      }

      // Detect version from the output path
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

      // Add the main page record
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

      // Add individual heading records for deep linking
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

    // Build MiniSearch index
    const storeFields = ['title', 'id', 'text'];
    if (hasVersioning) storeFields.push('version');

    const CJK_AND_SPACELESS_REGEX = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f\uac00-\ud7af\u1100-\u11ff\u3130-\u318f\u0e00-\u0e7f\u0e80-\u0eff\u1780-\u17ff\u1000-\u109f\u0f00-\u0fff]/g;
    const miniSearch = new MiniSearch({
      fields: ['title', 'headings', 'text'],
      storeFields,
      tokenize: (text: string) => {
        const spaced = text.replace(CJK_AND_SPACELESS_REGEX, ' $& ');
        const defaultTokenize = MiniSearch.getDefault('tokenize');
        return defaultTokenize ? defaultTokenize(spaced) : spaced.toLowerCase().split(/[^a-zA-Z0-9_'\u00C0-\u017F\u00d0\u00f0\u00df\u00f8\u00e6\u0153\u03ac-\u03ce\u0400-\u04ff]+/u).filter(Boolean);
      },
      searchOptions: { boost: { title: 2, headings: 1.5 }, fuzzy: 0.2 }
    });

    miniSearch.addAll(searchData);
    const json = JSON.stringify(miniSearch.toJSON());

    // Write to the correct locale directory
    const indexPath = localeId === '_default'
      ? path.join(outputDir, 'search-index.json')
      : path.join(outputDir, localeId, 'search-index.json');

    await fs.mkdir(path.dirname(indexPath), { recursive: true });
    await fs.writeFile(indexPath, json);
  }
}