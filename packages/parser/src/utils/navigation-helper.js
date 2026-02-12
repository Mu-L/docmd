/**
 * Normalizes paths to a "canonical" form for comparison.
 */
function getCanonicalPath(p) {
  if (!p) return '';
  if (p.startsWith('http')) return p;

  // 1. Remove ./ and leading /
  let path = p.replace(/^\.?\//, '');

  // 2. Remove file extension
  path = path.replace(/(\.html|\.md)$/, '');

  // 3. Remove index suffix
  if (path.endsWith('index')) {
    path = path.slice(0, -5);
  }

  // 4. Remove trailing slash
  if (path.endsWith('/')) {
    path = path.slice(0, -1);
  }

  // 5. Ensure root is empty string or consistent slash
  return path === '' ? '/' : '/' + path;
}

function findPageNeighbors(navItems, currentPagePath) {
  const flatNavigation = [];
  const currentCanonical = getCanonicalPath(currentPagePath);

  function recurse(items) {
    if (!items) return;
    for (const item of items) {
      if (item.path && !item.external) {
        flatNavigation.push({
          title: item.title,
          path: item.path,
          url: item.path, // We will fix this URL in build.js context if needed
          canonical: getCanonicalPath(item.path)
        });
      }
      if (item.children) recurse(item.children);
    }
  }
  recurse(navItems);

  const index = flatNavigation.findIndex(item => item.canonical === currentCanonical);

  return {
    prevPage: index > 0 ? flatNavigation[index - 1] : null,
    nextPage: index < flatNavigation.length - 1 ? flatNavigation[index + 1] : null
  };
}

module.exports = { findPageNeighbors };