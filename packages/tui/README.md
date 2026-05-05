# @docmd/tui

Terminal User Interface (TUI) design system for docmd.

This package provides a unified, high-signal design system for all terminal output across the docmd ecosystem. It ensures a consistent, professional, and emoji-free aesthetic for core tools and third-party plugins.

## Features

- **Semantic Styling** - Predefined color tokens for consistent visual feedback
- **Layout Components** - Box-drawing based sections, dividers, and footers
- **Progress Tracking** - Standardized step-by-step progress logging
- **Zero Configuration** - Works out of the box with reasonable defaults
- **Universal Branding** - Centralised ASCII logo for consistent brand presence

## Usage

```typescript
import { TUI } from '@docmd/tui';

TUI.banner(undefined, '0.7.7');
TUI.section('Building Site');
TUI.step('Parsing content', 'DONE');
TUI.footer();
```

Part of the **[docmd](https://github.com/docmd-io/docmd)** documentation engine.

## Documentation

See **[docs.docmd.io](https://docs.docmd.io)** for full usage and API reference.

## License

MIT