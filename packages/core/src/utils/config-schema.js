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

const chalk = require('chalk');

/**
 * Normalizes user config to ensure all required nested objects exist.
 * Handles legacy backward compatibility transparently.
 */
function normalizeConfig(userConfig) {
    const config = { ...userConfig };

    // --- 1. Defaults & Root Settings ---
    config.srcDir = config.srcDir || 'docs';
    config.outputDir = config.outputDir || 'site';
    config.base = config.base || '/';

    // --- 2. Layout Structure (V2 Schema) ---
    const userLayout = config.layout || {};

    config.layout = {
        spa: true,
        ...userLayout
    };
    
    config.header = {
        enabled: true,
        ...(userLayout.header || config.header || {})
    };

    // Legacy Mapping: Sidebar
    const legacySidebar = config.sidebar || {};
    config.sidebar = {
        enabled: true,
        collapsible: true, 
        defaultCollapsed: false,
        position: 'left',
        ...(userLayout.sidebar || legacySidebar)
    };

    // Legacy Mapping: Footer
    const legacyFooter = config.footer;
    config.footer = {
        style: 'minimal',
        content: typeof legacyFooter === 'string' ? legacyFooter : null,
        ...(userLayout.footer || (typeof legacyFooter === 'object' ? legacyFooter : {}))
    };

    // --- 3. Options Menu (Search, Theme, Sponsor) ---
    config.optionsMenu = {
        position: 'header', 
        components: {
        search: true,
        themeSwitch: true,
        sponsor: null 
        },
        ...(userLayout.optionsMenu || config.optionsMenu || {})
    };

    // --> Legacy Adapter: Sponsor
    if (config.sponsor) {
        if (typeof config.sponsor === 'object' && config.sponsor.enabled && config.sponsor.link) {
        config.optionsMenu.components.sponsor = config.sponsor.link;
        } else if (typeof config.sponsor === 'string') {
        config.optionsMenu.components.sponsor = config.sponsor;
        }
    }

    // --> Legacy Adapter: Search (Boolean)
    if (typeof config.search === 'boolean') {
        config.optionsMenu.components.search = config.search;
    }

    // --> Legacy Adapter: Theme Switch & Position
    if (config.theme) {
        if (config.theme.enableModeToggle === false) {
        config.optionsMenu.components.themeSwitch = false;
        }
        if (config.theme.positionMode === 'bottom') {
        config.optionsMenu.position = 'sidebar-bottom';
        } else if (config.theme.positionMode === 'top') {
        config.optionsMenu.position = 'header';
        }
    }

    // --- 4. Theme & Branding ---
    config.theme = {
        name: 'default',
        defaultMode: 'system',
        customCss: [],
        ...(config.theme || {})
    };

    config.customJs = config.customJs || [];

    // Normalize Navigation
    config.navigation = Array.isArray(config.navigation) ? config.navigation : [];
    if (config.navigation.length === 0) {
        config.navigation.push({ title: 'Home', path: '/' });
    }

    // --- 5. Plugins ---
    // Ensure plugins object exists, populated by defaults + overrides
    config.plugins = config.plugins || {};

    return config;
}

module.exports = { normalizeConfig };