/**
 * --------------------------------------------------------------------
 * docmd : the minimalist, zero-config documentation generator.
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
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function getTemplatesDir() {
    return path.join(__dirname, '..', 'templates');
}

export function getAssetsDir() {
    return path.join(__dirname, '..', 'assets');
}

// Helper to resolve template paths
export function getTemplatePath(name: string) {
    const fileName = name.endsWith('.ejs') ? name : `${name}.ejs`;
    return path.join(__dirname, '..', 'templates', fileName);
}