# --------------------------------------------------------------------
# docmd : the minimalist, zero-config documentation generator.
#
# @package     @docmd/core (and ecosystem)
# @website     https://docmd.io
# @repository  https://github.com/docmd-io/docmd
# @license     MIT
# @copyright   Copyright (c) 2025-present docmd.io
#
# [docmd-source] - Please do not remove this header.
# --------------------------------------------------------------------
#
# Multi-stage Dockerfile for docmd
# Creates a minimal production image with docmd CLI pre-installed
#
# Usage:
#   Quick Start (with demo site):
#     docker run -p 3000:3000 docmd:latest
#
#   Initialize new project in current directory:
#     docker run -v $(pwd):/workspace docmd:latest init
#
#   Run dev server with your docs:
#     docker run -v $(pwd)/my-docs:/docs -p 3000:3000 docmd:latest dev
#
#   Build static site:
#     docker run -v $(pwd)/docs:/docs -v $(pwd)/site:/site docmd:latest build
#
# --------------------------------------------------------------------

# -----------------------------------------------------------------------------
# Stage 1: Build stage - compiles TypeScript and prepares the application
# -----------------------------------------------------------------------------
FROM node:24-alpine AS builder

# Install build dependencies for native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    curl

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate

WORKDIR /app

# Copy workspace configuration
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY tsconfig.base.json ./

# Copy all package.json files first (for better layer caching)
COPY packages/core/package.json ./packages/core/
COPY packages/api/package.json ./packages/api/
COPY packages/parser/package.json ./packages/parser/
COPY packages/utils/package.json ./packages/utils/
COPY packages/ui/package.json ./packages/ui/
COPY packages/tui/package.json ./packages/tui/
COPY packages/deployer/package.json ./packages/deployer/
COPY packages/themes/package.json ./packages/themes/
COPY packages/live/package.json ./packages/live/
COPY packages/legacy/package.json ./packages/legacy/

# Copy engines packages
COPY packages/engines/js/package.json ./packages/engines/js/
COPY packages/engines/rust/package.json ./packages/engines/rust/
COPY packages/engines/rust/scripts ./packages/engines/rust/scripts/
COPY packages/engines/rust-binaries/package.json ./packages/engines/rust-binaries/

# Copy plugins package.json files
COPY packages/plugins/plugin-analytics/package.json ./packages/plugins/plugin-analytics/
COPY packages/plugins/plugin-git/package.json ./packages/plugins/plugin-git/
COPY packages/plugins/plugin-installer/package.json ./packages/plugins/plugin-installer/
COPY packages/plugins/plugin-llms/package.json ./packages/plugins/plugin-llms/
COPY packages/plugins/plugin-mermaid/package.json ./packages/plugins/plugin-mermaid/
COPY packages/plugins/plugin-openapi/package.json ./packages/plugins/plugin-openapi/
COPY packages/plugins/plugin-pwa/package.json ./packages/plugins/plugin-pwa/
COPY packages/plugins/plugin-search/package.json ./packages/plugins/plugin-search/
COPY packages/plugins/plugin-seo/package.json ./packages/plugins/plugin-seo/
COPY packages/plugins/plugin-sitemap/package.json ./packages/plugins/plugin-sitemap/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages ./packages
COPY scripts ./scripts
COPY LICENSE ./LICENSE

# Build all packages
RUN pnpm -r run build

# Resolve workspace dependencies for publishing
RUN node scripts/resolve-ws-deps.js

# Copy LICENSE to each package
RUN find packages -mindepth 1 -maxdepth 3 -name "package.json" \
    -not -path "*/node_modules/*" \
    -exec dirname {} \; | xargs -I % cp LICENSE %

# -----------------------------------------------------------------------------
# Stage 2: Production stage - minimal image with only runtime dependencies
# -----------------------------------------------------------------------------
FROM node:24-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache \
    git \
    curl \
    bash

# Install pnpm globally for any plugin installations
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate

# Create non-root user for security
RUN addgroup -g 1001 -S docmd && \
    adduser -S -D -H -u 1001 -h /app -s /bin/bash -G docmd -g docmd docmd

WORKDIR /app

