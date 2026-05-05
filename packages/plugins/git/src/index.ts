/**
 * --------------------------------------------------------------------
 * docmd : the zero-config documentation engine.
 *
 * @package     @docmd/plugin-git
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
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import type { PluginDescriptor } from '@docmd/api';

export const plugin: PluginDescriptor = {
  name: 'git',
  version: '0.7.8',
  capabilities: ['build', 'body', 'assets', 'translations']
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const i18nDir = path.resolve(__dirname, '..', 'i18n');

// Cache for git data to avoid repeated shell calls
const gitCache = new Map<string, GitFileInfo>();

// Track if we're in a git repo (checked once per build)
let _isGitRepoChecked = false;
let _isGitRepo = false;
let _gitRootPath: string | null = null;

export interface GitCommit {
  hash: string;
  shortHash: string;
  author: string;
  email: string;
  date: string;
  timestamp: number;
  message: string;
}

export interface GitFileInfo {
  lastUpdated: string;
  lastUpdatedTimestamp: number;
  commits: GitCommit[];
}

/**
 * Check if the current directory is inside a git repository.
 * Caches the result for the entire build.
 */
function checkGitRepo(cwd: string): boolean {
  if (_isGitRepoChecked) return _isGitRepo;
  
  try {
    const result = execSync('git rev-parse --show-toplevel', { 
      cwd, 
      stdio: 'pipe', 
      encoding: 'utf8' 
    }).trim();
    _isGitRepo = true;
    _gitRootPath = result;
  } catch {
    _isGitRepo = false;
    _gitRootPath = null;
  }
  
  _isGitRepoChecked = true;
  return _isGitRepo;
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
 */
function getGitFileInfo(filePath: string, maxCommits: number = 6): GitFileInfo | null {
  const cwd = path.dirname(filePath);
  
  // Quick exit if not in a git repo
  if (!checkGitRepo(cwd)) {
    return null;
  }

  // Check cache first
  const cacheKey = filePath;
  if (gitCache.has(cacheKey)) {
    return gitCache.get(cacheKey)!;
  }

  try {
    // Get commit history for the file
    // Format: hash|shortHash|author|email|timestamp|message
    const logOutput = execSync(
      `git log -n ${maxCommits} --format="%H|%h|%an|%ae|%at|%s" -- "${path.basename(filePath)}"`,
      { cwd, stdio: 'pipe', encoding: 'utf8' }
    ).trim();

    if (!logOutput) {
      return null;
    }

    const commits: GitCommit[] = logOutput.split('\n').filter(Boolean).map((line: string) => {
      const [hash, shortHash, author, email, timestamp, ...messageParts] = line.split('|');
      const ts = parseInt(timestamp, 10) * 1000;
      return {
        hash,
        shortHash,
        author,
        email,
        date: new Date(ts).toISOString(),
        timestamp: ts,
        message: messageParts.join('|') // In case message contains |
      };
    });

    if (commits.length === 0) {
      return null;
    }

    const info: GitFileInfo = {
      lastUpdated: commits[0]?.date || '',
      lastUpdatedTimestamp: commits[0]?.timestamp || 0,
      commits
    };

    gitCache.set(cacheKey, info);
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
 * Build hook: Reset caches at the start of each build.
 */
export function onBeforeParse({ config }: any): void {
  // Clear all caches at the start of each build
  gitCache.clear();
  _isGitRepoChecked = false;
  _isGitRepo = false;
  _gitRootPath = null;
}

/**
 * Page ready hook: Inject git data into page context.
 */
export async function onPageReady({ html, sourcePath, frontmatter, config }: any): Promise<void> {
  // Skip if git plugin is disabled for this page
  if (frontmatter?.plugins?.git === false) {
    return;
  }

  // Skip if not in a git repo (graceful degradation)
  if (!checkGitRepo(path.dirname(sourcePath))) {
    return;
  }

  const gitInfo = getGitFileInfo(sourcePath);
  if (gitInfo) {
    // Store git info in frontmatter for template access
    frontmatter._git = gitInfo;
  }
}

/**
 * Generate scripts to inject git UI components.
 * Returns empty if not in a git repo (graceful degradation).
 */
export function generateScripts(config: any, options?: any): { headScriptsHtml: string; bodyScriptsHtml: string } {
  // Graceful degradation: if not in a git repo, don't inject anything
  if (!isGitAvailable() || !_isGitRepo) {
    return { headScriptsHtml: '', bodyScriptsHtml: '' };
  }

  const gitConfig = {
    repo: options?.repo || config.editLink?.baseUrl || null,
    branch: options?.branch || 'main',
    editLink: options?.editLink !== false && !!(options?.repo || config.editLink?.baseUrl),
    lastUpdated: options?.lastUpdated !== false,
    commitHistory: options?.commitHistory !== false,
    maxCommits: options?.maxCommits || 6
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
 * Returns empty array if not in a git repo (graceful degradation).
 */
export function getAssets(_options?: any): any[] {
  // Graceful degradation: if not in a git repo, don't inject assets
  if (!_isGitRepo) {
    return [];
  }

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

export { getGitFileInfo, formatLastUpdated, checkGitRepo as isGitRepo };
