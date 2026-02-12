# @docmd/plugin-analytics

Injects Google Analytics (GA4) or legacy UA scripts into **docmd** sites.

## Configuration
```javascript
// docmd.config.js
module.exports = {
  plugins: {
    analytics: {
      googleV4: {
        measurementId: 'G-XXXXXXXXXX'
      }
    }
  }
}
```