# Copy built packages from builder
COPY --from=builder --chown=docmd:docmd /app/packages/core/dist ./packages/core/dist
COPY --from=builder --chown=docmd:docmd /app/packages/core/package.json ./packages/core/
COPY --from=builder --chown=docmd:docmd /app/packages/api/dist ./packages/api/dist
COPY --from=builder --chown=docmd:docmd /app/packages/api/package.json ./packages/api/
COPY --from=builder --chown=docmd:docmd /app/packages/parser/dist ./packages/parser/dist
COPY --from=builder --chown=docmd:docmd /app/packages/parser/package.json ./packages/parser/
COPY --from=builder --chown=docmd:docmd /app/packages/utils/dist ./packages/utils/dist
COPY --from=builder --chown=docmd:docmd /app/packages/utils/package.json ./packages/utils/
COPY --from=builder --chown=docmd:docmd /app/packages/ui/dist ./packages/ui/dist
COPY --from=builder --chown=docmd:docmd /app/packages/ui/package.json ./packages/ui/
COPY --from=builder --chown=docmd:docmd /app/packages/tui/dist ./packages/tui/dist
COPY --from=builder --chown=docmd:docmd /app/packages/tui/package.json ./packages/tui/
COPY --from=builder --chown=docmd:docmd /app/packages/deployer/dist ./packages/deployer/dist
COPY --from=builder --chown=docmd:docmd /app/packages/deployer/package.json ./packages/deployer/
COPY --from=builder --chown=docmd:docmd /app/packages/themes/dist ./packages/themes/dist
COPY --from=builder --chown=docmd:docmd /app/packages/themes/package.json ./packages/themes/
COPY --from=builder --chown=docmd:docmd /app/packages/live/dist ./packages/live/dist
COPY --from=builder --chown=docmd:docmd /app/packages/live/package.json ./packages/live/
COPY --from=builder --chown=docmd:docmd /app/packages/legacy/dist ./packages/legacy/dist
COPY --from=builder --chown=docmd:docmd /app/packages/legacy/package.json ./packages/legacy/

# Copy engines
COPY --from=builder --chown=docmd:docmd /app/packages/engines/js/dist ./packages/engines/js/dist
COPY --from=builder --chown=docmd:docmd /app/packages/engines/js/package.json ./packages/engines/js/
COPY --from=builder --chown=docmd:docmd /app/packages/engines/rust/dist ./packages/engines/rust/dist
COPY --from=builder --chown=docmd:docmd /app/packages/engines/rust/package.json ./packages/engines/rust/
COPY --from=builder --chown=docmd:docmd /app/packages/engines/rust/scripts ./packages/engines/rust/scripts/
COPY --from=builder --chown=docmd:docmd /app/packages/engines/rust/bin ./packages/engines/rust/bin/

# Copy plugins
COPY --from=builder --chown=docmd:docmd /app/packages/plugins/plugin-analytics/dist ./packages/plugins/plugin-analytics/dist
COPY --from=builder --chown=docmd:docmd /app/packages/plugins/plugin-analytics/package.json ./packages/plugins/plugin-analytics/
COPY --from=builder --chown=docmd:docmd /app/packages/plugins/plugin-git/dist ./packages/plugins/plugin-git/dist
COPY --from=builder --chown=docmd:docmd /app/packages/plugins/plugin-git/package.json ./packages/plugins/plugin-git/
COPY --from=builder --chown=docmd:docmd /app/packages/plugins/plugin-installer/dist ./packages/plugins/plugin-installer/dist
COPY --from=builder --chown=docmd:docmd /app/packages/plugins/plugin-installer/package.json ./packages/plugins/plugin-installer/
COPY --from=builder --chown=docmd:docmd /app/packages/plugins/plugin-llms/dist ./packages/plugins/plugin-llms/dist
COPY --from=builder --chown=docmd:docmd /app/packages/plugins/plugin-llms/package.json ./packages/plugins/plugin-llms/
COPY --from=builder --chown=docmd:docmd /app/packages/plugins/plugin-mermaid/dist ./packages/plugins/plugin-mermaid/dist
COPY --from=builder --chown=docmd:docmd /app/packages/plugins/plugin-mermaid/package.json ./packages/plugins/plugin-mermaid/
COPY --from=builder --chown=docmd:docmd /app/packages/plugins/plugin-openapi/dist ./packages/plugins/plugin-openapi/dist
COPY --from=builder --chown=docmd:docmd /app/packages/plugins/plugin-openapi/package.json ./packages/plugins/plugin-openapi/
COPY --from=builder --chown=docmd:docmd /app/packages/plugins/plugin-pwa/dist ./packages/plugins/plugin-pwa/dist
COPY --from=builder --chown=docmd:docmd /app/packages/plugins/plugin-pwa/package.json ./packages/plugins/plugin-pwa/
COPY --from=builder --chown=docmd:docmd /app/packages/plugins/plugin-search/dist ./packages/plugins/plugin-search/dist
COPY --from=builder --chown=docmd:docmd /app/packages/plugins/plugin-search/package.json ./packages/plugins/plugin-search/
COPY --from=builder --chown=docmd:docmd /app/packages/plugins/plugin-seo/dist ./packages/plugins/plugin-seo/dist
COPY --from=builder --chown=docmd:docmd /app/packages/plugins/plugin-seo/package.json ./packages/plugins/plugin-seo/
COPY --from=builder --chown=docmd:docmd /app/packages/plugins/plugin-sitemap/dist ./packages/plugins/plugin-sitemap/dist
COPY --from=builder --chown=docmd:docmd /app/packages/plugins/plugin-sitemap/package.json ./packages/plugins/plugin-sitemap/

