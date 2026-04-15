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

import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Translation System ---

let translationsCache: Record<string, Record<string, string>> = {};

export function getTranslationsDir() {
    return path.join(__dirname, '..', 'translations');
}

/**
 * Load translation strings for a locale. Falls back to English for missing keys.
 * Supports plugin overrides via the `overrides` parameter.
 */
export function loadTranslations(localeId?: string | null, overrides?: Record<string, string>): Record<string, string> {
    const locale = localeId || 'en';

    // Load English as the base (always available)
    if (!translationsCache['en']) {
        try {
            const enPath = path.join(getTranslationsDir(), 'en.json');
            translationsCache['en'] = JSON.parse(readFileSync(enPath, 'utf8'));
        } catch {
            translationsCache['en'] = {};
        }
    }

    // Load target locale if not English
    if (locale !== 'en' && !translationsCache[locale]) {
        try {
            const localePath = path.join(getTranslationsDir(), `${locale}.json`);
            translationsCache[locale] = JSON.parse(readFileSync(localePath, 'utf8'));
        } catch {
            translationsCache[locale] = {};
        }
    }

    // Merge: English base → locale overrides → plugin overrides
    const strings = {
        ...translationsCache['en'],
        ...(locale !== 'en' ? translationsCache[locale] : {}),
        ...(overrides || {})
    };

    return strings;
}

/**
 * Create a `t()` function for use in templates.
 * Returns the translated string for a key, falling back to the key itself.
 * Supports simple interpolation: t('key', { name: 'value' }) replaces {name} in the string.
 */
export function createT(strings: Record<string, string>): (key: string, params?: Record<string, string>) => string {
    return (key: string, params?: Record<string, string>) => {
        let str = strings[key] || key;
        if (params) {
            for (const [k, v] of Object.entries(params)) {
                str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
            }
        }
        return str;
    };
}

/**
 * Clear the translations cache (useful for dev server rebuilds).
 */
export function clearTranslationsCache() {
    translationsCache = {};
}

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