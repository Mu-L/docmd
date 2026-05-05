# @docmd/api

Plugin API surface for docmd - hook registration, RPC dispatch, and source editing tools.

This package is the canonical home for the docmd plugin system. It provides:

- **Plugin Loader** - Validates, isolates, and registers plugins with capability-gated hooks
- **Action Dispatcher** - WebSocket RPC system for live-edit actions and fire-and-forget events
- **Source Tools** - Block-level markdown source editing (insert, replace, wrap, remove)
- **Type Definitions** - `PluginDescriptor`, `PluginModule`, `ActionContext`, `SourceTools`, and more

## Usage

```typescript
import { loadPlugins, createActionDispatcher, createSourceTools } from '@docmd/api';
import type { PluginDescriptor, PluginModule } from '@docmd/api';
```

Part of the **[docmd](https://github.com/docmd-io/docmd)** documentation engine.

## Documentation

See **[docs.docmd.io](https://docs.docmd.io)** for full usage and API reference.

## License

MIT