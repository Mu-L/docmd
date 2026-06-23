// html-escape.ts — centralised escape helpers for safe HTML / JSON / JS-literal interpolation.
// Used across the docmd monorepo to prevent XSS (CWE-79). See DEVELOPMENT-BENCHMARK.md S2.

export function escHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function attrEsc(value: unknown): string {
  return escHtml(value);
}

export function jsonInject(value: unknown): string {
  return JSON.stringify(value);
}

export function scriptLiteral(value: unknown): string {
  return JSON.stringify(value);
}