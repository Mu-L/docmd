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

module.exports = {
    getTemplatesDir: () => path.join(__dirname, 'templates'),
    getAssetsDir: () => path.join(__dirname, 'assets'),
    // Helper to resolve template paths
    getTemplatePath: (name) => {
        const fileName = name.endsWith('.ejs') ? name : `${name}.ejs`;
        return path.join(__dirname, 'templates', fileName);
    }
};