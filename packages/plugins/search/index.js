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

const path = require('path');
const fs = require('fs/promises');
const MiniSearch = require('minisearch');

async function onPostBuild({ config, pages, outputDir, log }) {
  // Check if disabled in new config schema or old config schema
  const isEnabled = config.optionsMenu ? config.optionsMenu.components.search !== false : config.search !== false;
  if (!isEnabled) return;
  
  if(log) log('🔍 Generating search index...');

  const searchData = [];
  pages.forEach(page => {
    if (page.searchData) {
      let pageId = page.outputPath.replace(/\\/g, '/');
      if (pageId.endsWith('/index.html')) pageId = pageId.slice(0, -10);
      if (pageId.endsWith('.html')) pageId = pageId.slice(0, -5);
      
      searchData.push({
        id: pageId,
        title: page.searchData.title,
        text: page.searchData.content,
        headings: (page.searchData.headings || []).join(' ')
      });
    }
  });

  const miniSearch = new MiniSearch({
    fields: ['title', 'headings', 'text'],
    storeFields: ['title', 'id', 'text'],
    searchOptions: { boost: { title: 2, headings: 1.5 }, fuzzy: 0.2 }
  });

  miniSearch.addAll(searchData);

  const json = JSON.stringify(miniSearch.toJSON());
  await fs.writeFile(path.join(outputDir, 'search-index.json'), json);
}

// Inject the modal HTML only if the plugin is running
function generateScripts(config) {
  const isEnabled = config.optionsMenu ? config.optionsMenu.components.search !== false : config.search !== false;
  if (!isEnabled) return {};

  const searchIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide-icon icon-search"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg>`;
  const closeIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide-icon icon-x"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>`;

  const modalHtml = `
  <!-- Search Modal (Injected by @docmd/plugin-search) -->
  <div id="docmd-search-modal" class="docmd-search-modal" style="display: none;">
      <div class="docmd-search-box">
          <div class="docmd-search-header">
              ${searchIcon}
              <input type="text" id="docmd-search-input" placeholder="Search documentation..." autocomplete="off" spellcheck="false">
              <button onclick="window.closeDocmdSearch()" class="docmd-search-close" aria-label="Close search">
                  ${closeIcon}
              </button>
          </div>
          <div id="docmd-search-results" class="docmd-search-results"></div>
          <div class="docmd-search-footer">
              <span><kbd class="docmd-kbd">↑</kbd> <kbd class="docmd-kbd">↓</kbd> to navigate</span>
              <span><kbd class="docmd-kbd">ESC</kbd> to close</span>
          </div>
      </div>
  </div>`;

  return { bodyScriptsHtml: modalHtml };
}

function getAssets() {
  return [
    { url: 'https://cdn.jsdelivr.net/npm/minisearch@7.2.0/dist/umd/index.min.js', type: 'js', location: 'body' },
    { src: path.join(__dirname, 'assets/docmd-search.js'), dest: 'assets/js/docmd-search.js', type: 'js', location: 'body' }
  ];
}

module.exports = { onPostBuild, getAssets, generateScripts };