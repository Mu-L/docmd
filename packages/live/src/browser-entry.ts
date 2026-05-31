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

import { createMarkdownProcessor, processContent } from '@docmd/parser/dist/markdown-processor.js';
import { renderTemplateAsync } from '@docmd/parser/dist/html-renderer.js';
import texmath from 'markdown-it-texmath';
import katex from 'katex';
// @ts-expect-error virtual module
import templates from 'virtual:docmd-templates';

// Expose the compile function to the window.docmd global
async function compile(markdown: string, config: any = {}) {
    const defaults: any = {
        siteTitle: 'Live Preview',
        theme: { appearance: 'light', name: 'default', codeHighlight: true },
        layout: { spa: false },
        ...config
    };

    // 1. Process Markdown with Plugin Support
    const md = createMarkdownProcessor(defaults, (parser) => {
        // Math (KaTeX)
        parser.use(texmath, { engine: katex, delimiters: 'dollars' });

        // Mermaid fence override
        const defaultFence = parser.renderer.rules.fence;
        parser.renderer.rules.fence = (tokens, idx, options, env, self) => {
            const info = tokens[idx].info.trim();
            if (info === 'mermaid') {
                return `<div class="mermaid">${parser.utils.escapeHtml(tokens[idx].content)}</div>\n`;
            }
            return defaultFence(tokens, idx, options, env, self);
        };
    });
    const result = processContent(markdown, md, defaults);

    if (!result) return '<p>Error parsing markdown</p>';

    // Since we are in the browser, we assume assets are served at ./assets/
    const assetsRoot = './assets';

    // 1. CSS Injection
    const cssTags = [
        `<link rel="stylesheet" href="${assetsRoot}/css/docmd-main.css">`
    ];

    if (defaults.theme.codeHighlight !== false) {
        const mode = defaults.theme.appearance === 'dark' ? 'dark' : 'light';
        cssTags.push(`<link rel="stylesheet" href="${assetsRoot}/css/docmd-highlight-${mode}.css">`);
    }

    if (defaults.theme.name && defaults.theme.name !== 'default') {
        cssTags.push(`<link rel="stylesheet" href="${assetsRoot}/css/docmd-theme-${defaults.theme.name}.css">`);
    }

    cssTags.push(`<link rel="stylesheet" href="${assetsRoot}/css/docmd-live-preview.css">`);
    cssTags.push(`<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/katex.min.css">`);


    // 2. JS Injection
    const mermaidScript = `
    <script type="module">
        import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
        async function initMermaid() {
            try {
                const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
                mermaid.initialize({
                    startOnLoad: false,
                    theme: isDark ? 'dark' : 'default',
                    securityLevel: 'loose',
                });
                const nodes = document.querySelectorAll('.mermaid');
                if (nodes.length > 0) {
                    await mermaid.run({ nodes });
                }
            } catch (e) { console.error('Mermaid error:', e); }
        }
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            initMermaid();
        } else {
            document.addEventListener('DOMContentLoaded', initMermaid);
        }
    </script>
    `;

    const _jsTags = [mermaidScript];

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
        appearance: defaults.theme.appearance,
        defaultMode: defaults.theme.appearance, // For legacy support during transition

        // Navigation Stub
        navigationHtml: '',
        relativePathToRoot: './',
        outputPath: 'index.html',
        currentPagePath: '/index',
        isOfflineMode: false,
        prevPage: null, nextPage: null,

        // Injecting Assets
        pluginHeadScriptsHtml: cssTags.join('\n'),
        pluginBodyScriptsHtml: mermaidScript,
        themeInitScript: themeInitScript,

        // Layout & UI Configurations
        faviconLinkHtml: '',
        logo: defaults.logo,
        theme: defaults.theme,
        customCssFiles: [], customJsFiles: [],

        // Layout Adapters
        headerConfig: { enabled: true },
        sidebarConfig: { collapsible: false, defaultCollapsed: false },
        footerConfig: { style: 'minimal', content: '' },
        optionsMenu: { position: 'header', components: { search: false, themeSwitch: true, sponsor: null } },
        footerHtml: '',

        isActivePage: true,
        editUrl: null,
        editLinkText: '',

        // Workspace is not applicable in the live browser environment
        workspace: null
    };

    // 5. Render
    const templateName = result.frontmatter.noStyle ? 'no-style.ejs' : 'layout.ejs';
    const templateStr = templates[templateName];

    if (!templateStr) return `Template ${templateName} not found`;

    const options = {
        includer: (originalPath) => {
            const name = originalPath.endsWith('.ejs') ? originalPath : originalPath + '.ejs';
            if (templates[name]) return { template: templates[name] };
            return null;
        }
    };

    return await renderTemplateAsync(templateStr, pageData, options);
}

export { compile };