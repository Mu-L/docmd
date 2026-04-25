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

export {};

declare global {
    interface Window {
        DOCMD_SITE_ROOT?: string;
        DOCMD_ROOT?: string;
        lastFocusedElement?: HTMLElement | null;
        closeDocmdSearch?: () => void;
    }
}
declare const MiniSearch: any;

(function () {
    let miniSearch: any = null;
    let isIndexLoaded = false;
    let selectedIndex = -1;
    let activeVersionFilters = new Set<string>();

    function initSearch() {
        const searchModal = document.getElementById('docmd-search-modal') as HTMLElement;
        const searchInput = document.getElementById('docmd-search-input') as HTMLInputElement;
        const searchResults = document.getElementById('docmd-search-results') as HTMLElement;

        if (!searchModal || !searchInput || !searchResults) return;

        // Read translated strings from data attributes (injected server-side per locale)
        const strings = {
            initial: searchModal.dataset.searchInitial || 'Type to start searching...',
            noResults: searchModal.dataset.searchNoResults || 'No results found.',
            error: searchModal.dataset.searchError || 'Failed to load search index.'
        };

        // Use Site Root if available (for versioning), fallback to Context Root
        const rawRoot = window.DOCMD_SITE_ROOT || window.DOCMD_ROOT || './';
        let ROOT_PATH = new URL(rawRoot, window.location.href).href;
        if (!ROOT_PATH.endsWith('/')) ROOT_PATH += '/';

        // Determine the locale-specific search index path.
        // The index lives alongside the locale's HTML files:
        //   default locale: /search-index.json
        //   non-default:    /hi/search-index.json
        // Since ROOT_PATH already resolves to the correct locale root
        // (e.g. https://docs.example.com/ or https://docs.example.com/hi/),
        // we can simply append search-index.json to it.
        // However, we need to detect our locale prefix from the current URL
        // and build the fetch path relative to the site base.
        const siteBase = (window.DOCMD_SITE_ROOT || window.DOCMD_ROOT || '/').replace(/\/$/, '') + '/';
        const currentPath = window.location.pathname;
        
        // Extract locale prefix from current URL path
        // If URL is /hi/content/steps and base is /, locale prefix is "hi/"
        const pathAfterBase = currentPath.startsWith(siteBase) 
            ? currentPath.slice(siteBase.length) 
            : currentPath.replace(/^\//, '');
        const firstSegment = pathAfterBase.split('/')[0];
        
        // Check if the first segment looks like a locale (2-3 letter code)
        // by checking the meta tag that the engine injects
        const hreflangLinks = document.querySelectorAll('link[hreflang]');
        const knownLocales = new Set<string>();
        hreflangLinks.forEach(link => {
            const lang = link.getAttribute('hreflang');
            if (lang && lang !== 'x-default') knownLocales.add(lang);
        });
        
        const localePrefix = knownLocales.has(firstSegment) ? firstSegment + '/' : '';
        const baseUrl = new URL(siteBase, window.location.href).href;
        const searchIndexUrl = baseUrl + localePrefix + 'search-index.json';

        const emptyStateHtml = `<div class="search-initial">${strings.initial}</div>`;

        // 1. Open/Close Logic
        function openSearch() {
            searchModal.style.display = 'flex';
            window.lastFocusedElement = document.activeElement as HTMLElement | null;
            setTimeout(() => searchInput.focus(), 50);

            if (!searchInput.value.trim()) {
                searchResults.innerHTML = emptyStateHtml;
                selectedIndex = -1;
            }
            if (!isIndexLoaded) loadIndex();
        }

        function closeSearch() {
            searchModal.style.display = 'none';
            if (window.lastFocusedElement) window.lastFocusedElement.focus();
            selectedIndex = -1;
        }

        // --- Event Delegation for Triggers (Survives SPA) ---
        document.addEventListener('click', (e) => {
            const target = e.target as HTMLElement | null;
            if (target?.closest('.docmd-search-trigger')) {
                e.preventDefault();
                openSearch();
            }
            if (target === searchModal || target?.closest('.docmd-search-close')) {
                closeSearch();
            }
        });

        // 2. Keyboard Navigation
        document.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                searchModal.style.display === 'flex' ? closeSearch() : openSearch();
            }

            if (searchModal.style.display === 'flex') {
                const items = searchResults.querySelectorAll('.search-result-item') as NodeListOf<HTMLElement>;
                if (e.key === 'Escape') { e.preventDefault(); closeSearch(); }
                else if (e.key === 'ArrowDown') { e.preventDefault(); if (items.length) { selectedIndex = (selectedIndex + 1) % items.length; updateSelection(items); } }
                else if (e.key === 'ArrowUp') { e.preventDefault(); if (items.length) { selectedIndex = (selectedIndex - 1 + items.length) % items.length; updateSelection(items); } }
                else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (selectedIndex >= 0 && items[selectedIndex]) items[selectedIndex].click();
                    else if (items.length > 0) items[0].click();
                }
            }
        });

        function updateSelection(items: NodeListOf<HTMLElement>) {
            items.forEach((item, idx) => {
                item.classList.toggle('selected', idx === selectedIndex);
                if (idx === selectedIndex) item.scrollIntoView({ block: 'nearest' });
            });
        }

        // 3. Index Loading — fetches locale-specific index
        async function loadIndex() {
            try {
                const response = await fetch(searchIndexUrl);
                if (response.headers.get("content-type")?.includes("text/html")) throw new Error("Invalid content type");
                if (!response.ok) throw new Error(String(response.status));

                const jsonString = await response.text();
                miniSearch = MiniSearch.loadJSON(jsonString, {
                    fields: ['title', 'headings', 'text'],
                    storeFields: ['title', 'id', 'text', 'version'],
                    searchOptions: { fuzzy: 0.2, prefix: true, boost: { title: 2, headings: 1.5 } }
                });
                isIndexLoaded = true;
                if (searchInput.value.trim()) searchInput.dispatchEvent(new Event('input'));
            } catch {
                searchResults.innerHTML = `<div class="search-error">${strings.error}</div>`;
            }
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

            const safeTerms = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
            if (safeTerms) {
                snippet = snippet.replace(new RegExp(`(${safeTerms})`, 'gi'), '<mark>$1</mark>');
            }
            return snippet;
        }

        searchInput.addEventListener('input', (e) => {
            const query = (e.target as HTMLInputElement).value.trim();
            selectedIndex = -1;
            if (!query) { 
                searchResults.innerHTML = emptyStateHtml; 
                activeVersionFilters.clear();
                return; 
            }
            if (!isIndexLoaded) return;

            const results = miniSearch.search(query);
            if (results.length === 0) {
                searchResults.innerHTML = `<div class="search-no-results">${strings.noResults}</div>`;
                return;
            }

            // Generate deterministic colors for version badges
            const versionColors: Record<string, {bg: string, fg: string}> = {};
            const huePresets = [210, 150, 30, 330, 270, 60, 180, 0];
            const allVersions: string[] = [...new Set(results.map((r: any) => r.version).filter(Boolean))] as string[];
            
            // Clean up active filters that are no longer in the results
            activeVersionFilters.forEach(v => {
                if (!allVersions.includes(v)) activeVersionFilters.delete(v);
            });

            allVersions.forEach((v, i) => {
                const hue = huePresets[i % huePresets.length];
                versionColors[v] = { bg: `hsl(${hue}, 55%, 92%)`, fg: `hsl(${hue}, 60%, 35%)` };
            });

            let filteredResults = results;
            if (activeVersionFilters.size > 0) {
                filteredResults = results.filter((r: any) => activeVersionFilters.has(r.version));
            }

            let filtersHtml = '';
            if (allVersions.length > 0) {
                filtersHtml = `<div class="search-filters" style="margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--docmd-border);">` + allVersions.map(v => {
                    const vc = versionColors[v];
                    const isActive = activeVersionFilters.has(v);
                    const icon = isActive 
                        ? `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>` 
                        : `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>`;
                    return `<span class="search-filter-tag ${isActive ? 'active' : ''}" data-version="${v}" style="background:${vc.bg};color:${vc.fg};cursor:pointer;display:inline-flex;align-items:center;gap:4px;padding:4px 8px;border-radius:12px;font-size:11px;margin-right:6px;border: 1px solid ${isActive ? vc.fg : 'transparent'}; opacity: ${activeVersionFilters.size > 0 && !isActive ? '0.6' : '1'}; transition: all 0.2s;">
                        ${icon} ${v}
                    </span>`;
                }).join('') + `</div>`;
            }

            const resultsHtml = filteredResults.slice(0, 10).map((result: any, index: number) => {
                const snippet = getSnippet(result.text, query);
                const linkHref = `${ROOT_PATH}${result.id}`;
                const vc = result.version ? versionColors[result.version] : null;
                const versionBadge = result.version
                    ? `<span class="search-result-version" style="background:${vc!.bg};color:${vc!.fg}">${result.version}</span>`
                    : '';
                return `
                    <a href="${linkHref}" class="search-result-item" data-index="${index}">
                        <div class="search-result-title">${result.title}${versionBadge}</div>
                        <div class="search-result-preview">${snippet}</div>
                    </a>`;
            }).join('');

            searchResults.innerHTML = filtersHtml + (resultsHtml || `<div class="search-no-results">No results match the selected filters.</div>`);

            searchResults.querySelectorAll('.search-filter-tag').forEach(tag => {
                tag.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const v = (tag as HTMLElement).dataset.version!;
                    if (activeVersionFilters.has(v)) {
                        activeVersionFilters.delete(v);
                    } else {
                        activeVersionFilters.add(v);
                    }
                    // Re-render with same query
                    searchInput.dispatchEvent(new Event('input'));
                });
            });

            searchResults.querySelectorAll('.search-result-item').forEach((item, idx) => {
                item.addEventListener('mouseenter', () => { selectedIndex = idx; updateSelection(searchResults.querySelectorAll('.search-result-item') as NodeListOf<HTMLElement>); });
            });
        });

        // Close search when clicking a link (Important for SPA!)
        searchResults.addEventListener('click', (e) => {
            if ((e.target as HTMLElement).closest('.search-result-item')) closeSearch();
        });

        window.closeDocmdSearch = closeSearch;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSearch);
    } else {
        initSearch();
    }
})();