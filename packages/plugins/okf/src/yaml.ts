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
 * Minimal YAML serialiser for the OKF manifest. OKF doesn't need a
 * full YAML 1.2 implementation — only maps, sequences, scalars, and
 * the indentation rules. Hand-rolling keeps the bundle zero-dep.
 */

function yamlQuote(s: any): string {
  const v = s === null || s === undefined ? '' : String(s);
  if (/^[a-zA-Z0-9_\-\.\/]+$/.test(v) && v !== '') return v;
  return '"' + v.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

export function toYaml(obj: any, indent = 0): string {
  const pad = '  '.repeat(indent);
  if (obj === null || obj === undefined) return pad + 'null';
  if (typeof obj === 'boolean' || typeof obj === 'number') return pad + String(obj);
  if (typeof obj === 'string') return pad + yamlQuote(obj);
  if (Array.isArray(obj)) {
    if (!obj.length) return pad + '[]';
    return obj.map(item => {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const inner = toYaml(item, indent + 1).trimStart();
        return pad + '- ' + inner;
      }
      return pad + '- ' + (typeof item === 'string' ? yamlQuote(item) : String(item));
    }).join('\n');
  }
  if (typeof obj === 'object') {
    const lines: string[] = [];
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      const isComplex = v && typeof v === 'object';
      if (isComplex && (Array.isArray(v) ? v.length : Object.keys(v).length)) {
        lines.push(`${pad}${k}:`);
        lines.push(toYaml(v, indent + 1));
      } else {
        lines.push(`${pad}${k}: ${v === null || v === undefined ? 'null' : (typeof v === 'string' ? yamlQuote(v) : String(v))}`);
      }
    }
    return lines.join('\n');
  }
  return pad + String(obj);
}

/**
 * Serialises a concept's frontmatter block into a YAML string ready to
 * be joined with a `---` fence. Handles arrays, nested objects, and
 * nullish scalars uniformly. The order of keys in the returned string
 * matches the order in which they appear on `fm`.
 */
export function serializeConceptFrontmatter(fm: Record<string, any>): string {
  const lines: string[] = [];
  for (const k of Object.keys(fm)) {
    const v = fm[k];
    if (Array.isArray(v)) {
      if (!v.length) { lines.push(`${k}: []`); continue; }
      lines.push(`${k}:`);
      for (const it of v) lines.push(`  - ${typeof it === 'string' ? yamlQuote(it) : String(it)}`);
    } else if (v && typeof v === 'object') {
      lines.push(`${k}:`);
      for (const kk of Object.keys(v)) lines.push(`  ${kk}: ${typeof v[kk] === 'string' ? yamlQuote(v[kk]) : String(v[kk])}`);
    } else if (v === null || v === undefined) {
      lines.push(`${k}:`);
    } else {
      lines.push(`${k}: ${typeof v === 'string' ? yamlQuote(v) : String(v)}`);
    }
  }
  return lines.join('\n');
}