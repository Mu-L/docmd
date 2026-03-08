const { defineConfig } = require('@docmd/core');

module.exports = defineConfig({
  title: '_playground',
  src: 'docs',
  out: 'site',
  layout: {
    spa: true
  }
});