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

/**
 * Semantic search client module.
 * Handles vector-based semantic search using docmd-search.
 */

export {};

declare global {
    interface Window {
        DOCMD_SITE_ROOT?: string;
        DOCMD_ROOT?: string;
    }
}

export interface SemanticSearchContext {
    siteBase: string;
    ROOT_PATH: string;
    searchResults: HTMLElement;
    strings: {
        initial: string;
        noResults: string;
        error: string;
    };
    activeVersionFilters: Set<string>;
    globalAllVersions: string[];
    globalVersionColors: Record<string, { bg: string; fg: string }>;
    selectedIndex: number;
    updateSelection: (items: NodeListOf<HTMLElement>) => void;
}

let semanticClient: any = null;

/**
 * Load the semantic search index and client.
 */
export async function loadSemanticIndex(ctx: SemanticSearchContext): Promise<boolean> {
    const semanticIndexBase = new URL('.docmd-search/', new URL(ctx.siteBase, window.location.href)).href;
    const clientUrl = new URL('.docmd-search-client.js', new URL(ctx.siteBase, window.location.href)).href;

    try {
        semanticClient = await import(/* @vite-ignore */ clientUrl);
    } catch {
        throw new Error('semantic-client-missing');
    }

    if (!semanticClient?.load || !semanticClient?.search) {
        throw new Error('semantic-client-invalid');
    }

    await semanticClient.load(semanticIndexBase, (loaded: number, total: number) => {
        if (loaded === total) {
            ctx.searchResults.innerHTML = `<div class="search-initial">Semantic search ready</div>`;
        } else {
            ctx.searchResults.innerHTML = `<div class="search-initial">Loading semantic index… (${loaded}/${total})</div>`;
        }
    });

    // Load versions.json for filter chips
    try {
        const versionsUrl = new URL('.docmd-search/versions.json', new URL(ctx.siteBase, window.location.href)).href;
        const vRes = await fetch(versionsUrl);
        if (vRes.ok) {
            const vData: Array<{ label: string; pathPrefix: string }> = await vRes.json();
            if (Array.isArray(vData) && vData.length > 0) {
                ctx.globalAllVersions.length = 0;
                ctx.globalAllVersions.push(...vData.map(v => v.label));
                // Store pathPrefix alongside label for filtering
                (ctx.globalVersionColors as any).__semanticVersions = vData;
                const huePresets = [210, 150, 30, 330, 270, 60, 180, 0];
                ctx.globalAllVersions.forEach((label, i) => {
                    const hue = huePresets[i % huePresets.length];
                    ctx.globalVersionColors[label] = { bg: `hsl(${hue}, 55%, 92%)`, fg: `hsl(${hue}, 60%, 35%)` };
                });
            }
        }
    } catch { /* version filters are optional */ }

    return true;
}

/**
 * Perform semantic search and render results.
 */
