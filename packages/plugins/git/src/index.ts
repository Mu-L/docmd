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
 */

import path from 'path';
import fs from 'fs';
import { execFile, execSync } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const execFileAsync = promisify(execFile);
import crypto from 'crypto';
import type { PluginDescriptor, PageContext } from '@docmd/api';

export const plugin: PluginDescriptor = {
  name: 'git',
  version: '0.7.9',
  capabilities: ['build', 'body', 'assets', 'translations', 'init']
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const i18nDir = path.resolve(__dirname, '..', 'i18n');

// Cache for git data to avoid repeated shell calls (keyed by absolute file path)
const gitCache = new Map<string, GitFileInfo>();

// Cache git root per directory (keyed by directory path)
const gitRootCache = new Map<string, string | null>();

export interface GitCommit {
  hash: string;
  shortHash: string;
  author: string;
  email: string;
  date: string;
  timestamp: number;
  message: string;
  avatarUrl: string;
}

export interface GitFileInfo {
  lastUpdated: string;
  lastUpdatedTimestamp: number;
  commits: GitCommit[];
}

/**
 * Resolve the git root for a given directory.
 * Cached per directory so multi-project builds never share roots.
 */
async function resolveGitRoot(dir: string): Promise<string | null> {
  if (gitRootCache.has(dir)) return gitRootCache.get(dir)!;
  try {
    // Normalize to real path to avoid case-sensitivity issues on Mac
    const realDir = fs.realpathSync(dir);
    const { stdout } = await execFileAsync('git', ['rev-parse', '--show-toplevel'], {
      cwd: realDir
    });
    const result = stdout.trim();
    gitRootCache.set(dir, result);
    return result;
  } catch {
    gitRootCache.set(dir, null);
    return null;
  }
}

/**
 * Check if git is available on the system.
 */
function isGitAvailable(): boolean {
  try {
    execSync('git --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get git information for a specific file.
 * Resolves the git root from the file's own directory — safe for multi-project builds.
 */
async function getGitFileInfo(filePath: string, maxCommits: number = 6): Promise<GitFileInfo | null> {
  // Check cache first (keyed by absolute file path)
  if (gitCache.has(filePath)) return gitCache.get(filePath)!;

  // Resolve git root from the file's directory, not process.cwd()
  const fileDir = path.dirname(filePath);
  const gitRoot = await resolveGitRoot(fileDir);
  if (!gitRoot) return null;

  // Ensure gitRoot and filePath are normalized for comparison
  const normalizedRoot = fs.realpathSync(gitRoot);
  const normalizedFile = fs.realpathSync(filePath);

  const relPath = path.relative(normalizedRoot, normalizedFile).replace(/\\/g, '/');
  
  // Security/Correctness check: file MUST be inside the git root
  if (!relPath || relPath.startsWith('..') || path.isAbsolute(relPath)) return null;

  try {
    // Use execFile with array arguments to avoid shell injection and path escaping issues.
    // Added --follow to track renames and -- "path" to isolate commits to THIS file only.
    const { stdout } = await execFileAsync('git', [
      'log',
      '--follow',
      '-n', maxCommits.toString(),
      '--format=%H|%h|%an|%ae|%at|%s',
      '--',
      relPath
    ], { 
      cwd: normalizedRoot 
    });

    const logOutput = stdout.trim();
    if (!logOutput) return null;

    const commits: GitCommit[] = logOutput.split('\n').filter(Boolean).map((line: string) => {
      const [hash, shortHash, author, email, timestamp, ...messageParts] = line.split('|');
      const ts = parseInt(timestamp, 10) * 1000;
      const hashEmail = crypto.createHash('md5').update(email.trim().toLowerCase()).digest('hex');
      return {
        hash,
        shortHash,
        author,
        email,
        date: new Date(ts).toISOString(),
        timestamp: ts,
        message: messageParts.join('|'),
        avatarUrl: `https://www.gravatar.com/avatar/${hashEmail}?d=mp&s=64`
      };
    });

    if (commits.length === 0) return null;

    const info: GitFileInfo = {
      lastUpdated: commits[0]?.date || '',
      lastUpdatedTimestamp: commits[0]?.timestamp || 0,
      commits
    };

    gitCache.set(filePath, info);
    return info;
  } catch {
    return null;
  }
}

/**
 * Format a timestamp for display.
 * Uses relative time for recent updates, absolute for older ones.
 */
function formatLastUpdated(timestamp: number, locale: string = 'en'): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  // For very recent updates, show relative time
  if (days < 1) {
    if (hours >= 1) {
      return `${hours}h ago`;
    }
    if (minutes >= 1) {
      return `${minutes}m ago`;
    }
    return 'just now';
  }
  
  if (days < 7) {
    return `${days}d ago`;
  }

  // For older updates, show date
  const date = new Date(timestamp);
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Load translation strings for a given locale.
 */
function loadPluginStrings(localeId: string): Record<string, string> {
  try {
    const localePath = path.join(i18nDir, `${localeId}.json`);
    if (fs.existsSync(localePath)) {
      return JSON.parse(fs.readFileSync(localePath, 'utf8'));
    }
  } catch { /* fallback below */ }
  try {
    const enPath = path.join(i18nDir, 'en.json');
    if (fs.existsSync(enPath)) {
      return JSON.parse(fs.readFileSync(enPath, 'utf8'));
    }
  } catch { /* silent */ }
  return {};
}

/**
 * Plugin translations hook.
 */
export function translations(localeId: string): Record<string, string> {
  return loadPluginStrings(localeId || 'en');
}

/**
 * Build hook: Reset file-level cache at the start of each build.
 * This runs once per build, ensuring the cache persists across all pages.
 */
export function onConfigResolved(_config: any): void {
  gitCache.clear();
}

/**
 * onBeforeParse: stub for future use (per-page processing).
 */
export function onBeforeParse(_ctx: any): void {
  // Logic removed (moved to onConfigResolved for better performance)
}

/**
 * onBeforeRender: inject git data into frontmatter before the template runs.
 * This is the correct hook for plugins that need source-file-derived data
 * available during template rendering.
 */
export async function onBeforeRender(page: PageContext): Promise<void> {
  const sourcePath = page?.sourcePath;
  if (!sourcePath || !page?.frontmatter) return;

  const gitInfo = await getGitFileInfo(sourcePath);
  if (gitInfo) page.frontmatter._git = gitInfo;
}

/**
 * Generate scripts to inject git i18n strings for the client widget.
 */
export function generateScripts(config: any, options?: any): { headScriptsHtml: string; bodyScriptsHtml: string } {
  const gitConfig = {
    repo: options?.repo || config.editLink?.baseUrl || null,
    branch: options?.branch || 'main',
    editLink: options?.editLink !== false && !!(options?.repo || config.editLink?.baseUrl),
    lastUpdated: options?.lastUpdated !== false,
    commitHistory: options?.commitHistory !== false,
    maxCommits: options?.maxCommits || 5,
    dateFormat: options?.dateFormat || 'relative'
  };

  const localeId = config._activeLocale?.id || 'en';
  const i18nStrings = JSON.stringify(loadPluginStrings(localeId));

  return {
    headScriptsHtml: '',
    bodyScriptsHtml: `<script>window.__git_config=${JSON.stringify(gitConfig)};window.__git_i18n=${i18nStrings}</script>`
  };
}

/**
 * Provide client-side assets.
 * Always returns assets - client-side JS handles graceful degradation.
 */
export function getAssets(_options?: any): any[] {
  // Always include assets - client-side JS handles visibility based on git status
  const distDir = path.resolve(__dirname, '..', 'dist', 'client');
  return [
    {
      src: path.join(distDir, 'git-widget.js'),
      dest: 'assets/js/docmd-git.js',
      type: 'js',
      location: 'body',
      attributes: { type: 'module' }
    },
    {
      src: path.join(distDir, 'git-widget.css'),
      dest: 'assets/css/docmd-git.css',
      type: 'css',
      location: 'head'
    }
  ];
}

export { getGitFileInfo, formatLastUpdated };
