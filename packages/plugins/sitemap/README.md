# @docmd/plugin-sitemap

Automatically generates `sitemap.xml` for **docmd** sites.

**Note:** You must set `siteUrl` in your `docmd.config.js` for this plugin to work.

## Configuration
```javascript
// docmd.config.js
module.exports = {
  siteUrl: 'https://mysite.com', // Required
  plugins: {
    sitemap: {
      defaultChangefreq: 'weekly',
      defaultPriority: 0.8
    }
  }
}
```