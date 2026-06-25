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
 *
 * Self-contained graph viewer: CSS, JS, and HTML shell.
 *
 * The viewer reads `graph.json` from the same directory and renders
 * a force-directed SVG layout with:
 *   - Pan (drag empty space) and zoom (wheel / buttons)
 *   - Hover highlights the focused node + neighbours; dims the rest
 *   - Live search box that filters nodes, labels, and links
 *   - Drag a node to pin it; double-click to release
 *   - Side panel with details + clickable list of connected nodes
 *   - Legend and zoom controls are rendered from data
 *
 * No external dependencies: D3-style forces are implemented inline
 * (charge + link + center + collide, alpha-decay cooled). The JS
 * uses only textContent / element creation — never innerHTML with
 * user-supplied strings — so a malicious OKF bundle cannot inject
 * HTML or scripts into the viewer.
 */

// Concept-type → render colour. Keep in sync with the graph legend
// rendered below (render() rebuilds legend items from data.types, but
// the colour palette is fixed here).
export const TYPE_COLORS: Record<string, string> = {
  concept:   '#6366f1',
  guide:     '#10b981',
  api:       '#f59e0b',
  reference: '#0ea5e9',
  runbook:   '#ef4444',
  dataset:   '#a855f7',
  metric:    '#ec4899',
  table:     '#14b8a6'
};

