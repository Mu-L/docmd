/**
 * --------------------------------------------------------------------
 * docmd : the zero-config documentation engine.
 *
 * @package     @docmd/core
 * @website     https://docmd.io
 * @repository  https://github.com/docmd-io/docmd
 * @license     MIT
 * @copyright   Copyright (c) 2025-present docmd.io
 *
 * [docmd-source] - Please do not remove this header.
 * --------------------------------------------------------------------
 */

/**
 * Phase 3 PR 3.A — Exit-code contract.
 *
 * Every `docmd <command>` that hits a documented error path MUST exit
 * with a non-zero code so CI pipelines can gate on it. Historically we
 * had several `TUI.error(...); return;` patterns that printed the
 * message but left the process at exit code 0, silently passing broken
 * builds (see `unified-issues.md` §F6 / §M-12).
 *
 * These helpers centralise the contract:
 *
 *   - `exitCodeFor(err)` returns a numeric exit code. Today this is
 *     always 1 (operational error), but the indirection lets us
 *     introduce code-2 for usage errors, code-3 for config errors,
 *     etc. without rewriting every call site.
 *
 *   - `exitWithError(err, opts?)` calls `TUI.error(...)` (or prints
 *     JSON when `opts.json === true`) and then `process.exit(code)`.
 *     The `quiet` option suppresses the error print when the caller
 *     has already surfaced the error.
 *
 *   - `failWith(message, opts?)` is the convenience wrapper for the
 *     common "no extra Error object, just a message" case.
 *
 * Every CLI command that previously did `TUI.error(...); return;`
 * should be ported to `exitWithError(...)`. The Phase 3 PR 3.A brute-
 * test scenario asserts that every documented failure case exits 1.
 */

import { TUI } from '@docmd/api';

/**
 * Map any thrown or constructed value to a numeric exit code.
 *
 * Reserved codes (matches common CLI conventions):
 *   0 — success
 *   1 — operational error (default for any thrown value)
 *
 * Future expansion: discriminate on `err.code` or `err.name` to
 * return 2 (usage), 3 (config), 4 (network), 5 (I/O), 6 (plugin).
 */
export function exitCodeFor(_err: unknown): number {
  // Reserved for future discrimination on err.code / err.name. Today every
  // error maps to 1 (operational). The parameter is part of the contract.
  void _err;
  return 1;
}

/**
 * Print an error and exit with the code returned by `exitCodeFor`.
 * Never returns — the function always terminates the process.
 *
 *   exitWithError(new Error('Plugin not found: foo'));
 *   exitWithError('Build failed: ...', { json: true });
 *   exitWithError('Missing configuration', { quiet: true });
 */
export function exitWithError(
  err: unknown,
  opts: { json?: boolean; quiet?: boolean; section?: string } = {}
): never {
  const message = err instanceof Error ? err.message : String(err);
  const code = exitCodeFor(err);

  if (!opts.quiet) {
    if (opts.json) {
      console.log(JSON.stringify({ error: message, exitCode: code }));
    } else {
      TUI.error(opts.section || 'Command failed', message);
    }
  }
  process.exit(code);
}

/**
 * Convenience wrapper when the caller has a plain message string and
 * no Error object. Same as `exitWithError(new Error(message), opts)`.
 */
export function failWith(message: string, opts: { json?: boolean; section?: string } = {}): never {
  exitWithError(new Error(message), opts);
}
