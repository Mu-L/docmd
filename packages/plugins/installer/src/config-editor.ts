/**
 * --------------------------------------------------------------------
 * docmd : the zero-config documentation engine.
 *
 * @package     @docmd/plugin-installer
 * @website     https://docmd.io
 * @repository  https://github.com/docmd-io/docmd
 * @license     MIT
 * @copyright   Copyright (c) 2025-present docmd.io
 *
 * [docmd-source] - Please do not remove this header.
 * --------------------------------------------------------------------
 */

/**
 * Config editor
 * =============
 *
 * Phase 3 PR 3.B (F7 + M-3). \`docmd add <plugin>\` and \`docmd remove
 * <plugin>\` must mutate the project's config file in a way that
 * works for every supported format:
 *
 *   - \`docmd.config.json\`     — JSON, parsed via \`JSON.parse\`.
 *   - \`docmd.config.js\`       — CJS (\`module.exports = { ... }\`).
 *   - \`docmd.config.mjs\`      — ESM (\`export default { ... }\` or
 *                                \`export default defineConfig({...})\`).
 *   - \`docmd.config.cjs\`      — CJS, same as \`.js\`.
 *   - \`docmd.config.ts\`       — TS (\`export default defineConfig({...})\`).
 *
 * The previous implementation used a single regex
 * (\`/module\\.exports\\s*=\\s*(?:defineConfig\\()?\\{...\}`) that
 * matched only the CJS pattern. For \`export default\` (TS / MJS) the
 * regex fell through silently, and the function returned \`false\`
 * ("already configured") without actually editing the file. The user
 * saw "Plugin successfully installed and activated" but the config
 * was untouched (M-3). The same bug affected \`remove\` (F7).
 *
 * This module replaces the regex with a brace-balanced scanner that:
 *
 *   1. Strips comments first (line + block) so commented-out plugin
 *      entries are not treated as live config.
 *   2. Detects the format by file extension.
 *   3. For JSON: full parse + serialise (the only correct path).
 *   4. For JS/TS/MJS/CJS: scans for the \`plugins:\` block using
 *      brace-balancing so multi-line nested objects are handled
 *      correctly. Inserts / removes the entry while preserving
 *      existing formatting (indent, trailing comma style, etc.).
 *
 * The scanner is intentionally dependency-free. The legacy regex
 * approach is preserved as a fallback (and still used for format
 * detection in \`detectConfigFormat\`); the new brace-balanced logic
 * supersedes it for the add / remove paths.
 */

/**
 * Strip line and block comments from a JS/TS config body. Used to
 * avoid matching commented-out plugin entries.
 */
function stripComments(content: string): string {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

export type ConfigFormat = 'json' | 'js' | 'ts' | 'mjs' | 'cjs';

export function detectConfigFormat(configPath: string): ConfigFormat {
  if (configPath.endsWith('.json')) return 'json';
  if (configPath.endsWith('.ts')) return 'ts';
  if (configPath.endsWith('.mjs')) return 'mjs';
  if (configPath.endsWith('.cjs')) return 'cjs';
  return 'js';
}

/**
 * Escape a string for safe use inside a RegExp.
 */
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Find the \`plugins: { ... }\` block in a JS/TS/MJS/CJS config body.
 * Uses brace-balancing to correctly handle nested objects.
 *
 * Returns the \`{ ... }\` extent (inclusive of braces) or null if no
 * plugins block exists.
 */
function findPluginsBlock(content: string): { start: number; end: number } | null {
  // Look for `plugins:` (possibly with whitespace, possibly quoted,
  // possibly with comments) followed by `{`. The `g` flag is important
  // because some configs have `theme.plugins` etc.
  // Strip comments first to avoid false matches.
  const stripped = stripComments(content);
  const re = /\bplugins\s*:\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped)) !== null) {
    const openIdx = m.index + m[0].length - 1; // index of `{`
    let depth = 0;
    for (let i = openIdx; i < stripped.length; i++) {
      const ch = stripped[i];
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) return { start: openIdx, end: i };
      } else if (ch === '"' || ch === "'" || ch === '`') {
        // Skip string literals so braces inside strings do not
        // affect the depth count.
        const quote = ch;
        i++;
        while (i < stripped.length && stripped[i] !== quote) {
          if (stripped[i] === '\\') i++; // skip escaped char
          i++;
        }
      }
    }
  }
  return null;
}

/**
 * Detect the indentation of a block's content. Returns the leading
 * whitespace of the first non-empty line inside the block.
 */
