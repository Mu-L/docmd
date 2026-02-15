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

const { createMarkdownProcessor, processContent } = require('@docmd/parser/src/markdown-processor');
const { renderTemplate } = require('@docmd/parser/src/html-renderer');
const templates = require('virtual:docmd-templates');

// Expose the compile function to the window.docmd global
function compile(markdown, config = {}) {
    const defaults = {
        siteTitle: 'Live Preview',
        theme: { defaultMode: 'light', name: 'default', codeHighlight: true },
        ...config
    };

    // 1. Process Markdown
    const md = createMarkdownProcessor(defaults);
    const result = processContent(markdown, md, defaults);
    
    if (!result) return '<p>Error parsing markdown</p>';

    // Since we are in the browser, we assume assets are served at ./assets/
    const assetsRoot = './assets';
    
    // 1. CSS Injection
    const cssTags = [
        `<link rel="stylesheet" href="${assetsRoot}/css/docmd-main.css">`
    ];
    
    if (defaults.theme.codeHighlight !== false) {
        const mode = defaults.theme.defaultMode === 'dark' ? 'dark' : 'light';
        cssTags.push(`<link rel="stylesheet" href="${assetsRoot}/css/docmd-highlight-${mode}.css">`);
    }
    
    if (defaults.theme.name && defaults.theme.name !== 'default') {
        cssTags.push(`<link rel="stylesheet" href="${assetsRoot}/css/docmd-theme-${defaults.theme.name}.css">`);
    }

    cssTags.push(`<link rel="stylesheet" href="${assetsRoot}/css/docmd-live-preview.css">`);

    // 2. JS Injection
    const jsTags = [
        `<script src="${assetsRoot}/js/docmd-main.js"></script>`
    ];

    // 3. Theme Init Script
    let themeInitScript = '';
    if (templates['partials/theme-init.js']) {
        themeInitScript = `<script>${templates['partials/theme-init.js']}</script>`;
    }

    // 4. Prepare Data
    const pageData = {
        content: result.htmlContent,
        frontmatter: result.frontmatter,
        headings: result.headings,
        config: defaults,
        buildHash: 'live',
        siteTitle: defaults.siteTitle,
        pageTitle: result.frontmatter.title || 'Untitled',
        description: result.frontmatter.description || '',
        defaultMode: defaults.theme.defaultMode,

        // Navigation Stub
        navigationHtml: '', 
        relativePathToRoot: './', 
        outputPath: 'index.html',
        currentPagePath: '/index',
        prevPage: null,
        nextPage: null,

        // Inject the constructed assets
        pluginHeadScriptsHtml: cssTags.join('\n'), 
        pluginBodyScriptsHtml: jsTags.join('\n'),
        themeInitScript: themeInitScript,

        // Helpers
        faviconLinkHtml: '', 
        logo: defaults.logo, 
        sidebarConfig: { collapsible: false }, 
        theme: defaults.theme,
        customCssFiles: [], customJsFiles: [],
        sponsor: {}, footer: '', footerHtml: '',
        isActivePage: true,
        editUrl: null, editLinkText: ''
    };

    // 5. Render
    const templateName = result.frontmatter.noStyle ? 'no-style.ejs' : 'layout.ejs';
    const templateStr = templates[templateName];
    
    if (!templateStr) return `Template ${templateName} not found`;

    const options = {
        includer: (originalPath) => {
            let name = originalPath.endsWith('.ejs') ? originalPath : originalPath + '.ejs';
            if (templates[name]) return { template: templates[name] };
            return null;
        }
    };

    return renderTemplate(templateStr, pageData, options);
}

module.exports = { compile };