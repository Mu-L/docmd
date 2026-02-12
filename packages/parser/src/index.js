const { createMarkdownProcessor, processContent } = require('./markdown-processor');
const { renderTemplate } = require('./html-renderer');
const { renderIcon } = require('./utils/icon-renderer');
const { validateConfig } = require('./utils/validator');

module.exports = {
  // Logic
  createMarkdownProcessor,
  processContent,
  renderTemplate,
  validateConfig,
  
  // Utils
  renderIcon
};