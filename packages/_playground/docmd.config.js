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
    defaultMode: 'light',
    codeHighlight: true,
    customCss: [],
  },

  // --- Layout & UI Architecture ---
  layout: {
    spa: true,
    menubar: {
      enabled: true,
      position: 'header',
    },
    header: {
      enabled: false
    },
    sidebar: {
      collapsible: true,
      defaultCollapsed: false,
    },
    optionsMenu: {
      position: 'header',
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
    // search: {},
    // pwa: {},
    // seo: {},
    // analytics: {},
    // sitemap: {},
    // mermaid: {},
    // llms: {}
  },

  versions: {},

  // --- Navigation (Remains Unchanged) ---
  navigation: [],
});