const container = require('markdown-it-container');

module.exports = {
  name: 'common-containers',
  setup(md) {
    // 1. Callout
    md.use(container, 'callout', {
      render: (tokens, idx) => {
        if (tokens[idx].nesting === 1) {
          const info = tokens[idx].info.trim();
          const parts = info.split(' ');
          const type = parts[1] || 'info'; 
          const title = parts.slice(2).join(' ');
          return `<div class="docmd-container callout callout-${type}">${title ? `<div class="callout-title">${title}</div>` : ''}<div class="callout-content">\n`;
        }
        return '</div></div>\n';
      }
    });

    // 2. Card
    md.use(container, 'card', {
      render: (tokens, idx) => {
        if (tokens[idx].nesting === 1) {
          const title = tokens[idx].info.replace('card', '').trim();
          return `<div class="docmd-container card">${title ? `<div class="card-title">${title}</div>` : ''}<div class="card-content">\n`;
        }
        return '</div></div>\n';
      }
    });

    // 3. Collapsible
    md.use(container, 'collapsible', {
      render: (tokens, idx) => {
        if (tokens[idx].nesting === 1) {
          const info = tokens[idx].info.replace('collapsible', '').trim();
          // Check for "open" keyword
          const isOpen = info.startsWith('open ') || info === 'open';
          const title = isOpen ? info.replace('open', '').trim() : info;
          const displayTitle = title || 'Click to expand';
          
          return `<details class="docmd-container collapsible" ${isOpen ? 'open' : ''}>
            <summary class="collapsible-summary">
                <span class="collapsible-title">${displayTitle}</span>
                <span class="collapsible-arrow"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg></span>
            </summary>
            <div class="collapsible-content">\n`;
        }
        return '</div></details>\n';
      }
    });

    // 4. Button (Note: Buttons are often block-level if using :::, or inline if different syntax)
    md.use(container, 'button', {
      render: (tokens, idx) => {
        if (tokens[idx].nesting === 1) {
            const info = tokens[idx].info.trim().substring(6).trim(); // Remove "button"
            
            // Default vars
            let text = 'Button';
            let url = '#';
            let style = '';
            
            // Helper to check if string looks like a URL
            const isUrl = (s) => s.startsWith('http') || s.startsWith('/') || s.startsWith('./') || s.startsWith('#');
            
            const parts = info.split(/\s+/);
            
            // Logic: Scan parts to find the URL. Everything before is Text. Everything after is Color/Style.
            const urlIndex = parts.findIndex(p => isUrl(p));
            
            if (urlIndex > -1) {
                url = parts[urlIndex];
                text = parts.slice(0, urlIndex).join(' ').replace(/_/g, ' '); // Allow underscores for spaces if needed
                
                // Check for color after URL
                if (parts[urlIndex + 1] && parts[urlIndex + 1].startsWith('color:')) {
                    const color = parts[urlIndex + 1].split(':')[1];
                    style = ` style="background-color: ${color}; border-color: ${color}; color: #fff;"`;
                }
            } else {
                // No URL found, assume first part is text
                if (parts.length > 0) text = parts.join(' ');
            }

            // Handle External Link
            let targetAttr = '';
            if (url.startsWith('http')) {
                targetAttr = ' target="_blank" rel="noopener noreferrer"';
            }
            
            return `<a href="${url}" class="docmd-button"${style}${targetAttr}>${text}`;
        }
        return '</a>\n';
      }
    });
  }
};