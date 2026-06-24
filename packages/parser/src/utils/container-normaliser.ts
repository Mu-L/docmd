/**
 * --------------------------------------------------------------------
 * docmd : the zero-config documentation engine.
 *
 * @package     @docmd/parser
 * @website     https://docmd.io
 * @repository  https://github.com/docmd-io/docmd
 * @license     MIT
 * @copyright   Copyright (c) 2025-present docmd.io
 *
 * [docmd-source] - Please do not remove this header.
 * --------------------------------------------------------------------
 */

/**
 * Container normaliser
 * ====================
 *
 * Single-pass linear scan that rewrites `:::` container markdown so that
 * the existing depth-tracking block rules in `features/common-containers.ts`
 * always see balanced open/close pairs.
 *
 * The classic bugs this addresses:
 *
 *   F1 — depth tracker is indentation-blind.
 *        `::: grids` + N×`    ::: grid` + N×`:::` (one per card)
 *        leaves depth > 0 and the block rule fails to match, so the
 *        whole grids block is dumped as raw `<p>::: grids<br>...</p>`.
 *   F2 — `::: tag` is self-closing but the next orphan `:::` still
 *        decrements depth of the wrong container.
 *   F3 — `::: callout ... ::: card ... :::` silently re-roots.
 *   F4 — bare `:::` lines leak into the page as `<p>:::</p>` paragraphs.
 *   F5 — 5+ levels of nesting survive when opens and closes are balanced,
 *        but unbalanced user input collapses inner levels.
 *
 * The algorithm is the same one documented in
 * `battle-test-reports/robust-parser-shim/index.js` (146 lines,
 * dependency-free). This file is the in-tree port — no plugins, no
 * configuration, always-on.
 *
 * Output is deterministic: the function is a pure function of its input.
 * Two worker threads given the same source produce byte-identical output.
 */

/**
 * Container names that produce a single line (no body, no close).
 * These are matched by name in the open line and the line is passed
 * through unchanged; any stray `:::` that follows them is a user mistake
 * (F2) and is removed.
 */
export const SELF_CLOSING_CONTAINER_NAMES: ReadonlySet<string> = new Set([
  'button',
  'tag',
  'embed'
]);

/**
 * Severity levels for normaliser warnings. Mirrors the three messages the
 * shim emits so downstream consumers can route by severity if they want.
 */
export type NormaliserWarningSeverity = 'warning' | 'info' | 'error';

export interface NormaliserWarning {
  /** 1-indexed line number in the original source. */
  line: number;
  severity: NormaliserWarningSeverity;
  /** Path of the source file (or `<source>` when synthetic). */
  path: string;
  message: string;
}

export interface NormaliserResult {
  /** Rewritten source with implicit closes added and stray closes removed. */
  source: string;
  warnings: NormaliserWarning[];
}

export interface NormaliserOptions {
  /** Path used in warning messages. Defaults to `<source>`. */
  sourcePath?: string;
  /** When true, print debug lines to stdout. Defaults to false. */
  debug?: boolean;
  /** Optional sink for warnings — useful for tests and structured logging. */
  onWarning?: (warning: NormaliserWarning) => void;
}

interface ClassifiedLine {
  kind: 'open' | 'close' | 'other';
  name?: string;
}

interface OpenFrame {
  name: string;
  /** 1-indexed line number where this container was opened. */
  line: number;
  /** Indent (in spaces) of the line that opened the container. */
  indent: number;
}

/**
 * Count the leading spaces of a line. Tabs are not interpreted — markdown
 * container indentation is conventionally spaces.
 */
export function indentOf(line: string): number {
  const m = line.match(/^ */);
  return m ? m[0].length : 0;
}

/**
 * Classify a single source line as `open`, `close`, or `other`.
 *
 *   open   — `::: <name>...` where `<name>` starts with a letter.
 *            Self-closing names (`button`, `tag`, `embed`) are still
 *            classified as `open` — the algorithm distinguishes them via
 *            the SELF_CLOSING_CONTAINER_NAMES set, not here.
 *   close  — bare `:::` with optional surrounding whitespace.
 *   other  — anything else, passed through verbatim.
 */