# Copy node_modules (production dependencies only)
COPY --from=builder --chown=docmd:docmd /app/node_modules ./node_modules
COPY --from=builder --chown=docmd:docmd /app/packages/core/node_modules ./packages/core/node_modules
COPY --from=builder --chown=docmd:docmd /app/packages/api/node_modules ./packages/api/node_modules
COPY --from=builder --chown=docmd:docmd /app/packages/parser/node_modules ./packages/parser/node_modules
COPY --from=builder --chown=docmd:docmd /app/packages/utils/node_modules ./packages/utils/node_modules
COPY --from=builder --chown=docmd:docmd /app/packages/ui/node_modules ./packages/ui/node_modules
COPY --from=builder --chown=docmd:docmd /app/packages/tui/node_modules ./packages/tui/node_modules
COPY --from=builder --chown=docmd:docmd /app/packages/deployer/node_modules ./packages/deployer/node_modules
COPY --from=builder --chown=docmd:docmd /app/packages/themes/node_modules ./packages/themes/node_modules
COPY --from=builder --chown=docmd:docmd /app/packages/live/node_modules ./packages/live/node_modules
COPY --from=builder --chown=docmd:docmd /app/packages/engines/js/node_modules ./packages/engines/js/node_modules
COPY --from=builder --chown=docmd:docmd /app/packages/engines/rust/node_modules ./packages/engines/rust/node_modules
COPY --from=builder --chown=docmd:docmd /app/packages/plugins/plugin-analytics/node_modules ./packages/plugins/plugin-analytics/node_modules
COPY --from=builder --chown=docmd:docmd /app/packages/plugins/plugin-git/node_modules ./packages/plugins/plugin-git/node_modules
COPY --from=builder --chown=docmd:docmd /app/packages/plugins/plugin-installer/node_modules ./packages/plugins/plugin-installer/node_modules
COPY --from=builder --chown=docmd:docmd /app/packages/plugins/plugin-llms/node_modules ./packages/plugins/plugin-llms/node_modules
COPY --from=builder --chown=docmd:docmd /app/packages/plugins/plugin-mermaid/node_modules ./packages/plugins/plugin-mermaid/node_modules
COPY --from=builder --chown=docmd:docmd /app/packages/plugins/plugin-openapi/node_modules ./packages/plugins/plugin-openapi/node_modules
COPY --from=builder --chown=docmd:docmd /app/packages/plugins/plugin-pwa/node_modules ./packages/plugins/plugin-pwa/node_modules
COPY --from=builder --chown=docmd:docmd /app/packages/plugins/plugin-search/node_modules ./packages/plugins/plugin-search/node_modules
COPY --from=builder --chown=docmd:docmd /app/packages/plugins/plugin-seo/node_modules ./packages/plugins/plugin-seo/node_modules
COPY --from=builder --chown=docmd:docmd /app/packages/plugins/plugin-sitemap/node_modules ./packages/plugins/plugin-sitemap/node_modules

# Copy package.json for monorepo root
COPY --from=builder --chown=docmd:docmd /app/package.json ./package.json

# Create directories for user content and starter template
RUN mkdir -p /docs /site /template && chown -R docmd:docmd /docs /site /template

# Create a starter template that users can use to initialize new projects
# This template will be copied when running: docker run docmd init
RUN mkdir -p /template/docs /template/assets/css /template/assets/js /template/assets/images

