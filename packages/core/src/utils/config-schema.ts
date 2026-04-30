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

import { normalizeNavPaths, normalizeMenubarPaths } from '@docmd/parser';

/**
 * Normalizes user config to ensure all required nested objects exist.
 * Handles legacy backward compatibility transparently.
 */
export function normalizeConfig(userConfig: any) {
    const config = { ...userConfig };

    // --- 1. Modern Syntax Standard (V3) ---
    // New labels are the source of truth. Fallback to legacy labels if present.
    // Every field MUST have a default here so no consumer needs its own fallback chain.
    config.title = config.title || config.siteTitle || 'Documentation';
    config.url = config.url || config.siteUrl || config.baseUrl || '';
    config.src = process.env.DOCMD_PROJECT_SRC || config.src || config.srcDir || config.source || 'docs';
    config.out = process.env.DOCMD_PROJECT_OUT || config.out || config.outDir || config.outputDir || 'site';
    config.base = process.env.DOCMD_PROJECT_PREFIX || config.base || '/';

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
            alt: config.title || 'Logo'
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

    if (config.footer.columns && Array.isArray(config.footer.columns)) {
        for (const col of config.footer.columns) {
            if (col.links && Array.isArray(col.links)) {
                normalizeMenubarPaths(col.links);
            }
        }
    }

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
            position: userLayout.menubar.position || 'top',
            left: Array.isArray(userLayout.menubar.left) ? userLayout.menubar.left : [],
            right: Array.isArray(userLayout.menubar.right) ? userLayout.menubar.right : [],
            ...userLayout.menubar
        };
        normalizeMenubarPaths(config.menubar.left);
        normalizeMenubarPaths(config.menubar.right);
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
        appearance: 'system',
        customCss: [],
        ...(config.theme || {})
    };

    // Legacy Support: Map defaultMode to appearance if appearance isn't explicitly set
    if (config.theme.defaultMode && !userConfig.theme?.appearance) {
        config.theme.appearance = config.theme.defaultMode;
    }

    // Ensure defaultMode is still available for legacy templates/plugins
    config.theme.defaultMode = config.theme.appearance;

    config.customJs = config.customJs || [];

    // Normalize Navigation
    config.navigation = Array.isArray(config.navigation) ? config.navigation : [];

    normalizeNavPaths(config.navigation);

    // --- 5. Plugins ---
    config.hasExplicitPlugins = 'plugins' in userConfig;
    config.plugins = config.plugins || {};

    // --- 6. Versioning Engine ---
    if (config.versions && Array.isArray(config.versions.all)) {
        if (!config.versions.current) {
            config.versions.current = config.versions.all[0]?.id || 'main';
        }
        config.versions.position = config.versions.position || 'sidebar-top';
        config.versions.all = config.versions.all.map((v: any) => {
            return {
                id: v.id,
                dir: v.dir || `docs-${v.id}`,
                label: v.label || v.id,
                navigation: v.navigation || null
            };
        });
    } else {
        config.versions = false;
    }

    // --- 7. SEO Redirects & 404 ---
    config.redirects = config.redirects || {};
    config.notFound = config.notFound || {
        title: '404 : Page Not Found',
        content: 'The page you are looking for does not exist or has been moved.'
    };

    // --- 8. Internationalisation (i18n) ---
    if (config.i18n && config.i18n.locales && Array.isArray(config.i18n.locales) && config.i18n.locales.length > 0) {
        config.i18n = {
            default: config.i18n.default || config.i18n.locales[0].id || 'en',
            position: config.i18n.position || 'options-menu',
            stringMode: config.i18n.stringMode || false,
            inPlace: config.i18n.inPlace || false,
            locales: config.i18n.locales.map((loc: any) => ({
                id: loc.id,
                label: loc.label || loc.id,
                dir: loc.dir || 'ltr',
                translations: loc.translations || {}
            }))
        };
    } else {
        config.i18n = false;
    }

    // --- 9. OptionsMenu Fallbacks ---
    if (config.optionsMenu.position === 'menubar' && (!config.menubar || config.menubar.enabled === false)) {
        config.optionsMenu.position = 'sidebar-top';
    } else if (config.optionsMenu.position === 'header' && (!config.header || config.header.enabled === false)) {
        config.optionsMenu.position = 'sidebar-top';
    }

    return config;
}

// Re-export for backward compatibility (used by generator.ts, versioning.ts)
export { normalizeNavPaths, normalizeMenubarPaths } from '@docmd/parser';