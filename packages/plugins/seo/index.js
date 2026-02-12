/**
 * Generates HTML meta tags for a specific page.
 * @param {Object} config - Project config
 * @param {Object} pageData - { frontmatter, outputPath }
 * @param {string} relativePathToRoot - Path relative to root (for assets)
 * @returns {string} HTML string of meta tags
 */
function generateMetaTags(config, pageData, relativePathToRoot) {
  let html = '';
  const { frontmatter, outputPath } = pageData;
  const seo = frontmatter.seo || {}; // Page-specific SEO overrides
  const globalSeo = config.plugins?.seo || {};

  // 1. Robots
  if (frontmatter.noindex || seo.noindex) {
    return '<meta name="robots" content="noindex">\n';
  }

  // 2. Basic Meta
  const siteTitle = config.siteTitle;
  const pageTitle = frontmatter.title || 'Untitled';
  const description = seo.description || frontmatter.description || globalSeo.defaultDescription || '';
  
  html += `<meta name="description" content="${description}">\n`;

  // 3. Canonical URL
  const siteUrl = config.siteUrl ? config.siteUrl.replace(/\/$/, '') : '';
  // Convert "guide/index.html" -> "/guide/"
  const urlPath = outputPath.replace(/(^|\/)index\.html$/, '$1'); 
  const pageUrl = `${siteUrl}/${urlPath.replace(/^\//, '')}`;
  
  const canonical = seo.canonicalUrl || frontmatter.canonicalUrl || pageUrl;
  if(canonical) {
      html += `<link rel="canonical" href="${canonical}">\n`;
  }

  // 4. Open Graph (Facebook/LinkedIn)
  html += `<meta property="og:title" content="${pageTitle} : ${siteTitle}">\n`;
  html += `<meta property="og:description" content="${description}">\n`;
  html += `<meta property="og:url" content="${pageUrl}">\n`;
  html += `<meta property="og:type" content="${seo.ogType || frontmatter.ogType || 'website'}">\n`;

  // Image Logic
  let image = seo.image || frontmatter.image || globalSeo.openGraph?.defaultImage;
  if (image) {
    if (!image.startsWith('http')) {
      // Resolve relative image path to absolute URL
      image = `${siteUrl}/${image.replace(/^\.?\//, '')}`;
    }
    html += `<meta property="og:image" content="${image}">\n`;
  }

  // 5. Twitter
  const cardType = seo.twitterCard || globalSeo.twitter?.cardType || 'summary_large_image';
  html += `<meta name="twitter:card" content="${cardType}">\n`;
  
  if (globalSeo.twitter?.siteUsername) {
    html += `<meta name="twitter:site" content="${globalSeo.twitter.siteUsername}">\n`;
  }
  
  html += `<meta name="twitter:title" content="${pageTitle}">\n`;
  html += `<meta name="twitter:description" content="${description}">\n`;
  if (image) {
    html += `<meta name="twitter:image" content="${image}">\n`;
  }

  // 6. Keywords
  const keywords = seo.keywords || frontmatter.keywords;
  if (keywords) {
    const kwStr = Array.isArray(keywords) ? keywords.join(', ') : keywords;
    html += `<meta name="keywords" content="${kwStr}">\n`;
  }

  return html;
}

module.exports = { generateMetaTags };