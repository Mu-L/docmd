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
    var MOBILE_BP = '(max-width: 900px)';
    function isMobile() { return window.matchMedia(MOBILE_BP).matches; }
    function closeDrawer() { document.body.classList.remove('summer-sidebar-open'); }

    toggles.forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.body.classList.toggle('summer-sidebar-open');
      });
    });
    if (closeBtn) {
      closeBtn.addEventListener('click', closeDrawer);
    }
    // Close on outside click
    document.addEventListener('click', function (e) {
      if (!document.body.classList.contains('summer-sidebar-open')) return;
      var sidebar = $('.summer-sidebar');
      var toggle = e.target.closest('[data-summer-sidebar-toggle]');
      if (toggle || (sidebar && sidebar.contains(e.target))) return;
      closeDrawer();
    });
    // Close on escape
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && document.body.classList.contains('summer-sidebar-open')) {
        closeDrawer();
      }
    });
    // Auto-close drawer when crossing back to the desktop breakpoint
    var mql = window.matchMedia(MOBILE_BP);
    var onBp = function (e) { if (!e.matches) closeDrawer(); };
    if (mql.addEventListener) mql.addEventListener('change', onBp);
    else if (mql.addListener) mql.addListener(onBp);
    // Close on initial load if we're not mobile (avoid stale state)
    if (!isMobile()) closeDrawer();
  }

  // -------- Sidebar: collapse groups -------------------------------------

  function wireSidebarGroups() {
    var groups = $$('.summer-sidebar nav li.nav-group');
    groups.forEach(function (group) {
      var key = 'summer-sidebar:' + (group.querySelector('.nav-item-title')?.textContent.trim() || 'group');

      // Restore persisted collapse state on load
      try {
        var saved = localStorage.getItem(key);
        if (saved === '0') {
          group.setAttribute('aria-expanded', 'false');
          group.classList.add('collapsed');
          group.classList.remove('expanded');
        } else if (saved === '1') {
          group.setAttribute('aria-expanded', 'true');
          group.classList.add('expanded');
          group.classList.remove('collapsed');
        }
      } catch (_) {}

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
          localStorage.setItem(key, expanded ? '0' : '1');
        } catch (_) {}
      });
    });
  }

  // -------- TOC: SVG path track (Fumadocs-style) -----------------------

  var _tocActiveIdx = -1;
  var _tocScrollDir = 1; // 1 = down, -1 = up
  var _tocLastScrollY = window.pageYOffset || 0;

  function buildTocSvgTrack() {
    var list = $('.summer-toc__list');
    if (!list) return;
    var items = $$('.summer-toc__item', list);
    if (!items.length) return;

    // === Tweakable layout ===
    var BASE_X = 5;              // x position of level-1 items (px from track left)
    var INDENT = 7;              // px indent per level step

    // === Tweakable bend shape ===
    // Cubic Bézier between consecutive items at different indent levels.
    //   BEND_HORIZ_MULT — scales with the horizontal |Δx| (typical Δx = INDENT).
    //                     Higher = more curve per indent step.
    //   BEND_VERT_FRAC  — caps the bend as a fraction of the actual vertical
    //                     gap between item centres. 1.0 = max smooth S-curve,
    //                     < 1.0 = subtler. Must stay ≤ 1.0 to avoid overshoot.
    var BEND_HORIZ_MULT = 2.0;
    var BEND_VERT_FRAC  = 1.0;

    // Measure each item's actual centre y from the DOM. The track is
    // position:absolute at top:0 of the list, so list-relative coords match
    // track-local coords and the path lines up with the items exactly.
    var positions = items.map(function (li) {
      var lvl = parseInt(li.dataset.level || li.className.match(/level-(\d)/)?.[1] || '1', 10);
      return {
        x: BASE_X + (lvl - 1) * INDENT,
        cy: li.offsetTop + li.offsetHeight / 2
      };
    });
    var xPositions = positions.map(function (p) { return p.x; });
    var yCentres = positions.map(function (p) { return p.cy; });
    // Track height = full list content (top of list to bottom of last item)
    var totalH = items[items.length - 1].offsetTop + items[items.length - 1].offsetHeight;

    // Build the SVG path d-string
    var d = '';
    for (var i = 0; i < positions.length; i++) {
      var x = positions[i].x;
      var y = yCentres[i];
      if (i === 0) {
        d += 'M ' + x + ' 0 L ' + x + ' ' + y;
      } else {
        var px = positions[i - 1].x;
        var py = yCentres[i - 1];
        if (px === x) {
          // same level — straight line
          d += ' L ' + x + ' ' + y;
        } else {
          // level change — cubic bezier bend, clamped so the curve never
          // overshoots past the destination
          var gap = y - py;
          var bend = Math.min(gap * BEND_VERT_FRAC, Math.abs(x - px) * BEND_HORIZ_MULT);
          d += ' C ' + px + ' ' + (py + bend) + ' ' + x + ' ' + (y - bend) + ' ' + x + ' ' + y;
        }
      }
    }
    // extend to bottom
    var lastX = positions[positions.length - 1].x;
    d += ' L ' + lastX + ' ' + totalH;

    var svgW = BASE_X + (4 - 1) * INDENT + 4; // max possible width

    // Create track container
    var track = document.createElement('div');
    track.className = 'summer-toc__track';
    track.style.width = svgW + 'px';
    track.style.height = totalH + 'px';

    var NS = 'http://www.w3.org/2000/svg';

    // Full (grey) path
    var svgFull = document.createElementNS(NS, 'svg');
    svgFull.setAttribute('class', 'summer-toc__track-full');
    svgFull.setAttribute('width', svgW);
    svgFull.setAttribute('height', totalH);
    svgFull.setAttribute('viewBox', '0 0 ' + svgW + ' ' + totalH);
    var pathFull = document.createElementNS(NS, 'path');
    pathFull.setAttribute('d', d);
    svgFull.appendChild(pathFull);
    track.appendChild(svgFull);

    // Active (accent) path — clipped
    var svgActive = document.createElementNS(NS, 'svg');
    svgActive.setAttribute('class', 'summer-toc__track-active');
    svgActive.setAttribute('width', svgW);
    svgActive.setAttribute('height', totalH);
    svgActive.setAttribute('viewBox', '0 0 ' + svgW + ' ' + totalH);
    svgActive.style.clipPath = 'polygon(0 0, ' + svgW + 'px 0, ' + svgW + 'px 0, 0 0)';
    var pathActive = document.createElementNS(NS, 'path');
    pathActive.setAttribute('d', d);
    svgActive.appendChild(pathActive);
    track.appendChild(svgActive);

    list.insertBefore(track, list.firstChild);

    return { track: track, svgActive: svgActive, xPositions: xPositions, yCentres: yCentres, d: d, totalH: totalH, svgW: svgW };
  }

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

    var track = buildTocSvgTrack();

    function setActive(idx) {
      if (idx === _tocActiveIdx) return;
      _tocActiveIdx = idx;

      tocLinks.forEach(function (l) { l.classList.remove('active'); });
      if (idx < 0 || idx >= tocLinks.length) return;

      tocLinks[idx].classList.add('active');

      if (!track) return;

      var totalH = track.totalH;
      var svgW = track.svgW;

      // Fill from top down to the active item's centre Y.
      // If the user has scrolled to the bottom of the page (footer visible),
      // fill all the way to the bottom of the track so it doesn't appear cut off.
      var docH = document.documentElement.scrollHeight;
      var winH = window.innerHeight;
      var atPageBottom = (window.pageYOffset + winH) >= (docH - 40);
      var activeY = (atPageBottom || idx === tocLinks.length - 1)
        ? totalH
        : track.yCentres[idx];

      track.svgActive.style.clipPath =
        'polygon(0 0, ' + svgW + 'px 0, ' +
                svgW + 'px ' + activeY + 'px, 0 ' + activeY + 'px)';
    }

    // Scroll-spy using IntersectionObserver — each heading fills the TOC
    // as soon as it enters the viewport (visible = active).
    var TOPBAR_H = parseInt(
      getComputedStyle(document.documentElement).getPropertyValue('--summer-topbar-height') || '64', 10
    );
    var SUBNAV_H = parseInt(
      getComputedStyle(document.documentElement).getPropertyValue('--summer-subnav-height') || '44', 10
    );
    var rootMarginTop = -(TOPBAR_H + SUBNAV_H + 8) + 'px';

    // Build a map from heading id → index
    var idxMap = {};
    headings.forEach(function (h, i) { idxMap[h.id] = i; });

    // Track which headings are currently intersecting
    var visibleSet = {};

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          visibleSet[entry.target.id] = true;
        } else {
          delete visibleSet[entry.target.id];
        }
      });
      // Activate the last visible heading (lowest on screen = most advanced)
      var bestIdx = -1;
      headings.forEach(function (h, i) {
        if (visibleSet[h.id] && i >= bestIdx) bestIdx = i;
      });
      // Fallback: if nothing visible, find last heading above viewport
      if (bestIdx === -1) {
        for (var i = headings.length - 1; i >= 0; i--) {
          var rect = headings[i].el.getBoundingClientRect();
          if (rect.bottom < TOPBAR_H + SUBNAV_H + 8) { bestIdx = i; break; }
        }
      }
      if (bestIdx === -1 && headings.length) bestIdx = 0;
      setActive(bestIdx);
    }, {
      rootMargin: rootMarginTop + ' 0px -10% 0px',
      threshold: 0
    });

    headings.forEach(function (h) { observer.observe(h.el); });
    // Initial state
    updateActiveOnce();

    function updateActiveOnce() {
      var bestIdx = -1;
      for (var i = headings.length - 1; i >= 0; i--) {
        var rect = headings[i].el.getBoundingClientRect();
        if (rect.top <= TOPBAR_H + SUBNAV_H + 80) { bestIdx = i; break; }
      }
      if (bestIdx === -1 && headings.length) bestIdx = 0;
      setActive(bestIdx);
    }
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
      // Use programmatic click WITHOUT triggering focus shifts that would
      // scroll the page. We also restore our scroll position afterwards.
      var scrollY = window.pageYOffset;
      var trigger = $('.docmd-search-trigger, [data-docmd-search-trigger]');
      if (trigger) {
        trigger.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      } else {
        var dummy = document.createElement('div');
        dummy.className = 'docmd-search-trigger';
        dummy.style.position = 'fixed';
        dummy.style.top = '0';
        dummy.style.left = '0';
        dummy.style.width = '1px';
        dummy.style.height = '1px';
        dummy.style.opacity = '0';
        dummy.style.pointerEvents = 'none';
        document.body.appendChild(dummy);
        dummy.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        // Don't remove — the plugin's listener may capture bubbles asynchronously
      }
      // Restore scroll & refocus our header input (NOT the plugin's input)
      requestAnimationFrame(function () {
        window.scrollTo(0, scrollY);
        headerInput.focus({ preventScroll: true });
      });
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

      // Force the modal off-screen (CSS already does this, but also set inline
      // as a belt-and-braces measure so it can never auto-scroll into view).
      searchModal.style.setProperty('position', 'fixed', 'important');
      searchModal.style.setProperty('top', '-9999px', 'important');
      searchModal.style.setProperty('left', '-9999px', 'important');
      searchModal.style.setProperty('display', 'none', 'important');
      searchModal.style.setProperty('opacity', '0', 'important');
      searchModal.style.setProperty('visibility', 'hidden', 'important');
      searchModal.style.setProperty('pointer-events', 'none', 'important');

      // Make the plugin input also off-screen so it cannot grab focus
      pluginInput.tabIndex = -1;
      pluginInput.setAttribute('aria-hidden', 'true');
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

  // -------- Switcher dropdowns (version / project / language) ---------
  // These ship as raw partials from docmd core (no JS), so summer wires
  // the open/close behaviour and outside-click handling itself.

  function wireSwitcherDropdowns() {
    var groups = $$('.docmd-version-dropdown, .docmd-project-switcher, .docmd-language-switcher');
    if (!groups.length) return;

    function closeAll(except) {
      groups.forEach(function (g) {
        if (g === except) return;
        g.classList.remove('open');
        var btn = g.querySelector('button[aria-expanded]');
        if (btn) btn.setAttribute('aria-expanded', 'false');
      });
    }

    groups.forEach(function (group) {
      var btn = group.querySelector('button[aria-expanded], .version-dropdown-toggle, .project-switcher-toggle, .language-switcher-toggle');
      if (!btn) return;
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var willOpen = !group.classList.contains('open');
        closeAll(group);
        group.classList.toggle('open', willOpen);
        btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      });
    });

    document.addEventListener('click', function (e) {
      if (!e.target.closest('.docmd-version-dropdown, .docmd-project-switcher, .docmd-language-switcher')) {
        closeAll(null);
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeAll(null);
    });
  }

  // -------- Git last-updated popover toggle (keyboard) ---------------
  // Hover is handled in CSS; this adds click + keyboard support so the
  // popover is reachable without a mouse.

  function wireGitPopover() {
    $$('.summer-pagefooter__time.has-commits').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        var open = el.classList.toggle('open');
        el.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          el.click();
        } else if (e.key === 'Escape') {
          el.classList.remove('open');
          el.setAttribute('aria-expanded', 'false');
          el.blur();
        }
      });
    });
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.summer-pagefooter__time.has-commits')) {
        $$('.summer-pagefooter__time.has-commits.open').forEach(function (el) {
          el.classList.remove('open');
          el.setAttribute('aria-expanded', 'false');
        });
      }
    });
  }

  // -------- Relative date rendering (lightweight) --------------------
  // Renders any [data-timestamp] as a human-readable relative date.
  // We avoid pulling in a date library for this tiny feature.

  function formatRelative(ts) {
    var now = Date.now();
    var diff = Math.max(0, now - ts);
    var sec = Math.floor(diff / 1000);
    if (sec < 45) return 'just now';
    var min = Math.floor(sec / 60);
    if (min < 60) return min + ' min ago';
    var hr = Math.floor(min / 60);
    if (hr < 24) return hr + ' hr ago';
    var day = Math.floor(hr / 24);
    if (day < 7) return day + ' day' + (day === 1 ? '' : 's') + ' ago';
    if (day < 30) {
      var wk = Math.floor(day / 7);
      return wk + ' week' + (wk === 1 ? '' : 's') + ' ago';
    }
    if (day < 365) {
      var mo = Math.floor(day / 30);
      return mo + ' month' + (mo === 1 ? '' : 's') + ' ago';
    }
    var yr = Math.floor(day / 365);
    return yr + ' year' + (yr === 1 ? '' : 's') + ' ago';
  }

  function renderRelativeTimestamps() {
    $$('[data-timestamp]').forEach(function (el) {
      var raw = el.getAttribute('data-timestamp');
      if (!raw) return;
      var ts = parseInt(raw, 10);
      if (!isFinite(ts) || ts <= 0) return;
      // Use a child span if one exists (git popover meta), else replace
      var target = el.querySelector('.git-time, .summer-git-popover__date') || el;
      if (target !== el && target.children.length > 0) return;
      if (!target.__renderedAt || (Date.now() - target.__renderedAt) > 60000) {
        target.textContent = formatRelative(ts);
        target.__renderedAt = Date.now();
      }
    });
  }

  // -------- Init --------------------------------------------------------

  // Re-runnable body of init logic. Idempotent: every wire is guarded
  // with a data-attribute check so calling this twice is safe.
  function summerInit() {
    if (document.documentElement.dataset.summerWired === '1') {
      // First run: bind document-level listeners + header/footer/sidebar wires
      document.documentElement.dataset.summerWired = '1';
      wireThemeToggle();
      wireScrollToTop();
      wireBannerClose();
      wireHeaderSearch();
      wireSidebar();
      wireSubnavDropdowns();
      wireSwitcherDropdowns();
    }
    // Per-page wires — always re-run after SPA nav (the page content was swapped)
    wireSidebarGroups();
    wireTocScrollSpy();
    wireTocSmoothScroll();
    attachCodeCopyButtons();
    wirePageCopyButtons();
    wireGitPopover();
    renderRelativeTimestamps();
  }

  ready(function () {
    // Mark HTML as ready (reveal the page even if docmd core is slow to set data-theme)
    document.documentElement.classList.add('summer-ready');
    summerInit();
    // Re-wire after SPA navigation (docmd core fires this on the document)
    document.addEventListener('docmd:page-mounted', summerInit);
  });
})();
