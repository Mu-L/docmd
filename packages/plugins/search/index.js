const path = require('path');
const fs = require('fs/promises');
const MiniSearch = require('minisearch');

/**
 * Hook to run after HTML generation is complete.
 * @param {Object} context - { config, pages, outputDir, log }
 */
async function onPostBuild({ config, pages, outputDir, log }) {
  if (config.search === false) return;
  
  if(log) log('🔍 Generating search index...');

  const searchData = [];

  // Extract search data from processed pages
  pages.forEach(page => {
    // We expect 'page.searchData' to be populated by the Core processor
    if (page.searchData) {
      // Normalize ID to be the URL path
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

/**
 * Returns path to client-side assets to be copied.
 */
function getAssets() {
  return [
    // 1. External Library (CDN)
    {
      url: 'https://cdn.jsdelivr.net/npm/minisearch@7.2.0/dist/umd/index.min.js',
      type: 'js',
      location: 'body' // Load at end of body
    },
    // 2. Local Logic (The glue code)
    {
      src: path.join(__dirname, 'assets/docmd-search.js'),
      dest: 'assets/js/docmd-search.js', // Renamed for clarity
      type: 'js',
      location: 'body'
    }
  ];
}

module.exports = { onPostBuild, getAssets };