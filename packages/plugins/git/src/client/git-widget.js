/**
 * --------------------------------------------------------------------
 * docmd : the zero-config documentation engine.
 *
 * @package     @docmd/plugin-git (client)
 * @website     https://docmd.io
 * @repository  https://github.com/docmd-io/docmd
 * @license     MIT
 * @copyright   Copyright (c) 2025-present docmd.io
 *
 * [docmd-source] - Please do not remove this header.
 * --------------------------------------------------------------------
 */

(function() {
  const config = window.__git_config || {};
  const i18n = window.__git_i18n || {};
  const gitData = window.__git_page_data || null;

  if (!gitData && !config.lastUpdated) return;

  /**
   * Format timestamp for display.
   */
  function formatTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days < 1) {
      if (hours >= 1) return i18n.hoursAgo?.replace('{n}', hours) || `${hours}h ago`;
      if (minutes >= 1) return i18n.minutesAgo?.replace('{n}', minutes) || `${minutes}m ago`;
      return i18n.justNow || 'just now';
    }
    
    if (days < 7) {
      return i18n.daysAgo?.replace('{n}', days) || `${days}d ago`;
    }

    const date = new Date(timestamp);
    return date.toLocaleDateString(document.documentElement.lang || 'en', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  /**
   * Create the last updated element.
   */
  function createLastUpdatedEl() {
    if (!gitData?.lastUpdatedTimestamp) return null;

    const el = document.createElement('span');
    el.className = 'git-last-updated';
    el.setAttribute('data-timestamp', gitData.lastUpdatedTimestamp);
    
    const label = i18n.lastUpdated || 'Last updated';
    const time = formatTime(gitData.lastUpdatedTimestamp);
    
    el.innerHTML = `
      <svg class="git-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 6 12 12 16 14"></polyline>
      </svg>
      <span class="git-label">${label}:</span>
      <span class="git-time">${time}</span>
    `;

    // Add commit history tooltip if available
    if (config.commitHistory && gitData.commits?.length > 0) {
      el.classList.add('has-history');
      el.setAttribute('tabindex', '0');
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', i18n.viewCommitHistory || 'View commit history');
      
      const tooltip = createCommitTooltip(gitData.commits);
      el.appendChild(tooltip);

      // Show/hide tooltip on hover and focus
      el.addEventListener('mouseenter', () => tooltip.classList.add('visible'));
      el.addEventListener('mouseleave', () => tooltip.classList.remove('visible'));
      el.addEventListener('focus', () => tooltip.classList.add('visible'));
      el.addEventListener('blur', () => tooltip.classList.remove('visible'));
    }

    return el;
  }

  /**
   * Create the commit history tooltip.
   */
  function createCommitTooltip(commits) {
    const tooltip = document.createElement('div');
    tooltip.className = 'git-commit-tooltip';
    tooltip.setAttribute('role', 'tooltip');

    const title = document.createElement('div');
    title.className = 'git-tooltip-title';
    title.textContent = i18n.recentCommits || 'Recent commits';
    tooltip.appendChild(title);

    const list = document.createElement('ul');
    list.className = 'git-commit-list';

    commits.slice(0, config.maxCommits || 6).forEach(commit => {
      const item = document.createElement('li');
      item.className = 'git-commit-item';
      
      // Generate avatar from email (Gravatar-style hash or initials)
      const initials = commit.author.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      
      item.innerHTML = `
        <div class="git-commit-avatar" title="${commit.author}">${initials}</div>
        <div class="git-commit-details">
          <div class="git-commit-message" title="${commit.message}">${truncate(commit.message, 40)}</div>
          <div class="git-commit-meta">
            <span class="git-commit-author">${commit.author}</span>
            <span class="git-commit-date">${formatTime(commit.timestamp)}</span>
          </div>
        </div>
      `;
      
      list.appendChild(item);
    });

    tooltip.appendChild(list);
    return tooltip;
  }

  /**
   * Truncate text with ellipsis.
   */
  function truncate(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * Initialise the git widget.
   */
  function init() {
    const footerActions = document.querySelector('.page-footer-actions');
    if (!footerActions) return;

    // Create last updated element
    const lastUpdatedEl = createLastUpdatedEl();
    if (lastUpdatedEl) {
      // Insert at the beginning (left side)
      footerActions.insertBefore(lastUpdatedEl, footerActions.firstChild);
      
      // Add spacer to push edit link to the right
      const spacer = document.createElement('span');
      spacer.className = 'git-spacer';
      footerActions.insertBefore(spacer, lastUpdatedEl.nextSibling);
    }
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Re-run on SPA navigation
  if (window.docmd?.afterReload) {
    window.docmd.afterReload(init);
  }
})();