// Source file from the docmd project — https://github.com/docmd-io/docmd

const ejs = require('ejs');
const path = require('path');
const fs = require('../core/fs-utils');
const { createMarkdownItInstance } = require('./file-processor');
const { generateSeoMetaTags } = require('../plugins/seo');
const { generateAnalyticsScripts } = require('../plugins/analytics');
const { renderIcon } = require('./icon-renderer');

let mdInstance = null;
let themeInitScript = '';

(async () => {
    try {
        const themeInitPath = path.join(__dirname, '..', 'templates', 'partials', 'theme-init.js');
        if (await fs.exists(themeInitPath)) {
            const scriptContent = await fs.readFile(themeInitPath, 'utf8');
            themeInitScript = `<script>\n${scriptContent}\n</script>`;
        }
    } catch (e) { /* ignore */ }
})();

// Basic whitespace cleanup (keep this simple version)
function cleanupHtml(html) {
    if (!html) return '';
    // return html.replace(/^\s*[\r\n]/gm, '').trim(); // Remove leading/trailing blank lines from each line
    return html.trim(); // Only trim the start/end of the whole document
}

function fixHtmlLinks(htmlContent, relativePathToRoot, isOfflineMode, configBase = '/') {
    if (!htmlContent) return '';
    const root = relativePathToRoot || './';
    const baseUrl = configBase.endsWith('/') ? configBase : configBase + '/';

    return htmlContent.replace(/(href|src)=["']([^"']+)["']/g, (match, attr, url) => {
        if (url.startsWith('#') || url.startsWith('http') || url.startsWith('mailto:') || url === '') {
            return match;
        }

        let finalPath = url;

        // 1. Handle Base URL removal
        if (baseUrl !== '/' && url.startsWith(baseUrl)) {
            finalPath = '/' + url.substring(baseUrl.length);
        }

        // 2. Handle Absolute Paths
        if (finalPath.startsWith('/')) {
            // Simple logic: if root relative, prepend relative path
            finalPath = root + finalPath.substring(1);
        }

        // 3. Offline Mode Logic
        if (isOfflineMode) {
            const [pathOnly] = finalPath.split(/[?#]/);
            const ext = path.extname(pathOnly);
            const isAsset = ['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico'].includes(ext.toLowerCase());
            
            if (!isAsset && !ext) {
                if (finalPath.endsWith('/')) {
                    finalPath += 'index.html';
                } else if (!finalPath.includes('#')) {
                    finalPath += '/index.html';
                }
            }
        } else {
            if (finalPath.endsWith('/index.html')) {
                finalPath = finalPath.substring(0, finalPath.length - 10);
            }
        }
        
        return `${attr}="${finalPath}"`;
    });
}

async function processPluginHooks(config, pageData, relativePathToRoot) {
    let metaTagsHtml = '';
    let faviconLinkHtml = '';
    let themeCssLinkHtml = '';
    let pluginStylesHtml = '';
    let pluginHeadScriptsHtml = '';
    let pluginBodyScriptsHtml = '';

    const safeRoot = relativePathToRoot || './';

    if (config.favicon) {
        const cleanFaviconPath = config.favicon.startsWith('/') ? config.favicon.substring(1) : config.favicon;
        const finalFaviconHref = `${safeRoot}${cleanFaviconPath}`;
        faviconLinkHtml = `<link rel="icon" href="${finalFaviconHref}" type="image/x-icon" sizes="any">\n<link rel="shortcut icon" href="${finalFaviconHref}" type="image/x-icon">`;
    }

    if (config.theme && config.theme.name && config.theme.name !== 'default') {
        const themeCssPath = `assets/css/docmd-theme-${config.theme.name}.css`;
        themeCssLinkHtml = `<link rel="stylesheet" href="${safeRoot}${themeCssPath}">`;
    }

    if (config.plugins?.seo) {
        metaTagsHtml += generateSeoMetaTags(config, pageData, safeRoot);
    }

    if (config.plugins?.analytics) {
        const analyticsScripts = generateAnalyticsScripts(config, pageData);
        pluginHeadScriptsHtml += analyticsScripts.headScriptsHtml;
        pluginBodyScriptsHtml += analyticsScripts.bodyScriptsHtml;
    }

    return { metaTagsHtml, faviconLinkHtml, themeCssLinkHtml, pluginStylesHtml, pluginHeadScriptsHtml, pluginBodyScriptsHtml };
}

async function generateHtmlPage(templateData, isOfflineMode = false) {
    let { content, frontmatter, outputPath, headings, config } = templateData;
    const { currentPagePath, prevPage, nextPage, relativePathToRoot, navigationHtml, siteTitle } = templateData;
    const pageTitle = frontmatter.title;

    if (!relativePathToRoot) templateData.relativePathToRoot = './';

    content = fixHtmlLinks(content, templateData.relativePathToRoot, isOfflineMode, config.base);
    const pluginOutputs = await processPluginHooks(config, { frontmatter, outputPath }, templateData.relativePathToRoot);

    let footerHtml = '';
    if (config.footer) {
        if (!mdInstance) mdInstance = createMarkdownItInstance(config);
        footerHtml = mdInstance.renderInline(config.footer);
        footerHtml = fixHtmlLinks(footerHtml, templateData.relativePathToRoot, isOfflineMode, config.base);
    }

    let templateName = frontmatter.noStyle === true ? 'no-style.ejs' : 'layout.ejs';
    const layoutTemplatePath = path.join(__dirname, '..', 'templates', templateName);
    if (!await fs.exists(layoutTemplatePath)) throw new Error(`Template not found: ${layoutTemplatePath}`);
    const layoutTemplate = await fs.readFile(layoutTemplatePath, 'utf8');

    const isActivePage = currentPagePath && content && content.trim().length > 0;

    let editUrl = null;
    let editLinkText = 'Edit this page';
    if (config.editLink && config.editLink.enabled && config.editLink.baseUrl) {
         editUrl = `${config.editLink.baseUrl.replace(/\/$/, '')}/${outputPath.replace(/\/index\.html$/, '.md')}`;
         if (outputPath.endsWith('index.html') && outputPath !== 'index.html') editUrl = editUrl.replace('.md', '/index.md'); 
         if (outputPath === 'index.html') editUrl = `${config.editLink.baseUrl.replace(/\/$/, '')}/index.md`;
         editLinkText = config.editLink.text || editLinkText;
    }

    const ejsData = {
        ...templateData,
        description: frontmatter.description || '',
        footerHtml, editUrl, editLinkText, isActivePage,
        defaultMode: config.theme?.defaultMode || 'light',
        logo: config.logo, sidebarConfig: config.sidebar || {}, theme: config.theme,
        customCssFiles: config.theme?.customCss || [], customJsFiles: config.customJs || [],
        sponsor: config.sponsor, footer: config.footer, renderIcon, themeInitScript,
        headings: frontmatter.toc !== false ? (headings || []) : [],
        ...pluginOutputs,
        isOfflineMode 
    };

    const rawHtml = renderHtmlPage(layoutTemplate, ejsData, layoutTemplatePath);
    const pkgVersion = require('../../package.json').version;
    const brandingComment = `<!-- Generated by docmd (v${pkgVersion}) - https://docmd.io -->\n`;
    
    // REMOVED: formatHtml(rawHtml)
    return brandingComment + cleanupHtml(rawHtml);
}

function renderHtmlPage(templateContent, ejsData, filename = 'template.ejs', options = {}) {
    try {
        return ejs.render(templateContent, ejsData, { filename: filename, ...options });
    } catch (e) {
        console.error(`❌ Error rendering EJS template: ${e.message}`);
        throw e;
    }
}

async function generateNavigationHtml(navItems, currentPagePath, relativePathToRoot, config, isOfflineMode = false) {
    const navTemplatePath = path.join(__dirname, '..', 'templates', 'navigation.ejs');
    if (!await fs.exists(navTemplatePath)) throw new Error(`Navigation template not found: ${navTemplatePath}`);
    const navTemplate = await fs.readFile(navTemplatePath, 'utf8');
    const safeRoot = relativePathToRoot || './';

    return ejs.render(navTemplate, { 
        navItems, currentPagePath, relativePathToRoot: safeRoot, config, isOfflineMode, renderIcon 
    }, { filename: navTemplatePath });
}

module.exports = { generateHtmlPage, generateNavigationHtml, renderHtmlPage };