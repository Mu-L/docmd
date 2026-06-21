import nativeFs from 'node:fs';

/**
 * Tracks file content signatures (mtimeMs + size) so phantom fs.watch
 * events from macOS Spotlight, iCloud, Time Machine, and other background
 * daemons — which fire without actually modifying the file — can be filtered
 * out before triggering a rebuild.
 *
 * Why mtimeMs + size (not a content hash):
 *   - Microsecond-fast even on large markdown files.
 *   - Every editor and save tool bumps mtime on real writes.
 *   - Phantom readers (`getattrlist`, `stat`) on macOS do NOT bump mtime.
 *   - mtime resolution on APFS is nanosecond-precision, so collisions
 *     between two distinct real writes are not a concern.
 *   - File deletion and creation are correctly detected (signature flips
 *     between a real value and `null`).
 *
 * The tracker is a per-process singleton helper; instantiate once per
 * dev-server lifecycle and share across all watcher callbacks.
 */
export class FileSignatureTracker {
  private signatures = new Map<string, string>();

  /**
   * Returns the current signature for the file, or `null` if the file
   * no longer exists, is unreadable, or is not a regular file.
   */
  getSignature(filePath: string): string | null {
    try {
      const st = nativeFs.statSync(filePath);
      if (!st.isFile()) return null;
      return `${st.mtimeMs}|${st.size}`;
    } catch {
      return null;
    }
  }

  /**
   * Returns true only if the file's content signature differs from the
   * last recorded one. The first call for a given file returns true
   * (treat a new sighting as a change). The signature is recorded on
   * every call so that subsequent phantom events are filtered out.
   */
  hasChanged(filePath: string): boolean {
    const current = this.getSignature(filePath);
    const previous = this.signatures.get(filePath);
    if (current === previous) return false;
    this.signatures.set(filePath, current);
    return true;
  }

  /**
   * Drop the recorded signature for a file so the next event is treated
   * as new. Useful before a known mutation (e.g. just before a build
   * writes to a watched path).
   */
  forget(filePath: string): void {
    this.signatures.delete(filePath);
  }

  /** Drop everything (e.g. after closing/reopening watchers on config reload). */
  reset(): void {
    this.signatures.clear();
  }
}