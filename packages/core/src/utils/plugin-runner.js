const { onPostBuild: searchPostBuild, getClientAssets: getSearchAssets } = require('@docmd/plugin-search');
const { onPostBuild: sitemapPostBuild } = require('@docmd/plugin-sitemap');
// We will implement SEO/Analytics later, but they are typically "hooks" inside the HTML generation
// or post-build actions.

// Map of standard plugins that run post-build
const POST_BUILD_PLUGINS = [
  { name: 'search', fn: searchPostBuild },
  { name: 'sitemap', fn: sitemapPostBuild }
];

async function runPostBuildHooks(context) {
  for (const plugin of POST_BUILD_PLUGINS) {
    try {
      if (plugin.fn) {
        await plugin.fn(context);
      }
    } catch (e) {
      console.error(`❌ Plugin '${plugin.name}' failed:`, e.message);
    }
  }
}

function getPluginAssets() {
  // Aggregate assets from plugins that have client-side scripts (like Search)
  return [
    { src: getSearchAssets(), dest: 'plugins/search' }
  ];
}

module.exports = { runPostBuildHooks, getPluginAssets };