export const GRAPH_CSS = `:root{
  --okf-fg:#1f2937;--okf-bg:#fafafa;--okf-panel-bg:#ffffff;--okf-border:#e5e7eb;
  --okf-link:#cbd5e1;--okf-link-active:#6366f1;--okf-link-faded:#f1f5f9;
  --okf-node-stroke:#ffffff;--okf-node-faded-opacity:0.15;
  --okf-chip:#eef2ff;--okf-chip-fg:#3730a3;--okf-muted:#6b7280;
  --okf-accent:#6366f1;--okf-shadow:0 4px 16px rgba(0,0,0,.06);
  --okf-input-bg:#ffffff;
}
@media (prefers-color-scheme: dark){
  :root{
    --okf-fg:#e5e7eb;--okf-bg:#0f172a;--okf-panel-bg:#1e293b;--okf-border:#334155;
    --okf-link:#475569;--okf-link-active:#818cf8;--okf-link-faded:#1e293b;
    --okf-node-stroke:#0f172a;
    --okf-chip:#312e81;--okf-chip-fg:#c7d2fe;--okf-muted:#94a3b8;
    --okf-accent:#818cf8;--okf-input-bg:#0f172a;
  }
}
*{box-sizing:border-box}
html,body{margin:0;height:100%;overflow:hidden;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:var(--okf-fg);background:var(--okf-bg)}
.okf-app{display:flex;height:100vh}
.okf-stage{position:relative;flex:1;overflow:hidden;background:var(--okf-bg)}
.okf-stage svg{display:block;width:100%;height:100%;cursor:grab}
.okf-stage svg.dragging{cursor:grabbing}
.okf-stage svg.node-hover{cursor:pointer}

.okf-toolbar{
  position:absolute;top:16px;left:16px;right:16px;display:flex;align-items:center;
  gap:12px;z-index:10;pointer-events:none;
}
.okf-toolbar > *{pointer-events:auto}
.okf-title{flex:1;min-width:0}
.okf-title h1{margin:0;font-size:15px;font-weight:600;line-height:1.2;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.okf-title .okf-sub{font-size:11px;color:var(--okf-muted);margin-top:3px}

.okf-search{
  position:relative;flex:0 1 280px;
}
.okf-search input{
  width:100%;padding:8px 12px 8px 32px;font-size:13px;
  background:var(--okf-input-bg);color:var(--okf-fg);
  border:1px solid var(--okf-border);border-radius:8px;
  outline:none;transition:border-color .15s,box-shadow .15s;
}
.okf-search input:focus{border-color:var(--okf-accent);
  box-shadow:0 0 0 3px rgba(99,102,241,.15)}
.okf-search::before{
  content:'';position:absolute;left:10px;top:50%;transform:translateY(-50%);
  width:14px;height:14px;
  background:currentColor;opacity:.4;mask:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='black' d='M10 2a8 8 0 1 1-5.3 14L1 19.7 2.3 21l3.7-3.7A8 8 0 0 1 10 2zm0 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12z'/></svg>") center/contain no-repeat;
  -webkit-mask:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='black' d='M10 2a8 8 0 1 1-5.3 14L1 19.7 2.3 21l3.7-3.7A8 8 0 0 1 10 2zm0 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12z'/></svg>") center/contain no-repeat;
}

.okf-legend{
  position:absolute;bottom:16px;left:16px;background:var(--okf-panel-bg);
  border:1px solid var(--okf-border);border-radius:10px;padding:10px 12px;
  box-shadow:var(--okf-shadow);z-index:5;font-size:11px;max-width:240px;
}
.okf-legend h3{margin:0 0 6px;font-size:11px;font-weight:600;
  color:var(--okf-muted);text-transform:uppercase;letter-spacing:.5px}
.okf-legend ul{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:6px 10px}
.okf-legend li{display:flex;align-items:center;gap:6px;color:var(--okf-fg)}
.okf-legend .dot{width:10px;height:10px;border-radius:50%;display:inline-block}

.okf-controls{
  position:absolute;bottom:16px;right:16px;display:flex;flex-direction:column;
  gap:6px;z-index:5;
}
.okf-controls button{
  width:36px;height:36px;background:var(--okf-panel-bg);
  border:1px solid var(--okf-border);border-radius:8px;
  color:var(--okf-fg);font-size:16px;font-weight:600;cursor:pointer;
  display:flex;align-items:center;justify-content:center;
  transition:background .12s,border-color .12s;
}
.okf-controls button:hover{background:var(--okf-bg);border-color:var(--okf-accent)}
.okf-controls button:active{transform:scale(.96)}

.okf-graph circle.node{
  cursor:pointer;stroke:var(--okf-node-stroke);stroke-width:2;
  transition:stroke-width .15s,opacity .2s;
}
.okf-graph circle.node:hover{stroke-width:3.5}
.okf-graph text.label{
  font-size:11px;fill:var(--okf-fg);pointer-events:none;text-anchor:middle;
  font-weight:500;paint-order:stroke;stroke:var(--okf-bg);stroke-width:3px;
  stroke-linejoin:round;
  transition:opacity .2s;
}
.okf-graph line.link{
  stroke:var(--okf-link);stroke-opacity:.55;stroke-width:1.2;
  transition:stroke .2s,stroke-opacity .2s;
}
.okf-graph line.link.active{stroke:var(--okf-link-active);stroke-opacity:1;stroke-width:1.8}
.okf-graph .faded{opacity:var(--okf-node-faded-opacity)}
.okf-graph .link-faded{stroke:var(--okf-link-faded);stroke-opacity:.9}

.okf-panel{
  width:340px;flex-shrink:0;background:var(--okf-panel-bg);
  border-left:1px solid var(--okf-border);padding:24px;overflow:auto;
  box-shadow:-4px 0 16px rgba(0,0,0,.04);
}
.okf-panel h2{margin:0 0 8px;font-size:18px;line-height:1.3;font-weight:600}
.okf-panel .okf-type{
  display:inline-block;font-size:10px;padding:3px 9px;border-radius:999px;
  background:var(--okf-chip);color:var(--okf-chip-fg);margin-bottom:12px;
  text-transform:uppercase;letter-spacing:.6px;font-weight:600;
}
.okf-panel p{margin:0 0 14px;line-height:1.5;color:var(--okf-fg)}
.okf-panel .okf-empty{color:var(--okf-muted);font-style:italic}
.okf-panel .okf-meta{font-size:12px;color:var(--okf-muted);margin-top:12px;
  display:flex;flex-wrap:wrap;gap:6px 14px}
.okf-panel .okf-meta span{display:inline-flex;align-items:center;gap:4px}
.okf-panel a.okf-btn{
  display:inline-flex;align-items:center;gap:6px;font-size:12px;
  font-weight:500;color:var(--okf-accent);text-decoration:none;
  padding:6px 10px;border-radius:6px;border:1px solid var(--okf-border);
  background:var(--okf-bg);margin-right:6px;margin-top:4px;
  transition:background .12s,border-color .12s;
}
.okf-panel a.okf-btn:hover{background:var(--okf-chip);border-color:var(--okf-accent)}
.okf-panel .okf-section{margin-top:18px;padding-top:16px;
  border-top:1px solid var(--okf-border)}
.okf-panel .okf-section h3{margin:0 0 8px;font-size:11px;font-weight:600;
  color:var(--okf-muted);text-transform:uppercase;letter-spacing:.5px}
.okf-panel .okf-conn-list{list-style:none;margin:0;padding:0;max-height:200px;overflow:auto}
.okf-panel .okf-conn-list li{padding:5px 0;border-bottom:1px solid var(--okf-border);font-size:12px}
.okf-panel .okf-conn-list li:last-child{border-bottom:none}
.okf-panel .okf-conn-list button{
  background:none;border:none;color:var(--okf-accent);cursor:pointer;
  font:inherit;padding:0;text-align:left;width:100%;
}
.okf-panel .okf-conn-list button:hover{text-decoration:underline}
.okf-panel .okf-conn-list .okf-conn-type{color:var(--okf-muted);font-size:10px;margin-left:6px}
@media (max-width:760px){
  .okf-app{flex-direction:column}
  .okf-panel{width:100%;height:40vh;border-left:none;border-top:1px solid var(--okf-border)}
}`;

