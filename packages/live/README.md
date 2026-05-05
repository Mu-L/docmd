# @docmd/live

The browser-based bundle that powers the docmd Live Editor - packages the core parser, UI, and themes into a single standalone script that renders documentation client-side without a Node.js server.

**Live demo:** **[live.docmd.io](https://live.docmd.io)**

## Quick start

```bash
# Run the editor locally
docmd live
```

```js
// Embed the editor engine in your own tooling
import { buildLive } from '@docmd/core';
await buildLive();
```

Part of the **[docmd](https://github.com/docmd-io/docmd)** documentation engine.

## Documentation

See **[docs.docmd.io](https://docs.docmd.io)** for full usage and API reference.

## License

MIT