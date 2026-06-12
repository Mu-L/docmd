---
title: "docmd _playground"
description: "A testing ground for docmd core engine features."
---

This playground is used to verify core engine changes in real-time. Use this to ensure your modifications to the Markdown parser or UI components behave as expected.

::: callout tip "How to work here"
To test your changes, keep the dev server running (`pnpm run dev`). Any change you make to `packages/core` or `packages/parser` will trigger a hot-reload here instantly.
:::

# H1 Test Heading

This is a test H1 heading to verify it appears in the TOC and has proper anchor links.

### Component Verification

Test your UI components and parser rules here to ensure consistency:

::: card "Container Test"
    Test nested callouts and containers.

    ::: callout warning "Warning"
    Ensure nested items render correctly.
    :::
:::

::: tabs
== tab "Feature A"
#### Feature A
Verification content.
== tab "Feature B"
#### Feature B
Verification content.
:::

### 🔗 Useful Links

- [Official Documentation](https://docs.docmd.io)
- [GitHub Repository](https://github.com/docmd-io/docmd)
- [Report an Issue](https://github.com/docmd-io/docmd/issues)

### 🧪 Developer Checklist
- [ ] **Parser:** Does the Markdown output match the HTML in `packages/parser/src/html-renderer.js`?
- [ ] **UI:** Does the theme CSS apply to this page correctly?
- [ ] **SPA:** Does navigation between pages work without a hard refresh?

### 🧜‍♀️ Mermaid Interactive Test

Test the new interactive controls (Pan, Zoom, Fullscreen) and Lucide icon support here:

#### Complex Flowchart
```mermaid
graph TD
    Start((Start)) --> Process1[Process One]
    Process1 --> Decision{Is it valid?}
    Decision -- Yes --> Process2[Process Two]
    Decision -- No --> Error[Error Handling]
    Process2 --> Subgraph1
    subgraph Subgraph1 [Critical Path]
        Step1[Step 1] --> Step2[Step 2]
    end
    Step2 --> End((End))
    Error --> End
```

#### Architecture Diagram (Lucide Icons)
```mermaid
flowchart TD
    A[Trigger: aaaa] --> B[take an action]
    B --> C[x]
    C --> D{yyy?}
    D -->|No| E[Return]
    D -->|Yes| F{zzz?}
```

#### Code Block with Title
```typescript "main.ts"
function hello() {
  console.log("Hello from docmd!");
}
```

#### Math Plugin Test

$$
\sum_{i=1}^n i^2 = \frac{n(n+1)(2n+1)}{6}
$$

### 🪜 Steps Container Test

::: steps
1. #### Step One: Initialization
   Install dependencies and configure your environment.
2. #### Step Two: Configuration
   Modify `docmd.config.json` to suit your project needs.
3. #### Step Three: Build
   Run `pnpm build` to compile the templates and documents.
:::

### 📅 Changelog Container Test

::: changelog
== v0.8.7 - "Refining Summer Theme"
Refined the Summer theme Table of Contents thread, active ancestor branch indicators, and spacing of components.
* Fixed search modal styling.
* Added custom styling for steps, tabs, cards, and details containers.

== v0.8.0 - "Release of docmd 0.8"
Initial preview of the zero-config documentation engine with monorepo workspace support.
:::