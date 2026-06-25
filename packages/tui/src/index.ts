/**
 * --------------------------------------------------------------------
 * docmd : the zero-config documentation engine.
 *
 * @package     @docmd/tui
 * @website     https://docmd.io
 * @repository  https://github.com/docmd-io/docmd
 * @license     MIT
 * @copyright   Copyright (c) 2025-present docmd.io
 *
 * [docmd-source] - Please do not remove this header.
 * --------------------------------------------------------------------
 */

import chalk from 'chalk';
import { readFileSync } from 'node:fs';

const pkgUrl = new URL('../package.json', import.meta.url);
const { version: PKG_VERSION } = JSON.parse(readFileSync(pkgUrl, 'utf-8'));

const LOGO = `
    _                 _ 
  _| |___ ___ _____ _| |
 | . | . |  _|     | . |
 |___|___|___|_|_|_|___|
`;

/* ── Progress bar ───────────────────────────────────────────── */

const BAR_WIDTH = 20;
const BAR_FULL  = '━';
const BAR_EMPTY = '─';

function renderBar(current: number, total: number): string {
  const ratio  = total > 0 ? Math.min(current / total, 1) : 0;
  const filled = Math.round(ratio * BAR_WIDTH);
  const pct    = Math.round(ratio * 100);
  return `${BAR_FULL.repeat(filled)}${BAR_EMPTY.repeat(BAR_WIDTH - filled)}  (${pct}%)`;
}

/* ── Spinner ────────────────────────────────────────────────── */

const SPINNER_FRAMES = ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏'];

/* ── TTY helpers ────────────────────────────────────────────── */

function isTTY(): boolean { return process.stdout.isTTY === true; }

function eraseLines(n: number): void {
  for (let i = 0; i < n; i++) process.stdout.write('\x1b[1A\x1b[2K');
}

/* ── Duration ───────────────────────────────────────────────── */

