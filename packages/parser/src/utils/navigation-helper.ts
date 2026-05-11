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

// Normalizes paths to a "canonical" form for comparison.
function getCanonicalPath(p) {
  if (!p) return '';
  if (p.startsWith('http')) return p;

  // 1. Remove ./ and leading /
  let path = p.replace(/^\.?\//, '');

  // 2. Remove file extension
  path = path.replace(/(\.html|\.md)$/, '');

  // 3. Remove index/README suffix
  if (path.endsWith('index')) {
    path = path.slice(0, -5);
  } else if (path.endsWith('README')) {
    path = path.slice(0, -6);
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

function findBreadcrumbs(navItems, currentPagePath) {
  const currentCanonical = getCanonicalPath(currentPagePath);
  let breadcrumbs = [];

  function recurse(items, currentTrail = []) {
    if (!items) return false;
    for (const item of items) {
      const trail = [...currentTrail, { title: item.title, path: item.path }];
      
      if (item.path && getCanonicalPath(item.path) === currentCanonical) {
        breadcrumbs = trail;
        return true;
      }

      if (item.children) {
        if (recurse(item.children, trail)) return true;
      }
    }
    return false;
  }

  recurse(navItems);
  return breadcrumbs;
}

export { findPageNeighbors, findBreadcrumbs };