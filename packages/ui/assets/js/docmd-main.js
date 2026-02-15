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

/* 
 * Main client-side script for docmd UI interactions
 */

// --- Collapsible Navigation Logic ---
function initializeCollapsibleNav() {
  const nav = document.querySelector('.sidebar-nav');
  if (!nav) return;

  // 1. Initial Cleanup (ensure classes match aria states)
  nav.querySelectorAll('li.collapsible').forEach(item => {
      // If server rendered it as expanded, ensure aria matches
      if (item.classList.contains('expanded')) {
          item.setAttribute('aria-expanded', 'true');
      } else {
          item.setAttribute('aria-expanded', 'false');
      }
  });

  // 2. Event Delegation
  nav.addEventListener('click', (e) => {
    // Check if the click target is the arrow or inside the arrow wrapper
    const arrow = e.target.closest('.collapse-icon-wrapper');
    
    if (arrow) {
      // STOP everything. Do not follow the link.
      e.preventDefault();
      e.stopPropagation();

      const item = arrow.closest('li.collapsible');
      if (item) {
        // Toggle State
        const isExpanded = item.classList.contains('expanded');
        
        if (isExpanded) {
            item.classList.remove('expanded');
            item.setAttribute('aria-expanded', 'false');
        } else {
            item.classList.add('expanded');
            item.setAttribute('aria-expanded', 'true');
        }
      }
      return false;
    }
  });
}

// --- Mobile Menu Logic ---
function initializeMobileMenus() {
  const sidebarBtn = document.querySelector('.sidebar-menu-button');
  const sidebar = document.querySelector('.sidebar');
  
  if (sidebarBtn && sidebar) {
    sidebarBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      sidebar.classList.toggle('mobile-expanded');
    });
  }

  const tocBtn = document.querySelector('.toc-menu-button');
  const tocContainer = document.querySelector('.toc-container');
  const tocTitle = document.querySelector('.toc-title');

  const toggleToc = (e) => {
    if (window.getComputedStyle(tocBtn).display === 'none') return;
    e.stopPropagation();
    tocContainer.classList.toggle('mobile-expanded');
  };

  if (tocBtn && tocContainer) {
    tocBtn.addEventListener('click', toggleToc);
    if (tocTitle) tocTitle.addEventListener('click', toggleToc);
  }
}

// --- Sidebar Scroll Preservation (Instant Center) ---
function initializeSidebarScroll() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;

  // Wait for the layout to be stable
  requestAnimationFrame(() => {
    // Find the active link
    const activeElement = sidebar.querySelector('a.active');

    if (activeElement) {
      activeElement.scrollIntoView({
        behavior: 'auto', // INSTANT jump (prevents scrolling animation jitter)
        block: 'center',  // Center it vertically in the sidebar
        inline: 'nearest'
      });
    }
  });
}

// --- Theme Toggle Logic ---
function setupThemeToggleListener() {
  const toggleButtons = document.querySelectorAll('.theme-toggle-button');

  function applyTheme(theme) {
    const validThemes = ['light', 'dark'];
    const selectedTheme = validThemes.includes(theme) ? theme : 'light';

    // 1. Update DOM & Storage
    document.documentElement.setAttribute('data-theme', selectedTheme);
    document.body.setAttribute('data-theme', selectedTheme);
    localStorage.setItem('docmd-theme', selectedTheme);

    // 2. Toggle Highlight.js Stylesheets
    const lightLink = document.getElementById('hljs-light');
    const darkLink = document.getElementById('hljs-dark');

    if (lightLink && darkLink) {
        if (selectedTheme === 'dark') {
            lightLink.disabled = true;
            darkLink.disabled = false;
        } else {
            lightLink.disabled = false;
            darkLink.disabled = true;
        }
    }
  }

  toggleButtons.forEach(btn => {
    // Clone button to remove old listeners if any (safety measure)
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    
    newBtn.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      applyTheme(newTheme);
    });
  });
}

