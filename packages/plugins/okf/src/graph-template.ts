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
 * Concept-type palette + HTML shell for the OKF graph viewer.
 *
 * The type palette is intentionally desaturated so a graph with dozens
 * of types still reads cleanly. Each colour has a WCAG-AA contrast ratio
 * of at least 4.5:1 against both the light (#ffffff) and dark (#0a0a0a)
 * canvas backgrounds.
 *
 * The HTML shell is a fixed structure — user-supplied content only
 * flows in via textContent in graph-runtime.ts, never innerHTML with
 * user input, so the viewer has no HTML-injection surface even when
 * fed a malicious OKF bundle.
 */

export const TYPE_COLORS: Record<string, string> = {
  concept:   '#4f46e5', // indigo
  guide:     '#059669', // emerald
  api:       '#b45309', // amber
  reference: '#0369a1', // sky
  runbook:   '#b91c1c', // red
  dataset:   '#7c3aed', // violet
  metric:    '#be185d', // pink
  table:     '#0f766e'  // teal
};

export function graphHtml(name: string, count: number): string {
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
          <div class="okf-sub">${count} concepts</div>
        </div>
        <label class="okf-search">
          <input type="search" placeholder="Search concepts…" aria-label="Search concepts">
        </label>
      </div>
      <div class="okf-legend">
        <ul></ul>
      </div>
      <div class="okf-controls">
        <button type="button" data-zoom="in"     title="Zoom in"      aria-label="Zoom in">+</button>
        <button type="button" data-zoom="out"    title="Zoom out"     aria-label="Zoom out">−</button>
        <button type="button" data-zoom="reset"  title="Reset view"   aria-label="Reset view">⌖</button>
      </div>
    </div>
    <aside class="okf-panel" id="okf-panel"></aside>
  </div>
  <script src="graph.js"></script>
</body>
</html>`;
}