function formatDuration(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

/* ──────────────────────────────────────────────────────────────
 * Active-line state machine
 *
 * Layout while a WAIT step is active:
 *
 *   │  [ WAIT ] Label text here           ← wait line
 *   │           ━━━━━━━━━━━━━━━━  (42%)  ← progress bar  ← _progressLines ≥ 1
 *   │                                    ← breathing room ← _progressLines = 2
 *
 * _waitLine      : text of the current WAIT step (null = none active)
 * _waitBarColor  : chalk colour function used for that step's bar glyph
 * _progressLines : how many lines BELOW the wait line are "active"
 *                  0 = nothing extra  1 = blank only  2 = bar + blank
 * ────────────────────────────────────────────────────────────── */

let _waitLine:     string | null = null;
let _waitBarColor: typeof chalk.cyan   = chalk.cyan;
let _progressLines = 0;

// Section auto-close tracking
let _sectionOpen  = false;
let _sectionColor = chalk.cyan;

/** Erase only the progress area below the wait line. */
function clearProgressArea(): void {
  if (_progressLines > 0 && isTTY()) {
    eraseLines(_progressLines);
    _progressLines = 0;
  }
}

/** Erase the full active block: progress area + the wait line itself. */
function clearActiveBlock(): void {
  if (!isTTY()) return;
  const total = _progressLines + (_waitLine !== null ? 1 : 0);
  if (total > 0) eraseLines(total);
  _progressLines = 0;
  _waitLine      = null;
}

/** Commit any active state before printing structural output (section/footer). */
function commitState(): void {
  clearProgressArea();
  // Leave the wait line on-screen — it will be resolved by its own DONE/FAIL call
  _progressLines = 0;
}

/* ── Flag helpers ───────────────────────────────────────────── */

function flag(status: string): string {
  switch (status) {
    case 'DONE': return chalk.green('[ DONE ]');
    case 'FAIL': return chalk.red  ('[ FAIL ]');
    case 'SKIP': return chalk.yellow('[ SKIP ]');
    case 'WAIT': return chalk.blue ('[ WAIT ]');
    default:     return chalk.blue (`[ ${status} ]`);
  }
}

/**
 * High-Signal Terminal Design System (TUI)
 * Standalone package with zero internal dependencies.
 *
 * Step format  →  │  [ DONE ] Label text flows freely here
 * Progress     →  │           ━━━━━━━━━━━━━━━━━━━━  (42%)
 * Breathing    →  │
 */
export const TUI = {
  // Semantic colors
  blue:   chalk.blue,
  cyan:   chalk.cyan,
  green:  chalk.green,
  yellow: chalk.yellow,
  red:    chalk.red,
  dim:    chalk.dim,
  bold:   chalk.bold,

  banner: (logo: string = LOGO, version: string = PKG_VERSION) => {
    commitState();
    console.log(`\n${chalk.blue(logo)}`);
    console.log(`${chalk.dim(` v${version}`)}\n`);
  },

  section: (label: string, color = chalk.cyan) => {
    commitState();
    // Auto-close any previously open section so callers don't need to
    // manually track when to call footer()
    if (_sectionOpen) {
      console.log(`${_sectionColor('└──────────────────────────────────────────────────────────')}`);
    }
    _sectionColor = color;
    _sectionOpen  = true;
    console.log(`\n${color.bold(`┌─ ${label}`)}`);
  },

  divider: (label: string, color = chalk.blue) => {
    commitState();
    console.log(`${color.bold(`├─ ${label}`)}`);
  },

  /**
   * Print a status step line.
   *
   * WAIT  → prints the line + a blank breathing `│`, tracks state.
   *         If a WAIT is already active, overwrites in-place (label update).
   * DONE/FAIL/SKIP → erases the WAIT block and replaces with final status line.
   *
   * `statusFirst` accepted but ignored — left-side flags are always the default.
   */
  step: (label: string, status: 'DONE'|'WAIT'|'SKIP'|'FAIL'|string = 'WAIT', barColor = chalk.cyan, _statusFirst?: boolean) => {
    const f    = flag(status);
    const line = `${barColor('│')}  ${f} ${chalk.dim(label)}`;

    if (status === 'WAIT') {
      if (isTTY() && _waitLine !== null) {
        // Overwrite existing wait line in-place (e.g. count update)
        eraseLines(_progressLines + 1);
      } else {
        clearProgressArea();
      }
      console.log(line);
      console.log(`${barColor('│')}`);
      _waitLine      = label;
      _waitBarColor  = barColor;
      _progressLines = 1;

    } else {
      if (isTTY() && _waitLine !== null) {
        eraseLines(_progressLines + 1);
      }
      console.log(line);
      _waitLine      = null;
      _progressLines = 0;
    }
  },

  item: (label: string, value: string, labelColor = chalk.dim, barColor = chalk.cyan) => {
    commitState();
    console.log(`${barColor('│')}  ${labelColor(label.padEnd(15))} ${value}`);
  },

  /**
   * Render a per-plugin tree inside an open section.
   *
   *   │ [ DONE ] [seo] Generated robots.txt
   *   │          ├─ [ DONE ] Generated .nojekyll (disables Jekyll on GitHub Pages)
   *
   * Single-entry plugins collapse to one parent line; warnings and follow-up
   * events become indented children. Parent is the first DONE/FAIL entry
   * (the main action); when every entry was SKIP, the first entry is used.
   *
   * Pass an empty `entries` array and the helper is a no-op.
   */
  pluginTree: (
    pluginName: string,
    entries: Array<{ msg: string; status: 'DONE'|'SKIP'|'FAIL'|'WAIT' }>,
    color = chalk.cyan,
  ) => {
    commitState();
    if (!entries || entries.length === 0) return;

    const bar  = color('│');
    const key  = chalk.bold(`[${pluginName}]`).padEnd(8);

    const parentIdx = (() => {
      const idx = entries.findIndex(e => e.status === 'DONE' || e.status === 'FAIL');
      return idx === -1 ? 0 : idx;
    })();

    const parent = entries[parentIdx];
    console.log(`${bar}  ${flag(parent.status)} ${key} ${chalk.dim(parent.msg)}`);

    if (entries.length === 1) return;

    // Build the children list in original order, skipping the parent.
    const childIndices: number[] = [];
    for (let i = 0; i < entries.length; i++) {
      if (i !== parentIdx) childIndices.push(i);
    }
    childIndices.forEach((idx, i) => {
      const isLast = i === childIndices.length - 1;
      const branch = isLast ? '└─' : '├─';
      const e      = entries[idx];
      console.log(`${bar}             ${chalk.dim(branch)} ${flag(e.status)} ${chalk.dim(e.msg)}`);
    });
  },

  footer: (color = chalk.cyan) => {
    commitState();
    console.log(`${color('└──────────────────────────────────────────────────────────')}`);
    _sectionOpen = false;
  },

  info: (msg: string) => {
    commitState();
    console.log(`\n${chalk.blue.bold('⬢')} ${msg}`);
  },

  success: (msg: string) => {
    commitState();
    console.log(`\n${chalk.green.bold('⬢')} ${msg}`);
  },

  warn: (msg: string) => {
    commitState();
    console.log(`${chalk.yellow.bold('⬢')} ${chalk.yellow(msg)}`);
  },

  error: (msg: string, detail?: string) => {
    commitState();
    console.error(`\n${chalk.red.bold('┌─ Failure')}`);
    console.error(`${chalk.red('│')}  ${msg}`);
    if (detail) {
      detail.split('\n').forEach(l => console.error(`${chalk.red('│')}  ${chalk.dim(l)}`));
    }
    console.error(`${chalk.red('└──────────────────────────────────────────────────────────')}`);
  },

  // ── Progress Bar ───────────────────────────────────────────

  /**
   * Render an in-place progress bar on its own line below the active WAIT step.
   *
   *   │  [ WAIT ] Processing pages
   *   │           ━━━━━━━━━━━━━━━━━━━━  (42%)
   *   │
   */
  progress: (label: string, current: number, total: number, barColor = chalk.cyan) => {
    const bar  = renderBar(current, total);
    const line = `${barColor('│')}           ${chalk.cyan(bar)}`;

    if (!isTTY()) {
      const pct = total > 0 ? Math.round((current / total) * 100) : 0;
      if (current >= total || pct === 25 || pct === 50 || pct === 75) {
        console.log(line);
      }
      return;
    }

    // Erase the progress area below the wait line (bar + blank)
    if (_progressLines > 0) eraseLines(_progressLines);

    process.stdout.write(`${line}\n`);
    process.stdout.write(`${barColor('│')}\n`);
    _progressLines = 2;
  },

  // ── Spinner ────────────────────────────────────────────────

  /**
   * Start an animated spinner in left-flag style.
   *
   *   │  [ ⠋ ] Loading config
   *   │
   *
   * Returns a handle with .done() / .fail() / .update().
   */
  spinner: (label: string, barColor = chalk.cyan) => {
    let frameIndex  = 0;
    let currentLabel = label;
    let stopped     = false;

    // Print initial WAIT line + breathing room
    const waitLine = `${barColor('│')}  ${chalk.blue('[ WAIT ]')} ${chalk.dim(currentLabel)}`;
    console.log(waitLine);
    console.log(`${barColor('│')}`);
    _waitLine      = currentLabel;
    _waitBarColor  = barColor;
    _progressLines = 1;

    const render = () => {
      if (stopped || !isTTY()) return;
      const frame = chalk.cyan(SPINNER_FRAMES[frameIndex++ % SPINNER_FRAMES.length]);
      // Go up past blank + wait line, rewrite wait line with spinner frame
      process.stdout.write('\x1b[2A\r\x1b[2K');
      process.stdout.write(`${barColor('│')}  ${chalk.blue('[')} ${frame} ${chalk.blue(']')} ${chalk.dim(currentLabel)}\n`);
      process.stdout.write(`${barColor('│')}\n`);
    };

    const interval = isTTY() ? setInterval(render, 80) : null;
    if (interval) interval.unref();
    if (!isTTY()) {
      // Non-TTY: static line already printed above
    }

    const finish = (status: 'DONE' | 'FAIL', finalLabel?: string) => {
      stopped = true;
      if (interval) clearInterval(interval);
      const fl = finalLabel || currentLabel;
      if (isTTY()) eraseLines(_progressLines + 1);
      const f    = status === 'DONE' ? chalk.green('[ DONE ]') : chalk.red('[ FAIL ]');
      console.log(`${barColor('│')}  ${f} ${chalk.dim(fl)}`);
      _waitLine      = null;
      _progressLines = 0;
    };

    return {
      update: (newLabel: string) => { currentLabel = newLabel; },
      done:   (doneLabel?: string, _statusFirst?: boolean) => finish('DONE', doneLabel),
      fail:   (failLabel?: string, _statusFirst?: boolean) => finish('FAIL', failLabel),
    };
  },

  // ── Counter ────────────────────────────────────────────────

  counter: (label: string, count: number, barColor = chalk.cyan) => {
    const line = `${barColor('│')}  ${chalk.dim(label)} ${chalk.bold(String(count))}`;
    if (isTTY()) process.stdout.write(`\r\x1b[K${line}`);
  },

  commitLine: (label: string, barColor = chalk.cyan) => {
    commitState();
    console.log(`${barColor('│')}  ${chalk.dim(label)}`);
  },

  // ── Timer ──────────────────────────────────────────────────

  formatDuration,

  timer: () => {
    const start = Date.now();
    return () => formatDuration(Date.now() - start);
  },

  // ── Centralised Project Summary ────────────────────────────

  /**
   * Print standardised project details within a TUI section.
   */
  projectDetails: (opts: {
    source?:   string;
    output?:   string;
    engine?:   string;
    versions?: { count: number; labels: string };
    locales?:  { count: number; labels: string };
    threads?:  number;
    barColor?: typeof chalk.cyan;
  }) => {
    const bc = opts.barColor || chalk.cyan;
    if (opts.engine)   TUI.item('Engine',   opts.engine === 'rust' ? 'rust (preview)' : opts.engine, chalk.dim, bc);
    if (opts.source)   TUI.item('Source',   opts.source,                                          chalk.dim, bc);
    if (opts.output)   TUI.item('Output',   opts.output,                                          chalk.dim, bc);
    if (opts.versions) TUI.item('Versions', `${opts.versions.count} (${opts.versions.labels})`,   chalk.dim, bc);
    if (opts.locales)  TUI.item('Locales',  `${opts.locales.count} (${opts.locales.labels})`,     chalk.dim, bc);
    if (opts.threads)  TUI.item('Threads',  `${opts.threads}`,                                    chalk.dim, bc);
  },

  /**
   * Extract standardised project details from a resolved config object.
   */
  extractProjectDetails: (config: any, outputDir: string, cwd: string) => {
    const details: {
      source: string;
      output: string;
      engine?: string;
      versions?: { count: number; labels: string };
      locales?:  { count: number; labels: string };
    } = {
      source: (config.src || 'docs') + '/',
      output: outputDir.startsWith(cwd) ? outputDir.slice(cwd.length + 1) + '/' : outputDir + '/',
    };

    if (config.engine && config.engine !== 'js') {
      details.engine = config.engine;
    }

    if (config.versions?.all?.length > 0) {
      details.versions = {
        count:  config.versions.all.length,
        labels: config.versions.all.map((v: any) => v.id).join(', '),
      };
    }

    if (config.i18n?.locales?.length > 0) {
      details.locales = {
        count:  config.i18n.locales.length,
        labels: config.i18n.locales.map((l: any) => l.id).join(', '),
      };
    }

    return details;
  },
};