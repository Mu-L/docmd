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

/* ── Progress bar rendering ─────────────────────────────────── */

const BAR_WIDTH = 20;
const BAR_FULL = '━';
const BAR_EMPTY = '─';

function renderBar(current: number, total: number): string {
  const ratio = total > 0 ? Math.min(current / total, 1) : 0;
  const filled = Math.round(ratio * BAR_WIDTH);
  const empty = BAR_WIDTH - filled;
  const pct = Math.round(ratio * 100);
  return `${BAR_FULL.repeat(filled)}${BAR_EMPTY.repeat(empty)}  ${current}/${total}  (${pct}%)`;
}

/* ── Spinner frames ─────────────────────────────────────────── */

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

/* ── TTY Helpers ────────────────────────────────────────────── */

/** Check TTY status live (not cached) for environments that change it. */
function isTTY(): boolean {
  return process.stdout.isTTY === true;
}

/** Write in-place on a single line and immediately flush. */
function writeLine(text: string): void {
  if (isTTY()) {
    process.stdout.write(`\r\x1b[K${text}`);
  }
}

/* ── Output state tracking ──────────────────────────────────── */

let _progressActive = false;
let _lastOutputWasWaitStep = false;

/** Flush an in-progress progress bar line before printing new output. */
function flushProgress(): void {
  if (_progressActive && isTTY()) {
    process.stdout.write('\n');
    _progressActive = false;
  }
}

/** Reset the WAIT step tracking - called by all non-step output methods. */
function resetStepState(): void {
  _lastOutputWasWaitStep = false;
}

/* ── Timer ──────────────────────────────────────────────────── */

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * High-Signal Terminal Design System (TUI)
 * Standalone package with zero internal dependencies.
 */