# Create default index.md for starter template
RUN echo '---\ntitle: "Welcome"\ndescription: "Welcome to your new documentation site."\n---\n\n# Welcome to Your Docs! 🚀\n\nCongratulations! You have successfully initialised a new **docmd** project.\n\n## Quick Start\n\nYou are currently viewing `docs/index.md`.\n\n```bash\nnpx @docmd/core dev   # Start the dev server\nnpx @docmd/core build # Build for production\n```\n\n## Features Demo\n\n### 1. Smart Containers\n::: callout tip "Did you know?"\nYou can nest containers, add custom titles, and use emojis! :tada:\n:::\n\n::: card "Flexible Structure"\nOrganise your content with cards.\n::: button "View Documentation" https://docs.docmd.io\n:::\n\n### 2. Tabs & Code\n::: tabs\n== tab "JavaScript"\n```javascript\nconsole.log('\''Hello World'\'');\n```\n\n== tab "Python"\n```python\nprint('\''Hello World'\'')\n```\n:::\n\n### 3. Plugins (Enabled by Default)\n- **Search**\n- **Sitemap**\n- **SEO Optimisation**\n- **Git Integration**\n- **Mermaid Diagrams**\n- **LLMs Context**\n\n## Next Steps\n- **[Official Documentation](https://docs.docmd.io)**\n- **[Customise Theme](https://docs.docmd.io/theming/available-themes)**\n- **[Deploy Site](https://docs.docmd.io/deployment)**\n\nHappy documenting! 🎉' > /template/docs/index.md

# Create default docmd.config.json for starter template
RUN echo '{\n  "title": "My Documentation",\n  "description": "Documentation built with docmd",\n  "url": "https://docs.example.com",\n  "navigation": [\n    {\n      "group": "Getting Started",\n      "items": [\n        { "title": "Installation", "path": "https://docs.docmd.io/getting-started/installation", "icon": "download", "external": true },\n        { "title": "Configuration", "path": "https://docs.docmd.io/configuration/overview", "icon": "cog", "external": true }\n      ]\n    },\n    { "title": "GitHub", "path": "https://github.com/docmd-io/docmd", "icon": "github", "external": true }\n  ],\n  "plugins": {\n    "git": {\n      "commitHistory": true,\n      "maxCommits": 5\n    },\n    "seo": {\n      "defaultDescription": "Documentation built with docmd."\n    }\n  }\n}' > /template/docmd.config.json

# Create a simple package.json for the starter template
RUN echo '{\n  "name": "my-docs",\n  "version": "0.0.1",\n  "private": true,\n  "type": "module",\n  "scripts": {\n    "dev": "docmd dev",\n    "build": "docmd build",\n    "preview": "npx serve site"\n  },\n  "dependencies": {\n    "@docmd/core": "latest"\n  }\n}' > /template/package.json

# Create wrapper script for docmd CLI
RUN echo '#!/bin/bash\n# Handle special "init" command to copy starter template\nif [ "$1" = "init" ]; then\n  echo "Initializing new docmd project..."\n  if [ -d "/workspace" ]; then\n    # Copy template to mounted workspace\n    cp -r /template/docs /workspace/ 2>/dev/null || true\n    cp -r /template/assets /workspace/ 2>/dev/null || true\n    cp /template/docmd.config.json /workspace/ 2>/dev/null || true\n    cp /template/package.json /workspace/ 2>/dev/null || true\n    echo "✅ Project initialized in /workspace"\n    echo ""\n    echo "Next steps:"\n    echo "  cd /workspace"\n    echo "  docmd dev"\n  else\n    # Copy template to current working directory\n    cp -r /template/docs ./ 2>/dev/null || true\n    cp -r /template/assets ./ 2>/dev/null || true\n    cp /template/docmd.config.json ./ 2>/dev/null || true\n    cp /template/package.json ./ 2>/dev/null || true\n    echo "✅ Project initialized in $(pwd)"\n    echo ""\n    echo "Next steps:"\n    echo "  docmd dev"\n  fi\nelse\n  # Run docmd CLI normally\n  node /app/packages/core/dist/bin/docmd.js "$@"\nfi' > /usr/local/bin/docmd && \
    chmod +x /usr/local/bin/docmd

# Set environment variables
ENV NODE_ENV=production
ENV DOCMD_CONTAINER=true

# Switch to non-root user
USER docmd

# Set working directory to docs (where user content will be mounted)
WORKDIR /docs

# Expose default port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/ || exit 1

# Default command - start dev server with starter template if no docs exist
# Users can override: docker run docmd build
ENTRYPOINT ["docmd"]
CMD ["dev", "--host", "0.0.0.0"]