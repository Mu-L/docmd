import { injectComponentStyles } from '../components/styles';

const THEME_STYLE_ID = 'threads-theme-bridge';

export function initThemeBridge(): void {
  injectThemeCSS();
  syncDarkMode();
  observeThemeChanges();
  injectComponentStyles();
}

function injectThemeCSS(): void {
  if (document.getElementById(THEME_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = THEME_STYLE_ID;
  style.textContent = `
    :root {
      --sl-color-neutral-0: var(--tc-bg, hsl(0 0% 100%));
      --sl-color-neutral-50: var(--tc-muted, hsl(0 0% 96.1%));
      --sl-color-neutral-200: var(--tc-border, hsl(0 0% 89.8%));
      --sl-color-neutral-900: var(--tc-fg, hsl(0 0% 9%));
      --sl-color-neutral-500: var(--tc-muted-fg, hsl(0 0% 45.1%));
      --sl-color-primary-600: var(--tc-fg, hsl(0 0% 9%));
      --sl-color-primary-50: var(--tc-muted, hsl(0 0% 96.1%));
      --sl-focus-ring-color: var(--tc-ring, hsl(0 0% 9%));
      --sl-font-sans: var(--tc-font, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
      --sl-font-mono: var(--font-family-mono, SFMono-Regular, Consolas, Menlo, monospace);
    }

    .threads-highlight {
      background-color: hsl(48 96% 89% / 0.5);
      border-bottom: 2px solid hsl(48 96% 53% / 0.6);
      cursor: pointer;
      transition: background-color 0.15s;
      border-radius: 1px;
    }
    .threads-highlight:hover {
      background-color: hsl(48 96% 89% / 0.8);
    }
    .threads-highlight--resolved {
      background-color: hsl(142 76% 36% / 0.1);
      border-bottom-color: hsl(142 76% 36% / 0.3);
    }
    .threads-highlight--resolved:hover {
      background-color: hsl(142 76% 36% / 0.2);
    }
    .threads-highlight--flash {
      animation: threads-flash 0.8s ease-out;
    }
    @keyframes threads-flash {
      0%, 40% { background-color: hsl(48 96% 53% / 0.5); }
      100% { background-color: hsl(48 96% 89% / 0.5); }
    }
  `;
  document.head.appendChild(style);
}

function syncDarkMode(): void {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  document.documentElement.classList.toggle('sl-theme-dark', isDark);
}

function observeThemeChanges(): void {
  const observer = new MutationObserver(() => syncDarkMode());
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
}