export function performSemanticSearch(query: string, ctx: SemanticSearchContext): void {
    if (!semanticClient) return;

    const rawResults = semanticClient.search(query, 10);

    // Filter by active version filters (if any)
    let filteredResults = rawResults;
    if (ctx.activeVersionFilters.size > 0) {
        const semanticVersions = (ctx.globalVersionColors as any).__semanticVersions || [];
        const labelToPrefixMap: Record<string, string> = {};
        for (const v of semanticVersions) {
            labelToPrefixMap[v.label] = v.pathPrefix;
        }
        filteredResults = rawResults.filter((result: any) => {
            const chunk = result.chunk;
            const file = chunk.file || '';
            for (const activeLabel of ctx.activeVersionFilters) {
                const prefix = labelToPrefixMap[activeLabel];
                if (prefix !== undefined && file.startsWith(prefix)) {
                    return true;
                }
            }
            return false;
        });
    }

    if (filteredResults.length === 0) {
        ctx.searchResults.innerHTML = `<div class="search-no-results">${ctx.activeVersionFilters.size > 0 ? 'No results match the selected filters.' : ctx.strings.noResults}</div>`;
        return;
    }

    ctx.searchResults.innerHTML = filteredResults.map((result: any, index: number) => {
        const chunk = result.chunk;
        const snippet = getSnippet(chunk.text, query);
        const rawFile = chunk.file || '/';

        // Convert markdown file path to HTML URL
        // en/index.md → / (for default locale) or en/ (for non-default)
        // en/getting-started/installation.md → getting-started/installation/
        let urlPath = rawFile.replace(/\.md$/, '').replace(/\/index$/, '/');
        if (!urlPath.endsWith('/')) urlPath += '/';

        // Strip locale prefix if it matches a known locale (source structure has locale dirs)
        // The output URL should not have locale prefix for default locale
        const firstSegment = urlPath.split('/')[0];
        // For now, assume first segment is locale if it's 2-3 chars
        if (firstSegment.length >= 2 && firstSegment.length <= 3) {
            urlPath = urlPath.replace(/^[a-z]{2,3}\//, '');
        }

        // Add anchor link if heading exists
        let anchor = '';
        if (chunk.heading) {
            anchor = '#' + chunk.heading.toLowerCase()
                .replace(/[^a-z0-9\s-]/g, '')
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');
        }

        const cleanId = urlPath.startsWith('/') ? urlPath.slice(1) : urlPath;
        const linkHref = `${ctx.ROOT_PATH}${cleanId}${anchor}`.replace(/([^:])\/\/+/g, '$1/');

        // Use heading as title if available, otherwise use file-based title
        const title = chunk.heading
            ? escapeHtml(chunk.heading)
            : escapeHtml(cleanFileToTitle(rawFile));

        // Determine which version this result belongs to for badge display
        let versionLabel = '';
        let versionColors = null;
        if (ctx.globalAllVersions.length > 0) {
            const semanticVersions = (ctx.globalVersionColors as any).__semanticVersions || [];
            for (const v of semanticVersions) {
                if (rawFile.startsWith(v.pathPrefix)) {
                    versionLabel = v.label;
                    versionColors = ctx.globalVersionColors[v.label];
                    break;
                }
            }
        }

        const versionBadge = versionLabel && versionColors
            ? `<span class="search-result-version" style="background:${versionColors.bg};color:${versionColors.fg}">${escapeHtml(versionLabel)}</span>`
            : '';

        return `
            <a href="${linkHref}" class="search-result-item" data-index="${index}">
                <div class="search-result-title">${title}${versionBadge}</div>
                <div class="search-result-preview">${snippet}</div>
            </a>`;
    }).join('');

    ctx.searchResults.querySelectorAll('.search-result-item').forEach((item, idx) => {
        item.addEventListener('mouseenter', () => {
            ctx.selectedIndex = idx;
            ctx.updateSelection(ctx.searchResults.querySelectorAll('.search-result-item') as NodeListOf<HTMLElement>);
        });
    });
}

function escapeHtml(str: any): string {
    const s = typeof str === 'string' ? str : String(str || '');
    return s.replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m] as string);
}

function cleanFileToTitle(file: string): string {
    const parts = file.replace(/\\/g, '/').replace(/\.md$/, '').split('/').filter(Boolean);
    const segment = (parts[parts.length - 1] === 'index' ? parts[parts.length - 2] : parts[parts.length - 1]) || file;
    return segment.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function getSnippet(text: string | undefined, query: string): string {
    if (!text) return '';
    const terms = query.split(/\s+/).filter(t => t.length > 2);
    let bestIndex = -1;
    for (const term of terms) {
        const idx = text.toLowerCase().indexOf(term.toLowerCase());
        if (idx >= 0) { bestIndex = idx; break; }
    }
    const start = Math.max(0, bestIndex - 60);
    const end = Math.min(text.length, bestIndex + 60);
    let snippet = text.substring(start, end);
    if (start > 0) snippet = '...' + snippet;
    if (end < text.length) snippet += '...';

    snippet = escapeHtml(snippet);

    const safeTerms = terms.map(t => escapeHtml(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    if (safeTerms) {
        snippet = snippet.replace(new RegExp(`(${safeTerms})`, 'gi'), '<mark>$1</mark>');
    }
    return snippet;
}