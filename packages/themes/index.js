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

/**
 * Returns the absolute path to the requested theme CSS file.
 * @param {string} themeName - 'sky', 'retro', 'ruby'
 * @returns {string} Absolute path to css file
 */
function getThemePath(themeName) {
  const cleanName = themeName.toLowerCase();
  // We point to src for now, or dist if you plan to add a build step later
  return path.join(__dirname, 'src', `${cleanName}.css`);
}

/**
 * Returns the directory containing all themes
 */
function getThemesDir() {
  return path.join(__dirname, 'src');
}

module.exports = {
  getThemePath,
  getThemesDir
};