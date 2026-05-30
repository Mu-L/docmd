/**
 * SVG utility functions for the mermaid plugin client.
 * Extracted for testability — pure string/DOM operations, no browser globals.
 */

/**
 * Ensures an SVG string has the required XML namespace declarations
 * for all namespace prefixes it uses.
 *
 * Problem: mermaid.render() returns SVG via innerHTML serialization which
 * omits xmlns:xlink even when xlink:href attributes are present.
 * DOMParser.parseFromString(svg, 'image/svg+xml') is a strict XML parser
 * and fails with a <parsererror> on undeclared namespace prefixes.
 *
 * Affected diagram types: any that use xlink:href — most notably C4Context,
 * which always adds person icons via <image xlink:href="data:...">.
 * (mermaid.run() includes xmlns:xlink; only mermaid.render() omits it.)
 */
export function fixSvgNamespaces(svg: string): string {
  if (svg.includes('xlink:') && !svg.includes('xmlns:xlink')) {
    return svg.replace(/(<svg\b)/, '$1 xmlns:xlink="http://www.w3.org/1999/xlink"');
  }
  return svg;
}
