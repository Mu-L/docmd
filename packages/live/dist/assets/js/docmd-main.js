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

(function() {
  // =========================================================================
  // 1. EVENT DELEGATION
  // =========================================================================
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

  // =========================================================================
  // 2. COMPONENT INITIALIZERS
  // =========================================================================
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

// =========================================================================
  // 3. TARGETED SPA ROUTER
  // =========================================================================
  function initializeSPA() {
    if (location.protocol === 'file:') return;
    if (document.body.dataset.spaEnabled !== 'true') return;

    let currentPath = window.location.pathname;

    document.addEventListener('click', async (e) => {

      if (e.target.closest('.collapse-icon-wrapper')) return;

      const link = e.target.closest('.sidebar-nav a, .page-navigation a');
      if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
      
      const url = new URL(link.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === window.location.pathname && url.hash) return;
      
      e.preventDefault();
      await navigateTo(url.href);
    });

    // Handle Back/Forward browser buttons & TOC Hash clicks
    window.addEventListener('popstate', () => {
      // If the path is identical, it means ONLY the #hash changed. Do not reload!
      if (window.location.pathname === currentPath) return;
      
      navigateTo(window.location.href, false);
    });

    async function navigateTo(url, pushHistory = true) {
      const mainContentWrapper = document.querySelector('.main-content-wrapper');
      
      try {
        if (mainContentWrapper) mainContentWrapper.style.opacity = '0.5';
        
        const res = await fetch(url);
        if (!res.ok) throw new Error('Fetch failed');
        const finalUrl = res.url;
        const html = await res.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // 1. UPDATE URL FIRST
        if (pushHistory) history.pushState({}, '', finalUrl);
        currentPath = new URL(finalUrl).pathname;
        document.title = doc.title;

        // 2. SAFELY SYNC HEAD ASSETS (Favicon & CSS)
        const assetSelectors = 'link[rel="stylesheet"], link[rel="icon"], link[rel="shortcut icon"]';
        const oldAssets = Array.from(document.head.querySelectorAll(assetSelectors));
        const newAssets = Array.from(doc.head.querySelectorAll(assetSelectors));

        newAssets.forEach((newAsset, index) => {
            if (oldAssets[index]) {
                // Only update if the relative path actually changed
                if (oldAssets[index].getAttribute('href') !== newAsset.getAttribute('href')) {
                    oldAssets[index].setAttribute('href', newAsset.getAttribute('href'));
                }
            } else {
                document.head.appendChild(newAsset.cloneNode(true));
            }
        });

        // 3. MEMORIZE SIDEBAR STATE
        const openMenus = new Set();
        document.querySelectorAll('.sidebar-nav li.collapsible.expanded > .nav-label .nav-item-title, .sidebar-nav li.collapsible.expanded > a .nav-item-title').forEach(el => {
            openMenus.add(el.textContent.trim());
        });
        
        // 4. SWAP BODY COMPONENTS
        const selectorsToSwap =[
          '.main-content', '.toc-sidebar', '.sidebar-nav', 
          '.page-header .header-title', '.page-footer', '.footer-complete',
          '.page-footer-actions'
        ];

        selectorsToSwap.forEach(selector => {
            const oldEl = document.querySelector(selector);
            const newEl = doc.querySelector(selector);
            if (oldEl && newEl) oldEl.innerHTML = newEl.innerHTML;
        });

        // 5. RESTORE SIDEBAR STATE
        document.querySelectorAll('.sidebar-nav li.collapsible').forEach(li => {
            const title = li.querySelector('.nav-item-title')?.textContent.trim();
            if (openMenus.has(title)) {
                li.classList.add('expanded');
                li.setAttribute('aria-expanded', 'true');
            }
        });

        // 6. SCROLL & RE-INIT
        const hash = new URL(finalUrl).hash;
        if (hash) {
            document.querySelector(hash)?.scrollIntoView();
        } else {
            if (mainContentWrapper) mainContentWrapper.scrollTo(0, 0);
            window.scrollTo(0, 0);
        }

        if (mainContentWrapper) mainContentWrapper.style.opacity = '1';
        injectCopyButtons();
        initializeScrollSpy();
        
        const newMainContent = document.querySelector('.main-content');
        if (newMainContent) executeScripts(newMainContent);

        document.dispatchEvent(new CustomEvent('docmd:page-mounted', { detail: { url: finalUrl } }));

      } catch(e) {
        window.location.assign(url);
      }
    }
  }

  // =========================================================================
  // 4. BOOTSTRAP
  // =========================================================================
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
        
        // Highlight.js CSS swap
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
    
    // Auto-scroll sidebar safely
    setTimeout(() => {
        const activeNav = document.querySelector('.sidebar-nav a.active');
        const sidebarNav = document.querySelector('.sidebar-nav');
        if (activeNav && sidebarNav) {
            // Calculate scroll top safely instead of scrollIntoView which causes page jump
            sidebarNav.scrollTo({ top: activeNav.offsetTop - (sidebarNav.clientHeight / 2), behavior: 'instant' });
        }
        
        // Ensure Hash anchors work on direct link visits (New Tab)
        if (window.location.hash) {
            const el = document.querySelector(window.location.hash);
            if (el) el.scrollIntoView();
        }
    }, 100);
  });

})();