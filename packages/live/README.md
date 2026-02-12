# @docmd/live

The browser-based engine that powers the **docmd Live Editor**.

This package bundles the core parser, UI, and themes into a standalone JavaScript bundle that can render documentation client-side without a Node.js server.

## Links
- **Live Demo:** [live.docmd.io](https://live.docmd.io)
- **Main Project:** [github.com/docmd-io/docmd](https://github.com/docmd-io/docmd)

## Usage (CLI)
You can run the editor locally:

```bash
docmd live
```

## Usage (Programmatic)
To embed the editor engine in your own tools:

```javascript
import { buildLive } from '@docmd/core';
await buildLive();
```