import { execSync } from 'node:child_process';

/** Cached git root path (null = not yet detected, '' = not a git repo). */
let _cachedGitRoot: string | null = null;

/**
 * Detect the git repository root for the current working directory.
 * Returns the absolute path to the git root, or null if not in a git repo.
 * Result is cached per execution to prevent spawning multiple processes.
 */
export function getGitRoot(): string | null {
  if (_cachedGitRoot !== null) {
    return _cachedGitRoot || null;
  }
  try {
    _cachedGitRoot = execSync('git rev-parse --show-toplevel', {
      cwd: process.cwd(),
      stdio: 'pipe',
      encoding: 'utf8'
    }).trim();
    return _cachedGitRoot;
  } catch {
    _cachedGitRoot = '';
    return null;
  }
}

/**
 * Reset the cached git root. Useful for testing or when the cwd changes significantly.
 */
export function resetGitRootCache(): void {
  _cachedGitRoot = null;
}