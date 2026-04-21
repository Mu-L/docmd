const { defineConfig } = require('@docmd/core');

module.exports = defineConfig({
  // --- Core Metadata ---
  title: '_playground',
  src: 'docs',
  out: 'site',

  // --- Branding ---
  /*
  logo: {
    light: 'assets/images/docmd-logo-dark.png',
    dark: 'assets/images/docmd-logo-light.png',
    alt: 'docmd',
    href: 'https://docmd.io',
  },
  */
  favicon: 'assets/favicon.ico',

  // --- Features & UX ---
  minify: true,
  copyCode: true,

  // --- Theme ---
  theme: {
    name: 'default',
    appearance: 'light',
    codeHighlight: true,
    customCss: [],
  },

  // --- Layout & UI Architecture ---
  layout: {
    spa: true,
    menubar: {
      enabled: true,
      position: 'header',
      left: [ {text: 'Menu 1', url: '/'}, {text: 'Menu 2', url: '/nostyle'} ]
    },
    header: {
      enabled: true
    },
    sidebar: {
      collapsible: true,
      defaultCollapsed: false,
    },
    optionsMenu: {
      position: 'menubar',
      components: {
        search: true,
        themeSwitch: true,
        sponsor: 'https://github.com/sponsors/mgks',
      }
    },
    footer: {
      style: 'minimal',
    }
  },

  // --- Plugins ---
  plugins: {
    math: {},
    // pwa: {},
    // seo: {},
    // analytics: {},
    // sitemap: {},
    // mermaid: {},
    // llms: {},
    // threads: {}
  },

  versions: {
    current: '06',
    position: 'sidebar-top',
    all: [
      { id: '06', dir: 'docs', label: 'v0.6.0 (Latest)' },
      { id: '05', dir: 'docs-05', label: 'v0.5.0',
        navigation: [
          { title: 'V0.5 Home', path: '/', icon: 'home' },
          { title: 'V0.5 Install', path: '/getting-started/installation', icon: 'download' }
        ]
      }
    ]
  },

  // --- i18n (Internationalisation) ---
  // Enables multi-language static generation with locale-first URL routing.
  // Each locale gets its own complete site at /{locale}/ with its own search index.
  i18n: {
    default: 'en',
    locales: [
      { id: 'en', label: 'English', dir: 'ltr' },
      { id: 'hi', label: 'हिन्दी', dir: 'ltr' },
      { id: 'zh', label: '中文', dir: 'ltr' },
      { id: 'es', label: 'Español', dir: 'ltr' },
      { id: 'de', label: 'Deutsch', dir: 'ltr' },
      { id: 'ja', label: '日本語', dir: 'ltr' },
      { id: 'fr', label: 'Français', dir: 'ltr' },
      // { id: 'ar', label: 'العربية', dir: 'rtl' },
    ]
  },

  navigation: [
    { title: 'Latest Home', path: '/', icon: 'home' },
    { title: 'Nostyle', path: '/nostyle', icon: 'file' },
  ]
});