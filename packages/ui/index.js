const path = require('path');

module.exports = {
    getTemplatesDir: () => path.join(__dirname, 'templates'),
    getAssetsDir: () => path.join(__dirname, 'assets'),
    // Helper to resolve template paths
    getTemplatePath: (name) => {
        const fileName = name.endsWith('.ejs') ? name : `${name}.ejs`;
        return path.join(__dirname, 'templates', fileName);
    }
};