function detectIndent(inner: string): string {
  const lines = inner.split('\n');
  for (const line of lines) {
    if (line.trim() === '') continue;
    const m = line.match(/^[\t ]*/);
    return m ? m[0] : '  ';
  }
  return '  ';
}

/**
 * Add a plugin entry to the \`plugins: { ... }\` block. Returns the
 * new content, or the original content if the entry is already
 * present (in which case the caller should report "already
 * configured").
 *
 * @param content     The full config file body.
 * @param configKey   The plugin key (e.g. \`search\`, \`mermaid\`).
 * @param valueText   The value to assign, as a JS source string
 *                    (e.g. \`{}\` or \`{ theme: 'dark' }\`).
 */
export function addPluginToPluginsBlock(
  content: string,
  configKey: string,
  valueText: string
): { newContent: string; changed: boolean } {
  // Comment-aware "already configured" check.
  const stripped = stripComments(content);
  const alreadyRegex = new RegExp(
    `(?:^|[\\s,\\{])(['"\`]?)${escapeRe(configKey)}\\1\\s*:`,
    'm'
  );
  if (alreadyRegex.test(stripped)) {
    return { newContent: content, changed: false };
  }

  const block = findPluginsBlock(content);
  if (block) {
    const inner = content.slice(block.start + 1, block.end);
    const indent = detectIndent(inner) || '    ';
    const entryIndent = indent + '  ';
    const newEntry = `${entryIndent}'${configKey}': ${valueText}`;

    // Insert into the existing block. Honour trailing-comma style:
    //   { }            -> { 'search': {} }
    //   { foo }        -> { foo, 'search': {} }
    //   { foo, }       -> { foo, 'search': {} }
    const trimmed = inner.replace(/\s+$/, ''); // strip trailing whitespace
    if (trimmed.trim() === '') {
      const newInner = `\n${newEntry}\n${indent}`;
      return {
        newContent:
          content.slice(0, block.start + 1) + newInner + content.slice(block.end),
        changed: true
      };
    }
    const endsWithComma = trimmed.trimEnd().endsWith(',');
    const sep = endsWithComma ? '\n' : ',\n';
    const newInner = trimmed + sep + newEntry;
    return {
      newContent:
        content.slice(0, block.start + 1) + newInner + content.slice(block.end),
      changed: true
    };
  }

  // No `plugins:` block yet — find the top-level object and add one.
  // The top-level object can be:
  //   - JSON:                { ... }
  //   - CJS:                 module.exports = { ... }
  //   - CJS + defineConfig:  module.exports = defineConfig({ ... });
  //   - ESM:                 export default { ... }
  //   - ESM + defineConfig:  export default defineConfig({ ... });
  //   - TS + defineConfig:   export default defineConfig<UserConfig>({ ... });
  const added = addPluginsBlockToTopLevel(content, configKey, valueText);
  return { newContent: added, changed: added !== content };
}

/**
 * Find the top-level object literal in a JS/TS config and add a
 * \`plugins: { 'key': value }\` block to it. Returns the original
 * content unchanged if no top-level object can be found.
 */
function addPluginsBlockToTopLevel(
  content: string,
  configKey: string,
  valueText: string
): string {
  // Strip comments so the search isn't confused by commented-out
  // export statements.
  const stripped = stripComments(content);
  // Look for the FIRST opening `{` after an `export default` or
  // `module.exports =` keyword. We want the top-level object, not a
  // nested one.
  const exportMatch = stripped.match(
    /(?:export\s+default\s+(?:defineConfig(?:\s*<[^>]*>)?\s*)?|module\.exports\s*=\s*(?:defineConfig\s*)?)\s*\{/
  );
  if (!exportMatch) return content;
  const openIdx = (exportMatch.index ?? 0) + exportMatch[0].length - 1;

  // Brace-balance to find the matching `}`.
  let depth = 0;
  let endIdx = -1;
  for (let i = openIdx; i < stripped.length; i++) {
    const ch = stripped[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        endIdx = i;
        break;
      }
    } else if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      i++;
      while (i < stripped.length && stripped[i] !== quote) {
        if (stripped[i] === '\\') i++;
        i++;
      }
    }
  }
  if (endIdx === -1) return content;

  // Find the LAST non-whitespace, non-`}` character before `endIdx`
  // to detect if a trailing comma is already present.
  const inner = content.slice(openIdx + 1, endIdx);
  const trimmedInner = inner.replace(/\s+$/, '');
  const endsWithComma = trimmedInner.trimEnd().endsWith(',');

  // Match the indentation of the first sibling key in the object.
  const indent = detectIndent(inner) || '  ';
  const entryIndent = indent + '  ';

  // Honour the existing trailing-comma style:
  //   { foo }    -> { foo, plugins: { ... } }
  //   { foo, }   -> { foo, plugins: { ... } }
  //   { }        -> { plugins: { ... } }
  // The block is appended directly after the trimmed inner (which may
  // already end in a newline); we do NOT add another newline here.
  const sep = endsWithComma || trimmedInner.trim() === '' ? '' : ',\n';
  const pluginsBlock =
    sep +
    `${indent}plugins: {\n` +
    `${entryIndent}'${configKey}': ${valueText}\n` +
    `${indent}}\n`;

  const newInner = trimmedInner + pluginsBlock;
  return (
    content.slice(0, openIdx + 1) +
    newInner +
    content.slice(endIdx)
  );
}

