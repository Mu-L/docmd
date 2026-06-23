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

/**
 * Sanitise HTML returned by plugin `generateMetaTags` before injection into
 * <head>. The plugin trust model says: plugins are npm-installed and audited.
 * This helper provides a second line of defence so a compromised or buggy
 * plugin cannot inject active content into every page. Phase 1.B (T-S7 fix).
 *
 * Strips:
 *   - <script>...</script> blocks (matches open/close pair, case-insensitive)
 *   - <style>...</style> blocks (active CSS injection; styles should ship via assets)
 *   - javascript:/vbscript: URIs in href/src of real HTML tags
 *
 * Intentionally NOT a general-purpose HTML sanitizer. The on*=event-handler
 * stripping pattern was tried and removed: regex can't reliably distinguish a
 * real `onclick="..."` attribute from attrEsc-escaped text like
 * `content="&lt;img onerror=alert(1)&gt;"` (the literal sequence ` onerror=`
 * matches in both cases). Plugin authors are responsible for not emitting
 * event handlers; the trust model + sanitised <script>/<style>/URI removal is
 * the structural fence.
 */
export function sanitizeHeadInjection(html: string): string {
  if (typeof html !== 'string' || html.length === 0) return '';
  let out = html;
  // Strip <script>...</script> blocks
  out = out.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '');
  // Strip <style>...</style> blocks
  out = out.replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '');
  // Neutralise javascript: / vbscript: URIs in href / src attributes.
  // The pattern requires a real opening tag followed by attribute list, so
  // escaped text like "&lt;a href=javascript:...&gt;" is not affected.
  out = out.replace(
    /(<[a-z][a-z0-9]*\b[^>]*?\s(?:href|src))\s*=\s*"javascript:[^"]*"/gi,
    '$1="#"'
  );
  out = out.replace(
    /(<[a-z][a-z0-9]*\b[^>]*?\s(?:href|src))\s*=\s*'javascript:[^']*'/gi,
    "$1='#'"
  );
  out = out.replace(
    /(<[a-z][a-z0-9]*\b[^>]*?\s(?:href|src))\s*=\s*"vbscript:[^"]*"/gi,
    '$1="#"'
  );
  out = out.replace(
    /(<[a-z][a-z0-9]*\b[^>]*?\s(?:href|src))\s*=\s*'vbscript:[^']*'/gi,
    "$1='#'"
  );
  return out;
}