/* =========================================================================
   @docmd/template-summer  —  summer.js
   Runtime interactions for the Summer template. Vanilla JS, no deps.

   What it does
   ------------
   - Theme switching hook (delegates to the existing docmd core)
   - Sidebar: collapse groups, mobile drawer
   - TOC: scroll-spy active state, smooth-scroll on click
   - Copy buttons for code blocks (auto-attach)
   - Copy raw markdown / context buttons (forward to docmd-main if present)
   - Top scroll-to-top button (revealed on scroll)
   - Search button (delegates to existing search trigger if present)
   - Banner close button (persists in localStorage)
   - Mobile sidebar toggle
   ========================================================================= */
(function () {
  'use strict';

  // -------- Utilities ----------------------------------------------------

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  function debounce(fn, wait) {
    let timer;
    return function () {
      const args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(null, args); }, wait);
    };
  }

  function isMac() { return /Mac|iPhone|iPad/.test(navigator.platform); }

  // -------- Theme toggle --------------------------------------------------

  function wireThemeToggle() {
    $$('[data-summer-theme-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var current = document.documentElement.getAttribute('data-theme') || 'light';
        var next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        try { localStorage.setItem('docmd-theme', next); } catch (_) {}
        // Notify docmd core if it has a global handler
        if (typeof window.applyDocmdTheme === 'function') {
          window.applyDocmdTheme(next);
        }
        // Notify any other listeners
        document.dispatchEvent(new CustomEvent('docmd:themechange', { detail: { theme: next } }));
      });
    });
  }

  // -------- Subnav: dropdowns -------------------------------------------

  function wireSubnavDropdowns() {
    $$('[data-summer-dropdown]').forEach(function (wrap) {
      var btn = wrap.querySelector('.summer-subnav__tab');
      if (!btn) return;
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var isOpen = wrap.getAttribute('data-open') === 'true';
        // Close other open dropdowns
        $$('[data-summer-dropdown]').forEach(function (other) {
          if (other !== wrap) other.setAttribute('data-open', 'false');
        });
        wrap.setAttribute('data-open', isOpen ? 'false' : 'true');
        btn.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
      });
    });
    // Close on outside click
    document.addEventListener('click', function () {
      $$('[data-summer-dropdown]').forEach(function (wrap) {
        wrap.setAttribute('data-open', 'false');
        var btn = wrap.querySelector('.summer-subnav__tab');
        if (btn) btn.setAttribute('aria-expanded', 'false');
      });
    });
    // Close on escape
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        $$('[data-summer-dropdown]').forEach(function (wrap) {
          wrap.setAttribute('data-open', 'false');
        });
      }
    });
  }

  // -------- Sidebar: mobile drawer ---------------------------------------

  function wireSidebar() {
    var toggles = $$('[data-summer-sidebar-toggle]');
    var closeBtn = $('[data-summer-sidebar-close]');
    toggles.forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.body.classList.toggle('summer-sidebar-open');
      });
    });
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        document.body.classList.remove('summer-sidebar-open');
      });
    }
    // Close on outside click
    document.addEventListener('click', function (e) {
      if (!document.body.classList.contains('summer-sidebar-open')) return;
      var sidebar = $('.summer-sidebar');
      var toggle = e.target.closest('[data-summer-sidebar-toggle]');
      if (toggle || (sidebar && sidebar.contains(e.target))) return;
      document.body.classList.remove('summer-sidebar-open');
    });
    // Close on escape
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && document.body.classList.contains('summer-sidebar-open')) {
        document.body.classList.remove('summer-sidebar-open');
      }
    });
  }

  // -------- Sidebar: collapse groups -------------------------------------

  function wireSidebarGroups() {
    var groups = $$('.summer-sidebar nav li.nav-group');
    groups.forEach(function (group) {
      var toggle = group.querySelector(':scope > .nav-label, :scope > a');
      if (!toggle) return;
      toggle.addEventListener('click', function (e) {
        // Only intercept clicks on the group header itself, not on subitems
        if (e.target.closest('.submenu')) return;
        e.preventDefault();
        var expanded = group.getAttribute('aria-expanded') !== 'false';
        group.setAttribute('aria-expanded', expanded ? 'false' : 'true');
        group.classList.toggle('expanded', !expanded);
        group.classList.toggle('collapsed', expanded);
        try {
          var key = 'summer-sidebar:' + (group.querySelector('.nav-item-title')?.textContent.trim() || 'group');
          localStorage.setItem(key, expanded ? '0' : '1');
        } catch (_) {}
      });
    });
  }

  // -------- TOC: scroll-spy ---------------------------------------------

  function wireTocScrollSpy() {
    var tocLinks = $$('.summer-toc__link');
    if (!tocLinks.length) return;
    var headings = tocLinks
      .map(function (link) {
        var id = (link.getAttribute('href') || '').replace(/^#/, '');
        if (!id) return null;
        return { id: id, el: document.getElementById(id), link: link };
      })
      .filter(function (x) { return x && x.el; });

    if (!headings.length) return;

    function setActive(id) {
      tocLinks.forEach(function (l) { l.classList.remove('active'); });
      $$('.summer-toc__item').forEach(function (li) { li.classList.remove('is-ancestor'); });
      var match = tocLinks.filter(function (l) { return (l.getAttribute('href') || '') === '#' + id; })[0];
      if (match) {
        match.classList.add('active');
        // Mark all preceding items at a higher level as "ancestors" so the
        // thread (orange line) extends from the top down through them.
        var allItems = $$('.summer-toc__item');
        var matchLi = match.closest('.summer-toc__item');
        var matchIdx = allItems.indexOf(matchLi);
        for (var i = 0; i < matchIdx; i++) {
          allItems[i].classList.add('is-ancestor');
        }
      }
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) setActive(entry.target.id);
      });
    }, { rootMargin: '-110px 0px -70% 0px', threshold: 0 });

    headings.forEach(function (h) { observer.observe(h.el); });
  }

  function wireTocSmoothScroll() {
    $$('.summer-toc__link').forEach(function (link) {
      link.addEventListener('click', function (e) {
        var href = link.getAttribute('href') || '';
        if (!href.startsWith('#')) return;
        var target = document.getElementById(href.slice(1));
        if (!target) return;
        e.preventDefault();
        var top = target.getBoundingClientRect().top + window.pageYOffset - 130;
        window.scrollTo({ top: top, behavior: 'smooth' });
        history.pushState(null, '', href);
      });
    });
  }

  // -------- Scroll to top button -----------------------------------------

  function wireScrollToTop() {
    var btn = $('.summer-totop');
    if (!btn) return;
    var onScroll = debounce(function () {
      var y = window.pageYOffset || document.documentElement.scrollTop;
      btn.classList.toggle('is-visible', y > 480);
    }, 50);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // -------- Copy buttons for code blocks --------------------------------

  function attachCodeCopyButtons() {
    $$('.summer-content pre').forEach(function (pre) {
      if (pre.dataset.summerCopyAttached === '1') return;
      pre.dataset.summerCopyAttached = '1';

      // Wrap in a codeblock container so we can add a header with copy button
      var code = pre.querySelector('code');
      if (!code) return;

      // Skip if no language class — we can still copy, just no filename
      var lang = '';
      var m = code.className.match(/language-([\w-]+)/);
      if (m) lang = m[1];

      // Build the wrapper
      var wrap = document.createElement('div');
      wrap.className = 'summer-codeblock';
      pre.parentNode.insertBefore(wrap, pre);
      wrap.appendChild(pre);

      // Build header using safe DOM construction (avoids innerHTML).
      var header = document.createElement('div');
      header.className = 'summer-codeblock__header';

      // LEFT — file icon + filename + language pill
      var leftGroup = document.createElement('div');
      leftGroup.style.display = 'inline-flex';
      leftGroup.style.alignItems = 'center';
      leftGroup.style.gap = '10px';
      leftGroup.style.minWidth = '0';
      leftGroup.style.overflow = 'hidden';

      var iconWrap = document.createElement('span');
      iconWrap.className = 'summer-codeblock__filename-icon';
      // Build the icon via safe DOM construction (avoids innerHTML).
      var fileIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      fileIcon.setAttribute('viewBox', '0 0 24 24');
      fileIcon.setAttribute('fill', 'none');
      fileIcon.setAttribute('stroke', 'currentColor');
      fileIcon.setAttribute('stroke-width', '2');
      fileIcon.setAttribute('stroke-linecap', 'round');
      fileIcon.setAttribute('stroke-linejoin', 'round');
      var fileIconPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      fileIconPath.setAttribute('d', 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z');
      var fileIconPoly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      fileIconPoly.setAttribute('points', '14 2 14 8 20 8');
      fileIcon.appendChild(fileIconPath);
      fileIcon.appendChild(fileIconPoly);
      iconWrap.appendChild(fileIcon);
      leftGroup.appendChild(iconWrap);

      var filename = document.createElement('span');
      filename.className = 'summer-codeblock__filename';
      filename.textContent = lang || 'snippet';
      filename.style.overflow = 'hidden';
      filename.style.textOverflow = 'ellipsis';
      filename.style.whiteSpace = 'nowrap';
      leftGroup.appendChild(filename);

      if (lang) {
        var langPill = document.createElement('span');
        langPill.className = 'summer-codeblock__lang';
        langPill.textContent = lang;
        leftGroup.appendChild(langPill);
      }

      header.appendChild(leftGroup);

      // RIGHT — copy button
      var copyBtn = document.createElement('button');
      copyBtn.className = 'summer-codeblock__copy';
      copyBtn.type = 'button';
      copyBtn.setAttribute('aria-label', 'Copy code');

      var copyIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      copyIcon.setAttribute('width', '13');
      copyIcon.setAttribute('height', '13');
      copyIcon.setAttribute('viewBox', '0 0 24 24');
      copyIcon.setAttribute('fill', 'none');
      copyIcon.setAttribute('stroke', 'currentColor');
      copyIcon.setAttribute('stroke-width', '2');
      copyIcon.setAttribute('stroke-linecap', 'round');
      copyIcon.setAttribute('stroke-linejoin', 'round');
      var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', '9'); rect.setAttribute('y', '9');
      rect.setAttribute('width', '13'); rect.setAttribute('height', '13');
      rect.setAttribute('rx', '2'); rect.setAttribute('ry', '2');
      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1');
      copyIcon.appendChild(rect);
      copyIcon.appendChild(path);
      copyBtn.appendChild(copyIcon);

      var copyLabel = document.createElement('span');
      copyLabel.textContent = 'Copy';
      copyBtn.appendChild(copyLabel);

      header.appendChild(copyBtn);
      wrap.insertBefore(header, pre);

      // Wire the copy button
      var copyBtn = header.querySelector('.summer-codeblock__copy');
      copyBtn.addEventListener('click', function () {
        var text = code.innerText;
        copyToClipboard(text).then(function () {
          copyBtn.classList.add('is-copied');
          var span = copyBtn.querySelector('span');
          if (span) span.textContent = 'Copied!';
          setTimeout(function () {
            copyBtn.classList.remove('is-copied');
            if (span) span.textContent = 'Copy';
          }, 1800);
        });
      });
    });
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        resolve();
      } catch (e) { reject(e); }
    });
  }

  // -------- Page copy buttons (raw / context) ---------------------------

  function wirePageCopyButtons() {
    // Reuse the data-copied attribute that docmd uses for feedback
    var rawBtn = $('.summd-copy-raw, .docmd-copy-raw-btn');
    var contextBtn = $('.summer-copy-context, .docmd-copy-context-btn');
    var rawContainer = $('#docmd-raw-markdown');
    if (rawBtn && rawContainer) {
      rawBtn.addEventListener('click', function (e) {
        e.preventDefault();
        var text = decodeURIComponent(rawContainer.getAttribute('data-content') || '');
        copyToClipboard(text).then(function () {
          var label = rawBtn.getAttribute('data-copied') || 'Copied!';
          showCopiedFeedback(rawBtn, label);
        });
      });
    }
    if (contextBtn) {
      contextBtn.addEventListener('click', function (e) {
        e.preventDefault();
        var path = location.pathname;
        var title = document.title;
        var text = '[Doc context]\nTitle: ' + title + '\nPath: ' + path + '\n\n';
        var main = $('.summer-content');
        if (main) text += main.innerText;
        copyToClipboard(text).then(function () {
          var label = contextBtn.getAttribute('data-copied') || 'Copied!';
          showCopiedFeedback(contextBtn, label);
        });
      });
    }
  }

  function showCopiedFeedback(btn, label) {
    var span = btn.querySelector('span') || btn;
    var original = btn.dataset.originalLabel || span.textContent;
    if (!btn.dataset.originalLabel) btn.dataset.originalLabel = original;
    span.textContent = label;
    btn.classList.add('is-copied');
    setTimeout(function () {
      span.textContent = original;
      btn.classList.remove('is-copied');
    }, 1800);
  }

  // -------- Banner close ------------------------------------------------

  function wireBannerClose() {
    $$('[data-summer-banner-close]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var banner = btn.closest('.summer-banner');
        if (banner) {
          banner.style.display = 'none';
          try { localStorage.setItem('summer-banner-dismissed', '1'); } catch (_) {}
        }
      });
    });
    try {
      if (localStorage.getItem('summer-banner-dismissed') === '1') {
        var b = $('.summer-banner');
        if (b) b.style.display = 'none';
      }
    } catch (_) {}
  }

  // -------- Inline Header Search & Dropdown ----------------------------

  function wireHeaderSearch() {
    var headerInput = $('.summer-search-input');
    if (!headerInput) return;

    var dropdown = $('.summer-search-dropdown');
    var resultsWrapper = $('.summer-search-results-wrapper');

    var indexInitialized = false;
    function initSearchIndex() {
      if (indexInitialized) return;
      indexInitialized = true;
      var trigger = $('.docmd-search-trigger, [data-docmd-search-trigger]');
      if (trigger) {
        trigger.click();
      } else {
        var dummy = document.createElement('div');
        dummy.className = 'docmd-search-trigger';
        dummy.style.display = 'none';
        document.body.appendChild(dummy);
        dummy.click();
        dummy.remove();
      }
      setTimeout(function () {
        headerInput.focus();
      }, 100);
    }

    function tryInitPluginSearch() {
      var searchModal = $('#docmd-search-modal');
      var pluginInput = $('#docmd-search-input');
      var pluginResults = $('#docmd-search-results');

      if (!searchModal || !pluginInput || !pluginResults) {
        setTimeout(tryInitPluginSearch, 100);
        return;
      }

      if (resultsWrapper && pluginResults.parentNode !== resultsWrapper) {
        resultsWrapper.appendChild(pluginResults);
      }

      searchModal.style.setProperty('display', 'none', 'important');
      searchModal.style.setProperty('opacity', '0', 'important');
      searchModal.style.setProperty('pointer-events', 'none', 'important');
    }

    tryInitPluginSearch();

    headerInput.addEventListener('focus', function () {
      initSearchIndex();
      dropdown.style.display = 'block';
    });

    headerInput.addEventListener('input', function () {
      initSearchIndex();
      var pluginInput = $('#docmd-search-input');
      if (pluginInput) {
        pluginInput.value = headerInput.value;
        pluginInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      dropdown.style.display = 'block';
    });

    headerInput.addEventListener('keydown', function (e) {
      var pluginInput = $('#docmd-search-input');
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
        if (pluginInput) {
          var clone = new KeyboardEvent('keydown', {
            key: e.key,
            code: e.code,
            keyCode: e.keyCode,
            bubbles: true,
            cancelable: true
          });
          pluginInput.dispatchEvent(clone);
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
          }
        }
      } else if (e.key === 'Escape') {
        headerInput.value = '';
        if (pluginInput) {
          pluginInput.value = '';
          pluginInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        headerInput.blur();
        dropdown.style.display = 'none';
      }
    });

    document.addEventListener('click', function (e) {
      if (!e.target.closest('.summer-search-container')) {
        dropdown.style.display = 'none';
      }
    });

    document.addEventListener('keydown', function (e) {
      var isK = e.key === 'k' || e.key === 'K';
      if (isK && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        headerInput.focus();
      }
      if (e.key === '/' && !/^(input|textarea|select)$/i.test(e.target.tagName) && !e.target.isContentEditable) {
        e.preventDefault();
        headerInput.focus();
      }
    });
  }

  // -------- Init --------------------------------------------------------

  ready(function () {
    // Mark HTML as ready (reveal the page even if docmd core is slow to set data-theme)
    document.documentElement.classList.add('summer-ready');

    wireThemeToggle();
    wireSubnavDropdowns();
    wireSidebar();
    wireSidebarGroups();
    wireTocScrollSpy();
    wireTocSmoothScroll();
    wireScrollToTop();
    attachCodeCopyButtons();
    wirePageCopyButtons();
    wireBannerClose();
    wireHeaderSearch();
  });
})();
