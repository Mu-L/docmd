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

const fs = require('fs');
const path = require('path');

// Extract title from Frontmatter or H1 without loading heavy parsers
function extractTitleFromFile(filePath, filename) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // 1. Try YAML frontmatter title
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (fmMatch) {
      const titleMatch = fmMatch[1].match(/^title:\s*"?([^"\n]+)"?/m);
      if (titleMatch) return titleMatch[1].trim();
    }
    
    // 2. Try H1
    const h1Match = content.match(/^#\s+(.*)/m);
    if (h1Match) return h1Match[1].trim();

  } catch (e) {}

  // 3. Fallback: Prettify Filename
  // "index copy.md" -> "Index Copy"
  const cleanName = filename.replace(/\.md$/i, '');
  // Capitalize first letter of each word
  return cleanName.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Recursively builds the navigation array for Zero Config mode.
 */
function buildAutoNav(dir, basePath = '/') { // Default base path is root '/'
  const items = fs.readdirSync(dir, { withFileTypes: true });
  const nav = [];

  for (const item of items) {
    // Skip hidden files, node_modules, and typical output/asset dirs
    if (
      item.name.startsWith('.') || 
      item.name === '_playground' || 
      item.name === 'node_modules' || 
      item.name === 'assets' || 
      item.name === 'site' || 
      item.name === 'dist'
    ) continue;

    const fullPath = path.join(dir, item.name);
    
    // Construct URL path: basePath + filename
    // Ensure we don't double slash if basePath is '/'
    const safeBase = basePath.endsWith('/') ? basePath : basePath + '/';
    const relPath = safeBase + item.name;

    if (item.isDirectory()) {
      const children = buildAutoNav(fullPath, relPath);
      if (children.length > 0) {
        const title = item.name.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        nav.push({ 
          title, 
          collapsible: true,
          children 
        });
      }
    } else if (item.isFile() && item.name.toLowerCase().endsWith('.md')) {
      const title = extractTitleFromFile(fullPath, item.name);
      
      let linkPath = relPath;
      
      // Handle index.md -> maps to the folder root
      if (item.name.toLowerCase() === 'index.md') {
        linkPath = basePath === '/' ? '/' : basePath; 
      } else {
        // Strip extension for clean URLs
        linkPath = linkPath.replace(/\.md$/i, '');
      }

      nav.push({ title, path: linkPath });
    }
  }

  // Sort: Put index.md (Home) at the top, then sort alphabetically
  return nav.sort((a, b) => {
    // Check if path effectively points to current folder root
    const aIsRoot = a.path === basePath || a.path === basePath + '/';
    const bIsRoot = b.path === basePath || b.path === basePath + '/';
    
    if (aIsRoot && !bIsRoot) return -1;
    if (!aIsRoot && bIsRoot) return 1;
    
    // Folders usually come after files in some docs, or before. 
    // Let's standard: Files (Home) -> Folders -> Other Files
    const aIsDir = !!a.children;
    const bIsDir = !!b.children;
    
    if (aIsDir && !bIsDir) return 1;
    if (!aIsDir && bIsDir) return -1;

    return a.title.localeCompare(b.title);
  });
}

module.exports = { buildAutoNav };