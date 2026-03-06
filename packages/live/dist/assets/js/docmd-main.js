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

/**
 * --------------------------------------------------------------------
 * docmd : Client-Side Application Logic (SPA Router & UI)
 * --------------------------------------------------------------------
 */

(function () {

  // 1. EVENT DELEGATION
  document.addEventListener('click', (e) => {
    // Collapsible Navigation
    const navLabel = e.target.closest('.nav-label, .collapse-icon-wrapper');
    if (navLabel) {
      const item = navLabel.closest('li.collapsible');
      if (item) {
        e.preventDefault();
        const isExpanded = item.classList.contains('expanded');
        item.classList.toggle('expanded', !isExpanded);
        item.setAttribute('aria-expanded', !isExpanded);
      }
      if (navLabel.classList.contains('collapse-icon-wrapper')) return;
    }

    // Toggles
    if (e.target.closest('.toc-menu-button, .toc-title')) {
      document.querySelector('.toc-container')?.classList.toggle('mobile-expanded');
    }
    if (e.target.closest('.sidebar-menu-button')) {
      document.querySelector('.sidebar')?.classList.toggle('mobile-expanded');
    }
    if (e.target.closest('#sidebar-toggle-button')) {
      document.body.classList.toggle('sidebar-collapsed');
      localStorage.setItem('docmd-sidebar-collapsed', document.body.classList.contains('sidebar-collapsed'));
    }

    // Tabs System
    const tabItem = e.target.closest('.docmd-tabs-nav-item');
    if (tabItem) {
      const tabsContainer = tabItem.closest('.docmd-tabs');
      const navItems = Array.from(tabsContainer.querySelectorAll('.docmd-tabs-nav-item'));
      const tabPanes = Array.from(tabsContainer.querySelectorAll('.docmd-tab-pane'));
      const index = navItems.indexOf(tabItem);

      navItems.forEach(item => item.classList.remove('active'));
      tabPanes.forEach(pane => pane.classList.remove('active'));

      tabItem.classList.add('active');
      if (tabPanes[index]) tabPanes[index].classList.add('active');
    }

    // Version Dropdown Toggle
    const versionToggle = e.target.closest('.version-dropdown-toggle');
    if (versionToggle) {
      e.preventDefault();
      const dropdown = versionToggle.closest('.docmd-version-dropdown');
      dropdown.classList.toggle('open');
      versionToggle.setAttribute('aria-expanded', dropdown.classList.contains('open'));
      return;
    }

    // Sticky Version Switching (Path Preservation)
    const versionLink = e.target.closest('.version-dropdown-item');
    if (versionLink) {
      const targetRoot = versionLink.dataset.versionRoot;
      // Use global fallback if undefined (e.g. on 404 pages)
      const currentRoot = window.DOCMD_VERSION_ROOT || '/';

      if (targetRoot && window.location.pathname) {
        try {
          let currentPath = window.location.pathname;
          const normCurrentRoot = currentRoot.endsWith('/') ? currentRoot : currentRoot + '/';

          // Only try sticky if we are actually INSIDE the known version path
          if (currentPath.startsWith(normCurrentRoot)) {
            e.preventDefault();
            const suffix = currentPath.substring(normCurrentRoot.length);
            const normTargetRoot = targetRoot.endsWith('/') ? targetRoot : targetRoot + '/';
            window.location.href = normTargetRoot + suffix + window.location.hash;
            return;
          }
        } catch (e) {
          // Ignore errors, let default click happen
        }
      }
      // If sticky logic skipped (e.g. on 404 page or outside root), default <a> click handles it
    }

    // Close Dropdown if clicked outside
    if (!e.target.closest('.docmd-version-dropdown')) {
      document.querySelectorAll('.docmd-version-dropdown.open').forEach(d => {
        d.classList.remove('open');
        d.querySelector('.version-dropdown-toggle').setAttribute('aria-expanded', 'false');
      });
    }

    // Copy Code Button
    const copyBtn = e.target.closest('.copy-code-button');
    if (copyBtn) {
      const code = copyBtn.closest('.code-wrapper')?.querySelector('code');
      if (code) {
        navigator.clipboard.writeText(code.innerText).then(() => {
          copyBtn.classList.add('copied');
          copyBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
          setTimeout(() => {
            copyBtn.classList.remove('copied');
            copyBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-copy"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg>`;
          }, 2000);
        });
      }
    }
  });

  // 2. COMPONENT INITIALIZERS
  function injectCopyButtons() {
    if (document.body.dataset.copyCodeEnabled !== 'true') return;
    const svg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-copy"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg>`;

    document.querySelectorAll('pre').forEach(preElement => {
      if (preElement.closest('.code-wrapper')) return;
      const wrapper = document.createElement('div');
      wrapper.className = 'code-wrapper';
      wrapper.style.position = 'relative';
      preElement.parentNode.insertBefore(wrapper, preElement);
      wrapper.appendChild(preElement);

      const copyButton = document.createElement('button');
      copyButton.className = 'copy-code-button';
      copyButton.innerHTML = svg;
      wrapper.appendChild(copyButton);
    });
  }

  let scrollObserver = null;
  function initializeScrollSpy() {
    if (scrollObserver) scrollObserver.disconnect();
    const tocLinks = document.querySelectorAll('.toc-link');
    const headings = document.querySelectorAll('.main-content h2, .main-content h3, .main-content h4');
    const tocContainer = document.querySelector('.toc-list');

    if (tocLinks.length === 0 || headings.length === 0) return;

    scrollObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          tocLinks.forEach(link => link.classList.remove('active'));
          const id = entry.target.getAttribute('id');
          const activeLink = document.querySelector(`.toc-link[href="#${id}"]`);

          if (activeLink) {
            activeLink.classList.add('active');
            if (tocContainer) {
              const linkRect = activeLink.getBoundingClientRect();
              const containerRect = tocContainer.getBoundingClientRect();
              if (linkRect.bottom > containerRect.bottom || linkRect.top < containerRect.top) {
                tocContainer.scrollTo({ top: activeLink.offsetTop - (containerRect.height / 2) + (linkRect.height / 2), behavior: 'smooth' });
              }
            }
          }
        }
      });
    }, { rootMargin: '-15% 0px -80% 0px', threshold: 0 });

    headings.forEach(h => scrollObserver.observe(h));
  }

  function executeScripts(container) {
    container.querySelectorAll('script').forEach(oldScript => {
      const newScript = document.createElement('script');
      Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
      newScript.text = oldScript.innerHTML;
      oldScript.parentNode.replaceChild(newScript, oldScript);
    });
  }

  // 3. TARGETED SPA ROUTER
  function initializeSPA() {
    if (location.protocol === 'file:') return;
    if (document.body.dataset.spaEnabled !== 'true') return;

    let currentPath = window.location.pathname;
    const pageCache = new Map();
    let prefetchTimer = null;

    // Intent-based Hover Prefetching
    document.addEventListener('mouseover', (e) => {
      const link = e.target.closest('.sidebar-nav a, .page-navigation a, .page-footer a, .main-content a');
      if (!link || link.target === '_blank' || link.hasAttribute('download')) return;

      const url = new URL(link.href).href;
      if (new URL(url).origin !== location.origin) return;
      if (pageCache.has(url)) return;

      // Wait 65ms to ensure the user actually intends to click
      clearTimeout(prefetchTimer);
      prefetchTimer = setTimeout(() => {
        pageCache.set(url, fetch(url).then(res => {
          if (!res.ok) throw new Error('Prefetch failed');
          return { html: res.text(), finalUrl: res.url };
        }).catch(() => pageCache.delete(url)));
      }, 65);
    });

    // Cancel prefetch if the mouse leaves before the 65ms "intent" delay
    document.addEventListener('mouseout', () => clearTimeout(prefetchTimer));

    document.addEventListener('click', async (e) => {
      if (e.target.closest('.collapse-icon-wrapper')) return;

      if (e.target.closest('[data-spa-ignore]')) return;

      const link = e.target.closest('.sidebar-nav a, .page-navigation a, .page-footer a, .main-content a');
      if (!link || link.target === '_blank' || link.hasAttribute('download')) return;

      const url = new URL(link.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === window.location.pathname && url.hash) return;

      e.preventDefault();
      await navigateTo(url.href);
    });

    window.addEventListener('popstate', () => {
      if (window.location.pathname === currentPath) return;
      navigateTo(window.location.href, false);
    });

    async function navigateTo(url, pushHistory = true) {
      const layout = document.querySelector('.content-layout');

      try {
        if (layout) layout.style.minHeight = layout.getBoundingClientRect().height + 'px';

        let data;
        if (pageCache.has(url)) {
          data = await pageCache.get(url);
          data.html = await data.html;
        } else {
          const res = await fetch(url);
          if (!res.ok) throw new Error('Fetch failed');
          data = { html: await res.text(), finalUrl: res.url };
          pageCache.set(url, Promise.resolve(data));
        }

        const finalUrl = data.finalUrl;
        const html = data.html;

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        if (pushHistory) history.pushState({}, '', finalUrl);
        currentPath = new URL(finalUrl).pathname;
        document.title = doc.title;

        // Sync Assets
        const assetSelectors = 'link[rel="stylesheet"], link[rel="icon"], link[rel="shortcut icon"]';
        const oldAssets = Array.from(document.head.querySelectorAll(assetSelectors));
        const newAssets = Array.from(doc.head.querySelectorAll(assetSelectors));

        newAssets.forEach((newAsset, index) => {
          if (oldAssets[index]) {
            if (oldAssets[index].getAttribute('href') !== newAsset.getAttribute('href')) {
              oldAssets[index].setAttribute('href', newAsset.getAttribute('href'));
            }
          } else {
            document.head.appendChild(newAsset.cloneNode(true));
          }
        });

        // Sync Sidebar State
        const oldLis = Array.from(document.querySelectorAll('.sidebar-nav li'));
        const newLis = Array.from(doc.querySelectorAll('.sidebar-nav li'));

        oldLis.forEach((oldLi, i) => {
          const newLi = newLis[i];
          if (newLi) {
            oldLi.classList.toggle('active', newLi.classList.contains('active'));
            oldLi.classList.toggle('active-parent', newLi.classList.contains('active-parent'));

            if (newLi.classList.contains('expanded')) {
              oldLi.classList.add('expanded');
              oldLi.setAttribute('aria-expanded', 'true');
            }

            const oldA = oldLi.querySelector('a');
            const newA = newLi.querySelector('a');
            if (oldA && newA) {
              oldA.setAttribute('href', newA.getAttribute('href'));
              oldA.classList.toggle('active', newA.classList.contains('active'));
            }
          }
        });

        const selectorsToSwap = [
          '.content-layout',
          '.page-header .header-title',
          '.page-footer',
          '.footer-complete',
          '.page-footer-actions'
        ];

        selectorsToSwap.forEach(selector => {
          const oldEl = document.querySelector(selector);
          const newEl = doc.querySelector(selector);
          if (oldEl && newEl) oldEl.innerHTML = newEl.innerHTML;
        });

        const hash = new URL(finalUrl).hash;
        if (hash) {
          try {
            document.querySelector(hash)?.scrollIntoView();
          } catch (e) {
            document.getElementById(hash.substring(1))?.scrollIntoView();
          }
        } else {
          window.scrollTo(0, 0);
        }

        injectCopyButtons();
        initializeScrollSpy();
        const newMainContent = document.querySelector('.main-content');
        if (newMainContent) executeScripts(newMainContent);

        document.dispatchEvent(new CustomEvent('docmd:page-mounted', { detail: { url: finalUrl } }));

        setTimeout(() => {
          const newLayout = document.querySelector('.content-layout');
          if (newLayout) newLayout.style.minHeight = '';
        }, 100);

      } catch (e) {
        window.location.assign(url);
      }
    }
  }

  // 4. BOOTSTRAP
  document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('docmd-sidebar-collapsed') === 'true') {
      document.body.classList.add('sidebar-collapsed');
    }

    document.querySelectorAll('.theme-toggle-button').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', t);
        document.body.setAttribute('data-theme', t);
        localStorage.setItem('docmd-theme', t);

        const lightLink = document.getElementById('hljs-light');
        const darkLink = document.getElementById('hljs-dark');
        if (lightLink && darkLink) {
          lightLink.disabled = t === 'dark';
          darkLink.disabled = t === 'light';
        }
      });
    });

    injectCopyButtons();
    initializeScrollSpy();
    initializeSPA();

    setTimeout(() => {
      // PWA Unregistration Safety Net:
      // If the PWA plugin is removed from docmd.config.js, the <link rel="manifest"> disappears.
      // We explicitly unregister all ghost service workers to safely kill the offline cache.
      if ('serviceWorker' in navigator && !document.querySelector('link[rel="manifest"]')) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
          registrations.forEach(reg => reg.unregister().catch(() => { }));
        });
      }

      const activeNav = document.querySelector('.sidebar-nav a.active');
      const sidebarNav = document.querySelector('.sidebar-nav');
      if (activeNav && sidebarNav) {
        sidebarNav.scrollTo({ top: activeNav.offsetTop - (sidebarNav.clientHeight / 2), behavior: 'instant' });
      }
      if (window.location.hash) {
        try {
          document.querySelector(window.location.hash)?.scrollIntoView();
        } catch (e) {
          document.getElementById(window.location.hash.substring(1))?.scrollIntoView();
        }
      }
    }, 100);
  });

})();