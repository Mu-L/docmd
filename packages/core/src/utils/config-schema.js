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

    // --- 1. Modern Syntax Standard (V3) ---
    // New labels are the source of truth. Fallback to legacy labels if present.
    config.title = config.title || config.siteTitle;
    config.url = config.url || config.siteUrl || config.baseUrl;
    config.src = config.src || config.srcDir || config.source || 'docs';
    config.out = config.out || config.outDir || config.outputDir || 'site';
    config.base = config.base || '/';

    // Failsafe: Keep legacy keys attached for older plugins (SEO, Sitemap) to prevent breakage during transition.
    config.siteTitle = config.title;
    config.siteUrl = config.url;
    config.srcDir = config.src;
    config.outputDir = config.out;

    // --- Logo Normalization
    if (typeof config.logo === 'string') {
        config.logo = {
            light: config.logo,
            dark: config.logo,
            alt: config.title || 'Logo',
            href: '/'
        };
    }

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
        branding: true,
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

    // --- Menubar (Top Navigation Bar) ---
    if (userLayout.menubar) {
        config.menubar = {
            enabled: true,
            position: 'top', // 'top' or 'header'
            ...userLayout.menubar
        };
    } else {
        config.menubar = null;
    }

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

    // --- 5. Plugins ---
    config.plugins = config.plugins || {};

    // --- 6. Versioning Engine ---
    if (config.versions && Array.isArray(config.versions.all)) {
        if (!config.versions.current) {
            config.versions.current = config.versions.all[0]?.id || 'main';
        }
        config.versions.position = config.versions.position || 'sidebar-top';
        config.versions.all = config.versions.all.map(v => ({
            id: v.id,
            dir: v.dir || `docs-${v.id}`,
            label: v.label || v.id
        }));
    } else {
        config.versions = false;
    }

    // --- 7. SEO Redirects & 404 ---
    config.redirects = config.redirects || {};
    config.notFound = config.notFound || {
        title: '404 : Page Not Found',
        content: 'The page you are looking for does not exist or has been moved.'
    };

    return config;
}

module.exports = { normalizeConfig };