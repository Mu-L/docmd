# @docmd/plugin-seo

Generates Meta tags, Open Graph (Facebook), and Twitter Card data for **docmd**.

## Configuration
```javascript
// docmd.config.js
module.exports = {
  plugins: {
    seo: {
      defaultDescription: 'My documentation site',
      twitter: {
        siteUsername: '@myproject'
      }
    }
  }
}
```