export const TUI = {
  // Semantic Colors
  blue: chalk.blue,
  cyan: chalk.cyan,
  green: chalk.green,
  yellow: chalk.yellow,
  red: chalk.red,
  dim: chalk.dim,
  bold: chalk.bold,

  banner: (logo: string = LOGO, version: string = PKG_VERSION) => {
    flushProgress();
    resetStepState();
    console.log(`\n${chalk.blue(logo)}`);
    console.log(`${chalk.dim(` v${version}`)}\n`);
  },

  section: (label: string, color = chalk.cyan) => {
    flushProgress();
    resetStepState();
    console.log(`${color.bold(`┌─ ${label}`)}`);
  },

  divider: (label: string, color = chalk.blue) => {
    flushProgress();
    resetStepState();
    console.log(`${color.bold(`├─ ${label}`)}`);
  },

  /**
   * Print a status step line.
   *
   * When called with 'WAIT', it prints and remembers that the last output
   * was a WAIT step. When called with 'DONE'/'FAIL'/'SKIP' immediately
   * after a WAIT step, it overwrites the WAIT line in-place on TTY.
   * This gives the clean single-line transition effect:
   *
   *   │  Checking consistency                        [ WAIT ]
   *   │  Checking consistency                        [ DONE ]  ← replaces WAIT
   */
  step: (label: string, status: 'DONE' | 'WAIT' | 'SKIP' | 'FAIL' | string = 'WAIT', barColor = chalk.cyan, statusFirst = false) => {
    flushProgress();
    const statusText = status === 'DONE' ? chalk.green('[ DONE ]') : 
                       status === 'SKIP' ? chalk.yellow('[ SKIP ]') : 
                       status === 'FAIL' ? chalk.red('[ FAIL ]') :
                       chalk.blue(`[ ${status} ]`);
    
    const line = statusFirst 
      ? `${barColor('│')}  ${statusText} ${label}`
      : `${barColor('│')}  ${chalk.dim(label.padEnd(45))} ${statusText}`;

    // If the previous output was a WAIT step, overwrite it in-place
    if (isTTY() && status !== 'WAIT' && _lastOutputWasWaitStep) {
      process.stdout.write(`\x1b[1A\r\x1b[K${line}\n`);
    } else {
      console.log(line);
    }

    // Track: only set true for WAIT, reset for everything else
    _lastOutputWasWaitStep = (status === 'WAIT');
  },

  item: (label: string, value: string, labelColor = chalk.dim, barColor = chalk.cyan) => {
    flushProgress();
    resetStepState();
    console.log(`${barColor('│')}  ${labelColor(label.padEnd(15))} ${value}`);
  },

  footer: (color = chalk.cyan) => {
    flushProgress();
    resetStepState();
    console.log(`${color('└──────────────────────────────────────────────────────────')}\n`);
  },

  info: (msg: string) => {
    flushProgress();
    resetStepState();
    console.log(`${chalk.blue.bold('⬢')} ${msg}`);
  },

  success: (msg: string) => {
    flushProgress();
    resetStepState();
    console.log(`\n${chalk.green.bold('⬢')} ${msg}\n`);
  },

  warn: (msg: string) => {
    flushProgress();
    resetStepState();
    console.log(`${chalk.yellow.bold('⬢')} ${chalk.yellow(msg)}`);
  },

  error: (msg: string, detail?: string) => {
    flushProgress();
    resetStepState();
    console.error(`\n${chalk.red.bold('┌─ Failure')}`);
    console.error(`${chalk.red('│')}  ${msg}`);
    if (detail) {
      detail.split('\n').forEach(line => {
        console.error(`${chalk.red('│')}  ${chalk.dim(line)}`);
      });
    }
    console.error(`${chalk.red('└──────────────────────────────────────────────────────────')}\n`);
  },

  // ── Progress Bar ───────────────────────────────────────────

  /**
   * Render a single-line progress bar that updates in-place.
   *
   *   │  Processing pages ████████░░░░░░░░░░░░  42/100  (42%)
   *
   * On TTY: overwrites the same line in-place.
   * On non-TTY: prints at 25%, 50%, 75%, and 100%.
   */
  progress: (label: string, current: number, total: number, barColor = chalk.cyan) => {
    resetStepState();
    const bar = renderBar(current, total);
    const line = `${barColor('│')}  ${chalk.dim(label)} ${chalk.cyan(bar)}`;
    if (isTTY()) {
      writeLine(line);
      _progressActive = true;
    } else {
      // Non-TTY: print at key milestones to avoid spam but show progress
      const pct = total > 0 ? Math.round((current / total) * 100) : 0;
      if (current >= total || pct === 25 || pct === 50 || pct === 75) {
        console.log(line);
      }
    }
  },

  // ── Spinner ────────────────────────────────────────────────

  /**
   * Start an animated spinner. Returns a handle to update, complete, or fail it.
   *
   *   │  Loading config ⠋
   *
   * Usage:
   *   const sp = TUI.spinner('Loading config');
   *   // ... async work ...
   *   sp.done('Config loaded');
   */
  spinner: (label: string, barColor = chalk.cyan) => {
    resetStepState();
    let frameIndex = 0;
    let currentLabel = label;
    let stopped = false;

    const render = () => {
      if (stopped) return;
      const frame = chalk.cyan(SPINNER_FRAMES[frameIndex % SPINNER_FRAMES.length]);
      // For spinners, we always put the frame at the end for animation stability
      writeLine(`${barColor('│')}  ${chalk.dim(currentLabel)} ${frame}`);
      frameIndex++;
    };

    // Start animation — only on TTY
    const interval = isTTY() ? setInterval(render, 80) : null;
    if (interval) interval.unref(); // Don't block process exit
    if (!isTTY()) {
      // Non-TTY: print static line
      console.log(`${barColor('│')}  ${chalk.dim(currentLabel)} ...`);
    }

    return {
      /** Update the label text mid-spin. */
      update: (newLabel: string) => {
        currentLabel = newLabel;
      },

      /** Stop spinner with success. */
      done: (doneLabel?: string, statusFirst = false) => {
        stopped = true;
        if (interval) clearInterval(interval);
        const finalLabel = doneLabel || currentLabel;
        const statusText = chalk.green('[ DONE ]');
        const line = statusFirst
          ? `${barColor('│')}  ${statusText} ${finalLabel}`
          : `${barColor('│')}  ${chalk.dim(finalLabel.padEnd(45))} ${statusText}`;
        
        if (isTTY()) {
          process.stdout.write(`\r\x1b[K${line}\n`);
        } else {
          console.log(line);
        }
      },

      /** Stop spinner with failure. */
      fail: (failLabel?: string, statusFirst = false) => {
        stopped = true;
        if (interval) clearInterval(interval);
        const finalLabel = failLabel || currentLabel;
        const statusText = chalk.red('[ FAIL ]');
        const line = statusFirst
          ? `${barColor('│')}  ${statusText} ${finalLabel}`
          : `${barColor('│')}  ${chalk.dim(finalLabel.padEnd(45))} ${statusText}`;

        if (isTTY()) {
          process.stdout.write(`\r\x1b[K${line}\n`);
        } else {
          console.log(line);
        }
      }
    };
  },

  // ── Counter ────────────────────────────────────────────────

  /**
   * Render a single-line counter that updates in-place.
   *
   *   │  Scanned 342 files
   */
  counter: (label: string, count: number, barColor = chalk.cyan) => {
    resetStepState();
    const line = `${barColor('│')}  ${chalk.dim(label)} ${chalk.bold(String(count))}`;
    writeLine(line);
  },

  /** Finalise a counter / progress line with a newline. */
  commitLine: (label: string, barColor = chalk.cyan) => {
    flushProgress();
    resetStepState();
    const line = `${barColor('│')}  ${chalk.dim(label)}`;
    console.log(line);
  },

  // ── Timer Utility ──────────────────────────────────────────

  /** Format milliseconds into a human-readable duration. */
  formatDuration,

  /** Start a timer and return a function that returns the elapsed time string. */
  timer: () => {
    const start = Date.now();
    return () => formatDuration(Date.now() - start);
  }
};