/**
 * Remove a plugin entry from the \`plugins: { ... }\` block. Returns
 * the new content plus a `changed` flag. If the entry is not
 * present, `changed` is false and the original content is returned.
 */
export function removePluginFromPluginsBlock(
  content: string,
  configKey: string
): { newContent: string; changed: boolean } {
  // Comment-aware "is present" check.
  const stripped = stripComments(content);
  const presentRegex = new RegExp(
    `(?:^|[\\s,\\{])(['"\`]?)${escapeRe(configKey)}\\1\\s*:`,
    'm'
  );
  if (!presentRegex.test(stripped)) {
    return { newContent: content, changed: false };
  }

  const block = findPluginsBlock(content);
  if (!block) return { newContent: content, changed: false };

  const inner = content.slice(block.start + 1, block.end);
  // Match the entry. Tolerate:
  //   'key': { ... }
  //   "key": { ... }
  //   `key`: { ... }
  //   key: { ... }      (unquoted)
  // The value is balanced braces (no nesting for default configs).
  // Allow trailing comma and surrounding whitespace.
  //
  // The replacement is empty (NOT '\n') so that an empty `plugins: {}`
  // block does not become `plugins: {\n}`. The caller (the installer)
  // checks `changed` and only reports success when an actual edit was
  // made; the visual rendering of the block is preserved.
  const re = new RegExp(
    `\\n?\\s*(['"\`]?)${escapeRe(configKey)}\\1\\s*:\\s*\\{[^{}]*\\}[,]?\\s*\\n?`,
    'g'
  );
  const newInner = inner.replace(re, '');
  if (newInner === inner) {
    return { newContent: content, changed: false };
  }
  return {
    newContent:
      content.slice(0, block.start + 1) +
      newInner +
      content.slice(block.end),
    changed: true
  };
}

// ─────────────────────────────────────────────────────────────────────
// JSON path — uses JSON.parse / JSON.stringify for full safety.
// ─────────────────────────────────────────────────────────────────────

export function addPluginToJsonConfig(
  content: string,
  configKey: string,
  valueText: string
): { newContent: string; changed: boolean } {
  let config: any;
  try {
    config = JSON.parse(content);
  } catch (e: any) {
    throw new Error(`Could not parse config as JSON: ${e.message}`);
  }
  config.plugins = config.plugins || {};
  if (configKey in config.plugins) {
    return { newContent: content, changed: false };
  }
  // Parse the value text. The installer passes JS-ish text like
  // `{}` or `{ theme: 'dark' }`; we normalise it to valid JSON by
  // quoting unquoted keys and replacing single quotes with double.
  const normalised = valueText
    .replace(/'/g, '"')
    .replace(/([{,]\s*)([A-Za-z_][\w-]*)(\s*:)/g, '$1"$2"$3');
  let value: any;
  try {
    value = JSON.parse(normalised);
  } catch {
    // Fall back to a plain object — the value will serialise as `{}`.
    value = {};
  }
  config.plugins[configKey] = value;
  return { newContent: JSON.stringify(config, null, 2) + '\n', changed: true };
}

export function removePluginFromJsonConfig(
  content: string,
  configKey: string
): { newContent: string; changed: boolean } {
  let config: any;
  try {
    config = JSON.parse(content);
  } catch (e: any) {
    throw new Error(`Could not parse config as JSON: ${e.message}`);
  }
  if (!config.plugins || !(configKey in config.plugins)) {
    return { newContent: content, changed: false };
  }
  delete config.plugins[configKey];
  return { newContent: JSON.stringify(config, null, 2) + '\n', changed: true };
}
