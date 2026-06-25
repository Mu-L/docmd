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
 * Stylesheet for the OKF graph viewer.
 *
 * Design goals:
 *   - Flat surfaces, no gradients, no drop shadows on the canvas.
 *   - Hairline (1px) borders instead of fills or shadows for separation.
 *   - Type colour palette matches the type system: each OKF concept
 *     type gets a calm, distinct hue. Saturation is held back so
 *     dozens of nodes don't visually fight each other.
 *   - Dark mode uses pure neutral surfaces — no tinted "panel" colour
 *     that drifts away from the canvas and breaks the illusion of
 *     a single workspace.
 *
 * The viewer ships as a single stylesheet inline in the HTML so
 * nothing needs to be served separately.
 */

export const GRAPH_CSS = `/* ─────────────────────────────────────────────────────────────────
   OKF graph viewer — minimal, flat, hairline-bordered
   ────────────────────────────────────────────────────────────── */

:root {
  /* Light */
  --okf-bg:           #ffffff;
  --okf-fg:           #0f172a;
  --okf-muted:        #64748b;
  --okf-border:       #e2e8f0;
  --okf-border-soft:  #f1f5f9;
  --okf-link:         #cbd5e1;
  --okf-link-active:  #0f172a;
  --okf-node-stroke:  #ffffff;
  --okf-faded:        #f1f5f9;
  --okf-accent:       #4f46e5;
  --okf-accent-soft:  #eef2ff;
  --okf-input-bg:     #ffffff;
}

@media (prefers-color-scheme: dark) {
  :root {
    --okf-bg:           #0a0a0a;
    --okf-fg:           #f5f5f5;
    --okf-muted:        #a1a1aa;
    --okf-border:       #27272a;
    --okf-border-soft:  #18181b;
    --okf-link:         #3f3f46;
    --okf-link-active:  #f5f5f5;
    --okf-node-stroke:  #0a0a0a;
    --okf-faded:        #18181b;
    --okf-accent:       #a5b4fc;
    --okf-accent-soft:  #1e1b4b;
    --okf-input-bg:     #18181b;
  }
}

* { box-sizing: border-box; }
html, body {
  margin: 0; height: 100%; overflow: hidden;
  font: 14px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  color: var(--okf-fg);
  background: var(--okf-bg);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.okf-app { display: flex; height: 100vh; }

/* ── Stage ────────────────────────────────────────────────────── */

.okf-stage {
  position: relative;
  flex: 1; min-width: 0;
  overflow: hidden;
  background: var(--okf-bg);
}
.okf-stage svg { display: block; width: 100%; height: 100%; cursor: grab; }
.okf-stage svg.dragging { cursor: grabbing; }
.okf-stage svg.node-hover { cursor: pointer; }

/* ── Toolbar (title + search) — floating chip ─────────────────── */

.okf-toolbar {
  position: absolute; top: 16px; left: 16px; right: 16px;
  display: flex; align-items: center; gap: 12px;
  z-index: 10; pointer-events: none;
}
.okf-toolbar > * { pointer-events: auto; }

.okf-title { flex: 1; min-width: 0; }
.okf-title h1 {
  margin: 0;
  font-size: 13px; font-weight: 600;
  letter-spacing: -0.01em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.okf-title .okf-sub {
  font-size: 11px;
  color: var(--okf-muted);
  margin-top: 2px;
}

.okf-search { position: relative; flex: 0 1 260px; }
.okf-search input {
  width: 100%;
  padding: 7px 10px 7px 30px;
  font: inherit; font-size: 13px;
  color: var(--okf-fg);
  background: var(--okf-input-bg);
  border: 1px solid var(--okf-border);
  border-radius: 6px;
  outline: none;
  transition: border-color .12s, box-shadow .12s;
}
.okf-search input::placeholder { color: var(--okf-muted); }
.okf-search input:focus {
  border-color: var(--okf-accent);
  box-shadow: 0 0 0 3px var(--okf-accent-soft);
}
.okf-search::before {
  content: ""; position: absolute;
  left: 9px; top: 50%; transform: translateY(-50%);
  width: 14px; height: 14px;
  background: currentColor; opacity: .4;
  -webkit-mask: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='11' cy='11' r='7'/><path d='m21 21-4.3-4.3'/></svg>") center/contain no-repeat;
          mask: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='11' cy='11' r='7'/><path d='m21 21-4.3-4.3'/></svg>") center/contain no-repeat;
  pointer-events: none;
}

/* ── Legend — flat dots, single column, low contrast ───────────── */

.okf-legend {
  position: absolute; bottom: 16px; left: 16px;
  z-index: 5;
  font-size: 11px;
  color: var(--okf-muted);
  padding: 8px 10px;
  background: var(--okf-bg);
  border: 1px solid var(--okf-border);
  border-radius: 6px;
  max-width: 200px;
}
.okf-legend h3 { display: none; } /* implicit from layout */
.okf-legend ul {
  list-style: none; margin: 0; padding: 0;
  display: flex; flex-direction: column; gap: 4px;
}
.okf-legend li { display: flex; align-items: center; gap: 8px; }
.okf-legend .dot {
  width: 8px; height: 8px; border-radius: 50%;
  display: inline-block; flex-shrink: 0;
}

/* ── Zoom controls — ghost buttons ────────────────────────────── */

.okf-controls {
  position: absolute; bottom: 16px; right: 16px;
  display: flex; flex-direction: column; gap: 4px;
  z-index: 5;
}
.okf-controls button {
  width: 30px; height: 30px;
  background: var(--okf-bg);
  border: 1px solid var(--okf-border);
  border-radius: 6px;
  color: var(--okf-muted);
  font-size: 15px; line-height: 1;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: color .12s, border-color .12s;
}
.okf-controls button:hover {
  color: var(--okf-fg);
  border-color: var(--okf-fg);
}
.okf-controls button:active { transform: scale(.95); }

/* ── Graph primitives — flat, no glow ─────────────────────────── */

.okf-graph circle.node {
  cursor: pointer;
  stroke: var(--okf-node-stroke);
  stroke-width: 1.5;
  transition: stroke-width .12s, opacity .15s;
}
.okf-graph circle.node:hover { stroke-width: 2.5; }

.okf-graph text.label {
  font-size: 10.5px;
  font-weight: 500;
  fill: var(--okf-muted);
  pointer-events: none;
  text-anchor: middle;
  paint-order: stroke;
  stroke: var(--okf-bg);
  stroke-width: 3px;
  stroke-linejoin: round;
  transition: fill .12s, opacity .15s;
}
.okf-graph circle.node:hover + text.label,
.okf-graph .node-group:hover text.label { fill: var(--okf-fg); }

.okf-graph line.link {
  stroke: var(--okf-link);
  stroke-width: 1;
  transition: stroke .15s, stroke-opacity .15s;
}
.okf-graph line.link.active {
  stroke: var(--okf-link-active);
  stroke-width: 1.25;
}
.okf-graph .faded { opacity: .15; }
.okf-graph .link-faded { stroke: var(--okf-faded); }

/* ── Side panel — flat, hairline-bordered ─────────────────────── */

.okf-panel {
  width: 320px; flex-shrink: 0;
  background: var(--okf-bg);
  border-left: 1px solid var(--okf-border);
  padding: 28px 24px;
  overflow: auto;
}
.okf-panel h2 {
  margin: 0 0 6px;
  font-size: 16px; font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.3;
}
.okf-panel .okf-type {
  display: inline-block;
  font-size: 10px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.06em;
  padding: 2px 7px;
  border-radius: 4px;
  background: var(--okf-accent-soft);
  color: var(--okf-accent);
  margin-bottom: 14px;
}
.okf-panel p {
  margin: 0 0 16px;
  font-size: 13px;
  color: var(--okf-fg);
  line-height: 1.55;
}
.okf-panel .okf-empty {
  color: var(--okf-muted);
  font-style: italic;
}
.okf-panel .okf-meta {
  font-size: 11.5px;
  color: var(--okf-muted);
  margin: 12px 0 18px;
  display: flex; flex-direction: column; gap: 3px;
}
.okf-panel .okf-meta span {
  font-variant-numeric: tabular-nums;
}

.okf-panel a.okf-btn {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 12px; font-weight: 500;
  color: var(--okf-fg);
  text-decoration: none;
  padding: 6px 10px;
  border: 1px solid var(--okf-border);
  border-radius: 6px;
  background: transparent;
  margin-right: 6px; margin-bottom: 6px;
  transition: border-color .12s, color .12s;
}
.okf-panel a.okf-btn:hover {
  border-color: var(--okf-fg);
}

.okf-panel .okf-section {
  margin-top: 22px;
  padding-top: 18px;
  border-top: 1px solid var(--okf-border-soft);
}
.okf-panel .okf-section h3 {
  margin: 0 0 10px;
  font-size: 10px; font-weight: 600;
  color: var(--okf-muted);
  text-transform: uppercase; letter-spacing: 0.06em;
}
.okf-panel .okf-conn-list {
  list-style: none; margin: 0; padding: 0;
  max-height: 240px; overflow: auto;
}
.okf-panel .okf-conn-list li {
  display: flex; align-items: center; justify-content: space-between;
  gap: 8px;
  padding: 5px 0;
  border-bottom: 1px solid var(--okf-border-soft);
  font-size: 12.5px;
}
.okf-panel .okf-conn-list li:last-child { border-bottom: none; }
.okf-panel .okf-conn-list button {
  background: none; border: none;
  color: var(--okf-fg); cursor: pointer;
  font: inherit; padding: 0;
  text-align: left;
  flex: 1; min-width: 0;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.okf-panel .okf-conn-list button:hover { color: var(--okf-accent); }
.okf-panel .okf-conn-list .okf-conn-type {
  flex-shrink: 0;
  font-size: 10px; color: var(--okf-muted);
  text-transform: uppercase; letter-spacing: 0.04em;
}

/* ── Responsive: panel goes under on narrow viewports ─────────── */

@media (max-width: 720px) {
  .okf-app { flex-direction: column; }
  .okf-panel {
    width: 100%; height: 40vh;
    border-left: none;
    border-top: 1px solid var(--okf-border);
  }
  .okf-toolbar { right: 12px; left: 12px; }
  .okf-legend, .okf-controls { display: none; }
}`;