// --- Sidebar Collapse Logic ---
function initializeSidebarToggle() {
  const toggleButton = document.getElementById('sidebar-toggle-button');
  const body = document.body;

  if (!body.classList.contains('sidebar-collapsible') || !toggleButton) return;

  const defaultConfigCollapsed = body.dataset.defaultCollapsed === 'true';
  let isCollapsed = localStorage.getItem('docmd-sidebar-collapsed');

  if (isCollapsed === null) isCollapsed = defaultConfigCollapsed;
  else isCollapsed = isCollapsed === 'true';

  if (isCollapsed) body.classList.add('sidebar-collapsed');

  toggleButton.addEventListener('click', () => {
    body.classList.toggle('sidebar-collapsed');
    const currentlyCollapsed = body.classList.contains('sidebar-collapsed');
    localStorage.setItem('docmd-sidebar-collapsed', currentlyCollapsed);
  });
}

// --- Tabs Container Logic ---
function initializeTabs() {
  document.querySelectorAll('.docmd-tabs').forEach(tabsContainer => {
    const navItems = tabsContainer.querySelectorAll('.docmd-tabs-nav-item');
    const tabPanes = tabsContainer.querySelectorAll('.docmd-tab-pane');

    navItems.forEach((navItem, index) => {
      navItem.addEventListener('click', () => {
        navItems.forEach(item => item.classList.remove('active'));
        tabPanes.forEach(pane => pane.classList.remove('active'));

        navItem.classList.add('active');
        if (tabPanes[index]) tabPanes[index].classList.add('active');
      });
    });
  });
}

// --- Copy Code Button Logic ---
function initializeCopyCodeButtons() {
  if (document.body.dataset.copyCodeEnabled !== 'true') return;

  const copyIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-copy"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg>`;
  const checkIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

  document.querySelectorAll('pre').forEach(preElement => {
    const codeElement = preElement.querySelector('code');
    if (!codeElement) return;

    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.style.display = 'block';

    preElement.parentNode.insertBefore(wrapper, preElement);
    wrapper.appendChild(preElement);
    preElement.style.position = 'static';

    const copyButton = document.createElement('button');
    copyButton.className = 'copy-code-button';
    copyButton.innerHTML = copyIconSvg;
    copyButton.setAttribute('aria-label', 'Copy code to clipboard');
    wrapper.appendChild(copyButton);

    copyButton.addEventListener('click', () => {
      navigator.clipboard.writeText(codeElement.innerText).then(() => {
        copyButton.innerHTML = checkIconSvg;
        copyButton.classList.add('copied');
        setTimeout(() => {
          copyButton.innerHTML = copyIconSvg;
          copyButton.classList.remove('copied');
        }, 2000);
      }).catch(err => {
        console.error('Failed to copy text: ', err);
        copyButton.innerText = 'Error';
      });
    });
  });
}

// --- Theme Sync Function ---
function syncBodyTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  if (currentTheme && document.body) {
    document.body.setAttribute('data-theme', currentTheme);
  }
}

// --- Scroll Spy Logic ---
function initializeScrollSpy() {
  const tocLinks = document.querySelectorAll('.toc-link');
  const headings = document.querySelectorAll('.main-content h2, .main-content h3');
  
  if (tocLinks.length === 0 || headings.length === 0) return;

  const observerOptions = {
    root: null,
    // Trigger when heading crosses the top 10% of screen
    rootMargin: '-10% 0px -80% 0px', 
    threshold: 0
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // 1. Clear current active state
        tocLinks.forEach(link => link.classList.remove('active'));
        
        // 2. Find link corresponding to this heading
        const id = entry.target.getAttribute('id');
        const activeLink = document.querySelector(`.toc-link[href="#${id}"]`);
        
        if (activeLink) {
            activeLink.classList.add('active');
            
            // Optional: Auto-scroll the TOC sidebar itself if needed
            // activeLink.scrollIntoView({ block: 'nearest' });
        }
      }
    });
  }, observerOptions);

  headings.forEach(heading => observer.observe(heading));
}

// --- Main Execution ---
document.addEventListener('DOMContentLoaded', () => {
  syncBodyTheme();
  setupThemeToggleListener();
  initializeSidebarToggle();
  initializeTabs();
  initializeCopyCodeButtons();
  initializeCollapsibleNav();
  initializeMobileMenus();
  initializeSidebarScroll();
  initializeScrollSpy();
});