export const GRAPH_JS = `(function(){
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var TYPE_COLORS = ${JSON.stringify(TYPE_COLORS)};

  // ── DOM refs ────────────────────────────────────────────────────────────
  var stage = document.querySelector('.okf-stage');
  var panel = document.getElementById('okf-panel');
  var statusEl = document.querySelector('.okf-title .okf-sub');
  var searchInput = document.querySelector('.okf-search input');
  var zoomIn = document.querySelector('[data-zoom="in"]');
  var zoomOut = document.querySelector('[data-zoom="out"]');
  var zoomReset = document.querySelector('[data-zoom="reset"]');
  if (!stage || !panel) return;

  function setStatus(text) { if (statusEl) statusEl.textContent = text; }

  // ── security: scheme allow-list for hrefs (matches old behaviour) ──────
  function safeHref(u) {
    if (!u) return '#';
    if (/^(?:https?|mailto|tel|repo|dashboard|docs|wp-admin):/i.test(u)) return u;
    if (u.charAt(0) === '/') return u;
    return '#';
  }

  // ── data prep ───────────────────────────────────────────────────────────
  function prepareData(raw) {
    var nodes = (raw.nodes || []).map(function (n) {
      return Object.assign({}, n, { x: 0, y: 0, vx: 0, vy: 0 });
    });
    var index = {};
    nodes.forEach(function (n) { index[n.id] = n; });

    var links = (raw.links || [])
      .map(function (l) {
        var s = (typeof l.source === 'object') ? l.source.id : l.source;
        var t = (typeof l.target === 'object') ? l.target.id : l.target;
        return { source: s, target: t };
      })
      .filter(function (l) {
        return index[l.source] && index[l.target] && l.source !== l.target;
      });

    // degree for node sizing
    var degree = {};
    links.forEach(function (l) {
      degree[l.source] = (degree[l.source] || 0) + 1;
      degree[l.target] = (degree[l.target] || 0) + 1;
    });
    nodes.forEach(function (n) { n.degree = degree[n.id] || 0; });

    // adjacency for hover highlight
    var adj = {};
    links.forEach(function (l) {
      (adj[l.source] = adj[l.source] || []).push(l.target);
      (adj[l.target] = adj[l.target] || []).push(l.source);
    });
    return { nodes: nodes, links: links, index: index, adj: adj };
  }

  // ── force simulation (charge + link + center + collide) ─────────────────
  function createSimulation(data, width, height) {
    var nodes = data.nodes, links = data.links;
    var cx = width / 2, cy = height / 2;
    var LINK_DIST = 90, LINK_STRENGTH = 0.4;
    var CHARGE = -260, COLLIDE_PAD = 6;
    var alpha = 1, alphaDecay = 0.022;
    var minAlpha = 0.001, velDecay = 0.4;
    var running = true;
    var tickFn = null, onEndFn = null;

    // initial circular layout — stable starting point, no random jitter
    nodes.forEach(function (n, i) {
      var angle = (i / Math.max(1, nodes.length)) * Math.PI * 2;
      var radius = Math.min(width, height) * 0.35;
      n.x = cx + Math.cos(angle) * radius;
      n.y = cy + Math.sin(angle) * radius;
    });

    function step() {
      if (alpha < minAlpha) {
        alpha = 0;
        running = false;
        if (onEndFn) onEndFn();
        return;
      }
      // center pull
      nodes.forEach(function (n) {
        n.vx += (cx - n.x) * 0.01 * alpha;
        n.vy += (cy - n.y) * 0.01 * alpha;
      });
      // pairwise charge repulsion (O(n^2) — fine up to ~200 nodes)
      for (var i = 0; i < nodes.length; i++) {
        var a = nodes[i];
        for (var j = i + 1; j < nodes.length; j++) {
          var b = nodes[j];
          var dx = a.x - b.x, dy = a.y - b.y;
          var d2 = dx * dx + dy * dy || 0.01;
          var d = Math.sqrt(d2);
          var force = (CHARGE * alpha) / d2;
          var fx = (dx / d) * force, fy = (dy / d) * force;
          a.vx += fx; a.vy += fy;
          b.vx -= fx; b.vy -= fy;
        }
      }
      // link springs
      links.forEach(function (l) {
        var s = data.index[l.source], t = data.index[l.target];
        if (!s || !t) return;
        var dx = t.x - s.x, dy = t.y - s.y;
        var d = Math.sqrt(dx * dx + dy * dy) || 0.01;
        var diff = (d - LINK_DIST) / d * LINK_STRENGTH * alpha;
        var fx = dx * diff, fy = dy * diff;
        s.vx += fx; s.vy += fy;
        t.vx -= fx; t.vy -= fy;
      });
      // collide (resolve overlap)
      for (var k = 0; k < nodes.length; k++) {
        var p = nodes[k];
        var pr = (6 + Math.min(8, p.degree)) + COLLIDE_PAD;
        for (var m = k + 1; m < nodes.length; m++) {
          var q = nodes[m];
          var qr = (6 + Math.min(8, q.degree)) + COLLIDE_PAD;
          var dx2 = p.x - q.x, dy2 = p.y - q.y;
          var d22 = Math.sqrt(dx2 * dx2 + dy2 * dy2) || 0.01;
          var min = pr + qr;
          if (d22 < min) {
            var push = (min - d22) / d22 * 0.5 * alpha;
            p.x += dx2 * push; p.y += dy2 * push;
            q.x -= dx2 * push; q.y -= dy2 * push;
          }
        }
      }
      // integrate + damp + clamp
      nodes.forEach(function (n) {
        n.vx *= (1 - velDecay); n.vy *= (1 - velDecay);
        n.x += n.vx; n.y += n.vy;
        var r = 12;
        if (n.x < r) { n.x = r; n.vx *= -0.5; }
        if (n.x > width - r) { n.x = width - r; n.vx *= -0.5; }
        if (n.y < r) { n.y = r; n.vy *= -0.5; }
        if (n.y > height - r) { n.y = height - r; n.vy *= -0.5; }
      });
      alpha -= alphaDecay;
      if (tickFn) tickFn();
      if (running) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);

    return {
      stop: function () { running = false; },
      restart: function () {
        running = true; alpha = 1;
        requestAnimationFrame(step);
      },
      alpha: function () { return alpha; },
      onTick: function (fn) { tickFn = fn; },
      onEnd: function (fn) { onEndFn = fn; },
      dragTo: function (n, x, y) { n.fx = x; n.fy = y; n.x = x; n.y = y; },
      unfix: function (n) { n.fx = null; n.fy = null; },
      data: data
    };
  }

  // ── render ──────────────────────────────────────────────────────────────
  function render(data) {
    if (!data.nodes.length) {
      setStatus('No concepts to graph yet.');
      renderEmptyPanel();
      return;
    }

    // legend
    var legend = document.querySelector('.okf-legend ul');
    if (legend) {
      legend.textContent = '';
      var present = {};
      data.nodes.forEach(function (n) { present[n.type || 'concept'] = true; });
      Object.keys(present).sort().forEach(function (t) {
        var li = document.createElement('li');
        var dot = document.createElement('span');
        dot.className = 'dot';
        dot.style.background = TYPE_COLORS[t] || '#6b7280';
        li.appendChild(dot);
        li.appendChild(document.createTextNode(t));
        legend.appendChild(li);
      });
    }

    // SVG skeleton
    stage.textContent = '';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    stage.appendChild(svg);

    var defs = document.createElementNS(NS, 'defs');
    defs.innerHTML =
      '<marker id="okf-arrow" viewBox="0 0 10 10" refX="9" refY="5" ' +
      'markerWidth="5" markerHeight="5" orient="auto-start-reverse">' +
      '<path d="M0,0 L10,5 L0,10 Z" fill="currentColor"/></marker>';
    svg.appendChild(defs);

    var gRoot = document.createElementNS(NS, 'g');
    svg.appendChild(gRoot);
    var gLinks = document.createElementNS(NS, 'g');
    gLinks.setAttribute('class', 'links');
    var gNodes = document.createElementNS(NS, 'g');
    gNodes.setAttribute('class', 'nodes');
    var gLabels = document.createElementNS(NS, 'g');
    gLabels.setAttribute('class', 'labels');
    gRoot.appendChild(gLinks);
    gRoot.appendChild(gNodes);
    gRoot.appendChild(gLabels);

    var linkEls = [], nodeEls = [], labelEls = [];
    data.links.forEach(function (l) {
      var el = document.createElementNS(NS, 'line');
      el.setAttribute('class', 'link');
      el.setAttribute('marker-end', 'url(#okf-arrow)');
      gLinks.appendChild(el);
      linkEls.push({ el: el, link: l });
    });
    data.nodes.forEach(function (n) {
      var el = document.createElementNS(NS, 'circle');
      el.setAttribute('class', 'node');
      el.setAttribute('fill', TYPE_COLORS[n.type] || '#6b7280');
      el.setAttribute('r', 6 + Math.min(8, n.degree));
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        showDetail(n);
      });
      gNodes.appendChild(el);
      var lbl = document.createElementNS(NS, 'text');
      lbl.setAttribute('class', 'label');
      lbl.textContent = n.title || n.id;
      gLabels.appendChild(lbl);
      labelEls.push({ el: lbl, node: n });

      // hover → highlight neighbours
      el.addEventListener('mouseenter', function () {
        svg.classList.add('node-hover');
        var neighbours = new Set([n.id].concat(data.adj[n.id] || []));
        nodeEls.forEach(function (entry) {
          entry.el.classList.toggle('faded', !neighbours.has(entry.node.id));
        });
        labelEls.forEach(function (entry) {
          entry.el.classList.toggle('faded', !neighbours.has(entry.node.id));
        });
        linkEls.forEach(function (entry) {
          var active = (entry.link.source === n.id || entry.link.target === n.id);
          entry.el.classList.toggle('active', !!active);
          entry.el.classList.toggle('link-faded', !active);
        });
      });
      el.addEventListener('mouseleave', function () {
        svg.classList.remove('node-hover');
        nodeEls.forEach(function (entry) { entry.el.classList.remove('faded'); });
        labelEls.forEach(function (entry) { entry.el.classList.remove('faded'); });
        linkEls.forEach(function (entry) {
          entry.el.classList.remove('active');
          entry.el.classList.remove('link-faded');
        });
      });

      nodeEls.push({ el: el, node: n });
    });

    // zoom + pan
    var transform = { x: 0, y: 0, k: 1 };
    function applyTransform() {
      gRoot.setAttribute('transform',
        'translate(' + transform.x + ',' + transform.y + ') scale(' + transform.k + ')');
    }
    function zoom(delta, cx, cy) {
      var k = transform.k * (delta > 0 ? 1.2 : 1 / 1.2);
      k = Math.max(0.2, Math.min(4, k));
      // zoom around (cx, cy) in stage coords
      transform.x = cx - (cx - transform.x) * (k / transform.k);
      transform.y = cy - (cy - transform.y) * (k / transform.k);
      transform.k = k;
      applyTransform();
    }
    svg.addEventListener('wheel', function (e) {
      e.preventDefault();
      var rect = svg.getBoundingClientRect();
      zoom(e.deltaY < 0 ? 1 : -1, e.clientX - rect.left, e.clientY - rect.top);
    }, { passive: false });
    if (zoomIn) zoomIn.addEventListener('click', function () {
      var r = svg.getBoundingClientRect();
      zoom(1, r.width / 2, r.height / 2);
    });
    if (zoomOut) zoomOut.addEventListener('click', function () {
      var r = svg.getBoundingClientRect();
      zoom(-1, r.width / 2, r.height / 2);
    });
    if (zoomReset) zoomReset.addEventListener('click', function () {
      transform.x = 0; transform.y = 0; transform.k = 1;
      applyTransform();
    });

    // pan (drag empty space)
    var pan = null;
    svg.addEventListener('pointerdown', function (e) {
      if (e.target.closest('circle.node')) return;
      pan = { x: e.clientX - transform.x, y: e.clientY - transform.y };
      svg.classList.add('dragging');
      svg.setPointerCapture(e.pointerId);
    });
    svg.addEventListener('pointermove', function (e) {
      if (!pan) return;
      transform.x = e.clientX - pan.x;
      transform.y = e.clientY - pan.y;
      applyTransform();
    });
    svg.addEventListener('pointerup', function (e) {
      pan = null; svg.classList.remove('dragging');
      try { svg.releasePointerCapture(e.pointerId); } catch (_) {}
    });

    // drag a node to pin it (double-click releases)
    nodeEls.forEach(function (entry) {
      var dragging = null;
      entry.el.addEventListener('pointerdown', function (e) {
        e.stopPropagation();
        dragging = { id: e.pointerId, node: entry.node };
        entry.el.setPointerCapture(e.pointerId);
      });
      entry.el.addEventListener('pointermove', function (e) {
        if (!dragging) return;
        var pt = svg.createSVGPoint();
        pt.x = e.clientX; pt.y = e.clientY;
        var ctm = gRoot.getScreenCTM();
        if (!ctm) return;
        var inv = ctm.inverse();
        var local = pt.matrixTransform(inv);
        entry.node.fx = local.x;
        entry.node.fy = local.y;
        entry.node.x = local.x;
        entry.node.y = local.y;
        sim && sim.restart();
      });
      entry.el.addEventListener('pointerup', function (e) {
        if (!dragging) return;
        try { entry.el.releasePointerCapture(e.pointerId); } catch (_) {}
        dragging = null;
        // keep pinned until dblclick (lets users arrange the graph)
      });
      entry.el.addEventListener('dblclick', function (e) {
        e.stopPropagation();
        entry.node.fx = null; entry.node.fy = null;
        sim && sim.restart();
      });
    });

    // sizing + simulation
    function resize() {
      var rect = svg.getBoundingClientRect();
      svg.setAttribute('viewBox', '0 0 ' + rect.width + ' ' + rect.height);
      return { w: rect.width, h: rect.height };
    }
    var size = resize();
    var sim = createSimulation(data, size.w, size.h);

    sim.onTick(function () {
      for (var i = 0; i < linkEls.length; i++) {
        var le = linkEls[i], l = le.link;
        var s = data.index[l.source], t = data.index[l.target];
        if (!s || !t) continue;
        le.el.setAttribute('x1', s.x); le.el.setAttribute('y1', s.y);
        le.el.setAttribute('x2', t.x); le.el.setAttribute('y2', t.y);
      }
      for (var j = 0; j < nodeEls.length; j++) {
        var ne = nodeEls[j];
        ne.el.setAttribute('cx', ne.node.x);
        ne.el.setAttribute('cy', ne.node.y);
      }
      for (var k2 = 0; k2 < labelEls.length; k2++) {
        var lb = labelEls[k2];
        var r = 6 + Math.min(8, lb.node.degree);
        lb.el.setAttribute('x', lb.node.x);
        lb.el.setAttribute('y', lb.node.y - r - 4);
      }
    });
    sim.onEnd(function () { setStatus(data.nodes.length + ' concepts · click for details · scroll to zoom'); });

    window.addEventListener('resize', function () {
      size = resize();
      // recenter & keep zoom factor
      applyTransform();
      sim.restart();
    });

    // ── search ────────────────────────────────────────────────────────────
    if (searchInput) {
      searchInput.addEventListener('input', function () {
        var q = searchInput.value.trim().toLowerCase();
        if (!q) {
          nodeEls.forEach(function (e) { e.el.classList.remove('faded'); e.el.style.display = ''; });
          labelEls.forEach(function (e) { e.el.classList.remove('faded'); e.el.style.display = ''; });
          linkEls.forEach(function (e) {
            e.el.classList.remove('active');
            e.el.classList.remove('link-faded');
            e.el.style.display = '';
          });
          return;
        }
        var match = data.nodes.filter(function (n) {
          return (n.title || n.id).toLowerCase().indexOf(q) >= 0
              || (n.type || '').toLowerCase().indexOf(q) >= 0;
        });
        var matchedIds = new Set(match.map(function (n) { return n.id; }));
        nodeEls.forEach(function (e) {
          if (matchedIds.has(e.node.id)) {
            e.el.classList.remove('faded'); e.el.style.display = '';
          } else {
            e.el.classList.add('faded'); e.el.style.display = '';
          }
        });
        labelEls.forEach(function (e) {
          e.el.style.display = matchedIds.has(e.node.id) ? '' : 'none';
        });
        linkEls.forEach(function (e) {
          var visible = matchedIds.has(e.link.source) && matchedIds.has(e.link.target);
          e.el.style.display = visible ? '' : 'none';
        });
      });
    }

    // default panel
    renderEmptyPanel();
  }

  function renderEmptyPanel() {
    while (panel.firstChild) panel.removeChild(panel.firstChild);
    var p = document.createElement('p');
    p.className = 'okf-empty';
    p.textContent = 'Click a node to see details.';
    panel.appendChild(p);
  }

  // ── panel: render node details without innerHTML ────────────────────────
  function showDetail(n) {
    while (panel.firstChild) panel.removeChild(panel.firstChild);

    var h = document.createElement('h2');
    h.textContent = n.title || n.id;
    panel.appendChild(h);

    var type = document.createElement('span');
    type.className = 'okf-type';
    type.textContent = n.type || 'concept';
    panel.appendChild(type);

    var desc = document.createElement('p');
    if (n.description) {
      desc.textContent = n.description;
    } else {
      var em = document.createElement('span');
      em.className = 'okf-empty';
      em.textContent = 'No description.';
      desc.appendChild(em);
    }
    panel.appendChild(desc);

    var meta = document.createElement('div');
    meta.className = 'okf-meta';
    if (n.path) {
      var s1 = document.createElement('span');
      s1.textContent = 'path: ' + n.path;
      meta.appendChild(s1);
    }
    if (typeof n.degree === 'number') {
      var s2 = document.createElement('span');
      s2.textContent = 'connections: ' + n.degree;
      meta.appendChild(s2);
    }
    if (meta.childNodes.length) panel.appendChild(meta);

    var actions = document.createElement('div');
    var a1 = document.createElement('a');
    a1.className = 'okf-btn';
    a1.href = 'concepts/' + encodeURIComponent(n.id) + '.md';
    a1.target = '_blank'; a1.rel = 'noopener noreferrer';
    a1.textContent = 'Open in OKF bundle';
    actions.appendChild(a1);
    if (n.source) {
      var a2 = document.createElement('a');
      a2.className = 'okf-btn';
      a2.href = safeHref(n.source);
      a2.target = '_blank'; a2.rel = 'noopener noreferrer';
      a2.textContent = 'Open source page';
      actions.appendChild(a2);
    }
    panel.appendChild(actions);

    // neighbours
    var neighbours = (window.__okfAdj && window.__okfAdj[n.id]) || [];
    if (neighbours.length) {
      var section = document.createElement('div');
      section.className = 'okf-section';
      var h3 = document.createElement('h3');
      h3.textContent = 'Connected to';
      section.appendChild(h3);
      var ul = document.createElement('ul');
      ul.className = 'okf-conn-list';
      neighbours.forEach(function (id) {
        var node = window.__okfIndex && window.__okfIndex[id];
        if (!node) return;
        var li = document.createElement('li');
        var btn = document.createElement('button');
        btn.textContent = node.title || node.id;
        btn.addEventListener('click', function () { showDetail(node); });
        li.appendChild(btn);
        var typ = document.createElement('span');
        typ.className = 'okf-conn-type';
        typ.textContent = node.type || '';
        li.appendChild(typ);
        ul.appendChild(li);
      });
      section.appendChild(ul);
      panel.appendChild(section);
    }
  }

  // ── boot ────────────────────────────────────────────────────────────────
  var embedded = window.OKF_GRAPH;
  if (embedded) {
    var data = prepareData(embedded);
    window.__okfAdj = data.adj;
    window.__okfIndex = data.index;
    render(data);
    return;
  }
  setStatus('Loading graph…');
  fetch('graph.json', { cache: 'no-store' })
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (raw) {
      var data = prepareData(raw || { nodes: [], links: [] });
      window.__okfAdj = data.adj;
      window.__okfIndex = data.index;
      render(data);
    })
    .catch(function (err) {
      setStatus('Failed to load graph data: ' + err.message);
    });
})();`;

export function graphHtml(name: string, count: number): string {
  // The HTML body is a fixed shell; user-supplied content only flows in
  // via textContent in graph.js — no innerHTML injection surface.
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${name} — OKF Graph</title>
  <link rel="stylesheet" href="graph.css">
</head>
<body>
  <div class="okf-app">
    <div class="okf-stage">
      <div class="okf-toolbar">
        <div class="okf-title">
          <h1>${name}</h1>
          <div class="okf-sub">${count} concepts · Open Knowledge Format graph</div>
        </div>
        <label class="okf-search">
          <input type="search" placeholder="Search concepts…" aria-label="Search concepts">
        </label>
      </div>
      <div class="okf-legend">
        <h3>Types</h3>
        <ul></ul>
      </div>
      <div class="okf-controls">
        <button type="button" data-zoom="in" title="Zoom in" aria-label="Zoom in">+</button>
        <button type="button" data-zoom="out" title="Zoom out" aria-label="Zoom out">−</button>
        <button type="button" data-zoom="reset" title="Reset view" aria-label="Reset view">⌖</button>
      </div>
    </div>
    <aside class="okf-panel" id="okf-panel"></aside>
  </div>
  <script src="graph.js"></script>
</body>
</html>`;
}