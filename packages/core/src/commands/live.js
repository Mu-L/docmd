async function buildLive(options = {}) {
  // Delegate to the standalone package
  const livePkg = require('@docmd/live');
  
  // If explicitly asked NOT to serve (for testing), just build
  if (options.serve === false) {
      console.log('🔨 Building Live Editor ...');
      await livePkg.build();
  } else {
      // Default behavior: Build + Serve
      await livePkg.start();
  }
}

module.exports = { buildLive };