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
  navigation: [
    { title: 'Latest Home', path: '/', icon: 'home' },
    { title: 'No Style Page', path: '/nostyle.md', icon: 'file' }
  ]
});