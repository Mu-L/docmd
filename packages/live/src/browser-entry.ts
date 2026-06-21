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
    const appearance = defaults.theme.appearance || 'light';

    // Theme init script — handles DOCMD_APPEARANCE + safe localStorage
    const themeInitScript = templates['partials/theme-init.js'] || '';

    // KaTeX stylesheet (theme tokens come from docmd-main.css)
    const katexCss = `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/katex.min.css">`;

    // Mermaid init — runs in the preview iframe, picks up the current theme
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

    // Stripped-down preview HTML — no topbar, sidebar, page-header, footer,
    // or docmd-main.js (which is what injects the per-code-block copy
    // buttons). The preview is purely the rendered content region with
    // theme tokens, KaTeX, and mermaid. A small stylesheet tail adjusts
    // the bare body for iframe rendering.
    return `<!DOCTYPE html>
<html lang="en" data-theme="${appearance}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${result.frontmatter.title || 'Live Preview'}</title>
    <script>window.DOCMD_APPEARANCE = "${appearance}";</script>
    <script>${themeInitScript}</script>
    <link rel="stylesheet" href="${assetsRoot}/css/docmd-main.css?v=live">
    <link rel="stylesheet" href="${assetsRoot}/css/docmd-live-preview.css">
    ${katexCss}
    <style>
        body { max-width: 880px; margin: 0 auto; padding: 2rem 1.5rem 4rem; }
        body > :first-child { margin-top: 0; }
    </style>
</head>
<body>
${result.htmlContent}
${mermaidScript}
</body>
</html>`;
}

export { compile };