export function classifyLine(line: string): ClassifiedLine {
  if (/^\s*:::\s*[a-zA-Z]/.test(line)) {
    const m = line.match(/^\s*:::\s*([a-zA-Z][\w-]*)/);
    return { kind: 'open', name: m ? m[1] : undefined };
  }
  if (/^\s*:::\s*$/.test(line)) {
    return { kind: 'close' };
  }
  return { kind: 'other' };
}

/**
 * Rewrite a markdown source so that every `:::` block has a matching close.
 *
 * The function never throws; instead it returns the rewritten source plus
 * an array of warnings. Callers may surface warnings through `console.warn`,
 * a structured logger, or both via `options.onWarning`.
 *
 * The algorithm is allocation-conscious (single array of output lines, single
 * stack of open frames) but readability is prioritised over micro-optimisation.
 */
export function normaliseContainers(
  source: string,
  options: NormaliserOptions | string = {}
): NormaliserResult {
  // Allow the legacy 2-arg call signature `normaliseContainers(src, path)` so
  // any in-flight plugin code keeps working.
  const opts: NormaliserOptions = typeof options === 'string'
    ? { sourcePath: options }
    : options;

  const sourcePath = opts.sourcePath || '<source>';
  const debug = opts.debug === true;
  const onWarning = typeof opts.onWarning === 'function' ? opts.onWarning : null;

  const lines = source.split('\n');
  const out: string[] = [];
  const stack: OpenFrame[] = [];
  const warnings: NormaliserWarning[] = [];

  const recordWarning = (w: NormaliserWarning): void => {
    warnings.push(w);
    if (onWarning) onWarning(w);
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const cls = classifyLine(line);
    const indent = indentOf(line);

    if (cls.kind === 'open') {
      // The shim's classification only tells us the line LOOKS like an open;
      // the SELF_CLOSING set is the source of truth for whether the body
      // exists. Without this distinction `::: tag` would corrupt depth (F2).
      if (cls.name && SELF_CLOSING_CONTAINER_NAMES.has(cls.name)) {
        out.push(line);
        if (debug) {
          console.log(`[normaliser] ${sourcePath}:${i + 1} self-close <${cls.name}>`);
        }
        continue;
      }

      stack.push({ name: cls.name || '', line: i + 1, indent });
      out.push(line);
      continue;
    }

    if (cls.kind === 'close') {
      // Walk the stack from innermost outward and find the first open whose
      // indent is <= this close's indent. That is the container this `:::`
      // logically closes — anything above it was closed implicitly by the
      // same user gesture.
      let matchIdx = -1;
      for (let j = stack.length - 1; j >= 0; j--) {
        if (stack[j].indent <= indent) {
          matchIdx = j;
          break;
        }
      }

      if (matchIdx === -1) {
        recordWarning({
          line: i + 1,
          severity: 'warning',
          path: sourcePath,
          message: 'Stray `:::` removed. Common cause: `::: tag ... :::` (tag is self-closing).'
        });
        continue;
      }

      const closed = stack.splice(matchIdx);
      const outerIndent = closed[0].indent;

      // Emit one `:::` per closed entry, all at the outer indent. The
      // upstream parser's `smartDedent` collapses higher indents to the
      // outer indent, so N closes at the outer indent correctly pop N
      // entries from its depth counter.
      for (let k = 0; k < closed.length; k++) {
        out.push(' '.repeat(outerIndent) + ':::');
      }

      if (closed.length > 1) {
        recordWarning({
          line: i + 1,
          severity: 'info',
          path: sourcePath,
          message:
            `Closed ${closed.length} containers implicitly (` +
            closed.map((c) => `<${c.name}>`).join(' > ') +
            `). Added ${closed.length - 1} explicit \`:::\` closes.`
        });
      }
      continue;
    }

    out.push(line);
  }

  // Auto-close anything still on the stack at EOF. Without this the upstream
  // block rule would loop to endLine without finding a close and the whole
  // container would be dropped (F1, F3).
  for (let i = stack.length - 1; i >= 0; i--) {
    const frame = stack[i];
    recordWarning({
      line: frame.line,
      severity: 'error',
      path: sourcePath,
      message: `Unclosed \`<${frame.name}>\` from line ${frame.line} — auto-closed at EOF.`
    });
    out.push(' '.repeat(frame.indent) + ':::');
  }

  return { source: out.join('\n'), warnings };
}

export default normaliseContainers;
