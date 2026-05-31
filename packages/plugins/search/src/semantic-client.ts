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
    showConfidence?: boolean;
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
        const safeLoaded = Math.max(0, parseInt(String(loaded), 10) || 0);
        const safeTotal = Math.max(0, parseInt(String(total), 10) || 0);
        
        clearElement(ctx.searchResults);
        const div = document.createElement('div');
        div.className = 'search-initial';
        div.textContent = (safeLoaded === safeTotal && safeTotal > 0)
            ? 'Semantic search ready...'
            : `Loading semantic index... (${safeLoaded}/${safeTotal})`;
        ctx.searchResults.appendChild(div);
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

/** Helper to resolve the correct version label for a given file path */
function resolveFileVersion(file: string, semanticVersions: Array<{ label: string; pathPrefix: string }>): string | null {
    // Sort prefixes by length in descending order to match longest prefix first
    const sorted = [...semanticVersions].sort((a, b) => b.pathPrefix.length - a.pathPrefix.length);
    for (const v of sorted) {
        if (v.pathPrefix && file.startsWith(v.pathPrefix)) {
            return v.label;
        }
    }
    // Fallback to empty prefix (current version) if present
    const current = semanticVersions.find(v => !v.pathPrefix);
    return current ? current.label : null;
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
        filteredResults = rawResults.filter((result: any) => {
            const chunk = result.chunk;
            const file = chunk.file || '';
            const verLabel = resolveFileVersion(file, semanticVersions);
            return verLabel && ctx.activeVersionFilters.has(verLabel);
        });
    }

    if (filteredResults.length === 0) {
        clearElement(ctx.searchResults);
        const div = document.createElement('div');
        div.className = 'search-no-results';
        div.textContent = ctx.activeVersionFilters.size > 0 
            ? 'No results match the selected filters.' 
            : ctx.strings.noResults;
        ctx.searchResults.appendChild(div);
        return;
    }

    clearElement(ctx.searchResults);
    
    filteredResults.forEach((result: any, index: number) => {
        const chunk = result.chunk;
        const rawFile = chunk.file || '/';

        // Convert markdown file path to HTML URL
        let urlPath = rawFile.replace(/\.md$/, '').replace(/\/index$/, '/');
        if (!urlPath.endsWith('/')) urlPath += '/';

        // Strip locale prefix if it matches a known locale (source structure has locale dirs)
        const firstSegment = urlPath.split('/')[0];
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
        const titleText = chunk.heading || cleanFileToTitle(rawFile);

        // Build DOM elements safely
        const link = document.createElement('a');
        link.href = linkHref;
        link.className = 'search-result-item';
        link.dataset.index = String(index);

        const titleDiv = document.createElement('div');
        titleDiv.className = 'search-result-title';
        titleDiv.textContent = titleText;

        // Right-side meta group: version pill + confidence badge
        // Always right-aligned via margin-left:auto on .search-result-meta
        const hasVersion = ctx.globalAllVersions.length > 0;
        const hasConfidence = ctx.showConfidence && typeof result.score === 'number';

        if (hasVersion || hasConfidence) {
            const metaDiv = document.createElement('div');
            metaDiv.className = 'search-result-meta';

            // Version pill
            if (hasVersion) {
                const semanticVersions = (ctx.globalVersionColors as any).__semanticVersions || [];
                const verLabel = resolveFileVersion(rawFile, semanticVersions);
                if (verLabel) {
                    const vc = ctx.globalVersionColors[verLabel];
                    if (vc) {
                        const badge = document.createElement('span');
                        badge.className = 'search-result-version';
                        badge.style.background = vc.bg;
                        badge.style.color = vc.fg;
                        badge.textContent = verLabel;
                        metaDiv.appendChild(badge);
                    }
                }
            }

            // Confidence badge — CSS classes, no inline styles
            if (hasConfidence) {
                const confidenceScore = Math.round(result.score * 100);
                const scoreBadge = document.createElement('span');
                scoreBadge.className = 'search-result-confidence' +
                    (confidenceScore >= 85 ? ' confidence-high' : '');
                scoreBadge.textContent = `${confidenceScore}%`;
                metaDiv.appendChild(scoreBadge);
            }

            titleDiv.appendChild(metaDiv);
        }


        const previewDiv = document.createElement('div');
        previewDiv.className = 'search-result-preview';
        previewDiv.appendChild(buildSnippetFragment(chunk.text, query));

        link.appendChild(titleDiv);
        link.appendChild(previewDiv);
        ctx.searchResults.appendChild(link);

        link.addEventListener('mouseenter', () => {
            ctx.selectedIndex = index;
            ctx.updateSelection(ctx.searchResults.querySelectorAll('.search-result-item') as NodeListOf<HTMLElement>);
        });
    });
}

/** Remove all child nodes from an element. */
function clearElement(el: HTMLElement): void {
    while (el.firstChild) el.removeChild(el.firstChild);
}

function cleanFileToTitle(file: string): string {
    const parts = file.replace(/\\/g, '/').replace(/\.md$/, '').split('/').filter(Boolean);
    const segment = (parts[parts.length - 1] === 'index' ? parts[parts.length - 2] : parts[parts.length - 1]) || file;
    return segment.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Build a DocumentFragment for a text snippet with <mark> highlights.
 * No innerHTML — all text inserted via textContent, marks via createElement.
 */
function buildSnippetFragment(text: string | undefined, query: string): DocumentFragment {
    const frag = document.createDocumentFragment();
    if (!text) return frag;

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

    if (terms.length === 0) {
        frag.appendChild(document.createTextNode(snippet));
        return frag;
    }

    // Split snippet by matching terms and wrap matches in <mark>
    const pattern = new RegExp(`(${terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
    const parts = snippet.split(pattern);

    for (const part of parts) {
        if (pattern.test(part)) {
            pattern.lastIndex = 0; // reset after test
            const mark = document.createElement('mark');
            mark.textContent = part;
            frag.appendChild(mark);
        } else {
            pattern.lastIndex = 0;
            frag.appendChild(document.createTextNode(part));
        }
    }

    return frag;
}