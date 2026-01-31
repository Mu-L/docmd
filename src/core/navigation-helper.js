// Source file from the docmd project — https://github.com/docmd-io/docmd

/**
 * Normalizes paths to a "canonical" form for comparison.
 * Handles: "./path", "/path", "path/index.html", "path.md"
 */
function getCanonicalPath(p) {
  if (!p) return '';
  if (p.startsWith('http')) return p; // Don't touch external URLs

  // 1. Remove leading dot-slash or slash
  let path = p.replace(/^(\.\/|\/)+/, '');

  // 2. Remove query strings or hashes
  path = path.split('?')[0].split('#')[0];

  // 3. Remove file extensions (.html, .md)
  path = path.replace(/(\.html|\.md)$/, '');

  // 4. Handle index files (folder/index -> folder)
  if (path.endsWith('/index')) {
    path = path.slice(0, -6);
  } else if (path === 'index') {
    path = '';
  }

  // 5. Remove trailing slash
  if (path.endsWith('/')) {
    path = path.slice(0, -1);
  }

  return path;
}

function findPageNeighbors(navItems, currentPagePath) {
  const flatNavigation = [];
  const currentCanonical = getCanonicalPath(currentPagePath);

  function recurse(items) {
    if (!items || !Array.isArray(items)) return;

    for (const item of items) {
      // Logic: Only consider items that have a path and are NOT external
      // Also ignore items that are just '#' (placeholder parents)
      if (item.path && !item.external && !item.path.startsWith('http') && item.path !== '#') {
        flatNavigation.push({
          title: item.title,
          path: item.path, // Keep original path for the HREF
          canonical: getCanonicalPath(item.path) // Use canonical for comparison
        });
      }

      if (item.children) {
        recurse(item.children);
      }
    }
  }

  recurse(navItems);

  // Find index using canonical paths
  const index = flatNavigation.findIndex(item => item.canonical === currentCanonical);

  if (index === -1) {
    return { prevPage: null, nextPage: null };
  }

  return {
    prevPage: index > 0 ? flatNavigation[index - 1] : null,
    nextPage: index < flatNavigation.length - 1 ? flatNavigation[index + 1] : null
  };
}

module.exports = { findPageNeighbors };