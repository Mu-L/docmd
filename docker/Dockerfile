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

# Copy everything (excluding files via .dockerignore)
COPY . .

# Install dependencies
RUN pnpm install --frozen-lockfile

# Stub out build scripts that can't run in Docker:
#   - engine-rust-binaries: requires cargo (Rust compiler), not available here
#   - _playground: runs a full docmd build, not needed in the image
RUN node -e "const fs=require('fs'); \
  ['packages/engines/rust-binaries/package.json','packages/_playground/package.json'].forEach(p=>{ \
    const pkg=JSON.parse(fs.readFileSync(p,'utf8')); \
    pkg.scripts=pkg.scripts||{}; pkg.scripts.build='echo skipped'; \
    fs.writeFileSync(p,JSON.stringify(pkg,null,2)); \
  });"

# Build all packages
RUN pnpm -r run build

# Resolve workspace:* deps to real version numbers for standalone use
RUN node scripts/resolve-ws-deps.js

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

# Copy built packages from builder (using wildcards for automation)
# Copy all dist directories and package.json files
COPY --from=builder --chown=docmd:docmd /app/package.json ./package.json
COPY --from=builder --chown=docmd:docmd /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

# Copy all packages (dist, package.json, and necessary assets)
# Exclude _playground and node_modules (we'll copy node_modules separately)
COPY --from=builder --chown=docmd:docmd /app/packages/core ./packages/core
COPY --from=builder --chown=docmd:docmd /app/packages/api ./packages/api
COPY --from=builder --chown=docmd:docmd /app/packages/parser ./packages/parser
COPY --from=builder --chown=docmd:docmd /app/packages/utils ./packages/utils
COPY --from=builder --chown=docmd:docmd /app/packages/ui ./packages/ui
COPY --from=builder --chown=docmd:docmd /app/packages/tui ./packages/tui
COPY --from=builder --chown=docmd:docmd /app/packages/deployer ./packages/deployer
COPY --from=builder --chown=docmd:docmd /app/packages/themes ./packages/themes
COPY --from=builder --chown=docmd:docmd /app/packages/live ./packages/live
COPY --from=builder --chown=docmd:docmd /app/packages/legacy ./packages/legacy

# Copy engines
COPY --from=builder --chown=docmd:docmd /app/packages/engines/js ./packages/engines/js
COPY --from=builder --chown=docmd:docmd /app/packages/engines/rust ./packages/engines/rust

# Copy all plugins using wildcard
COPY --from=builder --chown=docmd:docmd /app/packages/plugins ./packages/plugins

# Copy root node_modules
COPY --from=builder --chown=docmd:docmd /app/node_modules ./node_modules

# Create directories for user content and starter template
RUN mkdir -p /docs /site /template && chown -R docmd:docmd /docs /site /template

# Create a starter template that users can use to initialize new projects
RUN mkdir -p /template/docs /template/assets/css /template/assets/js /template/assets/images

# Create default index.md for starter template
RUN printf '%s\n' \
    '---' \
    'title: "Welcome"' \
    'description: "Welcome to your new documentation site."' \
    '---' \
    '' \
    '# Welcome to Your Docs! 🚀' \
    '' \
    'Congratulations! You have successfully initialised a new **docmd** project.' \
    '' \
    '## Quick Start' \
    '' \
    '```bash' \
    'docmd dev   # Start the dev server' \
    'docmd build # Build for production' \
    '```' \
    '' \
    'Happy documenting! 🎉' \
    > /template/docs/index.md

# Create default docmd.config.json for starter template
RUN printf '%s\n' \
    '{' \
    '  "title": "My Documentation",' \
    '  "description": "Documentation built with docmd",' \
    '  "url": "https://docs.example.com"' \
    '}' \
    > /template/docmd.config.json

# Create wrapper script for docmd CLI
RUN printf '%s\n' \
    '#!/bin/bash' \
    'if [ "$1" = "init" ]; then' \
    '  echo "Initializing new docmd project..."' \
    '  cp -r /template/docs /workspace/ 2>/dev/null || cp -r /template/docs ./ 2>/dev/null || true' \
    '  cp /template/docmd.config.json /workspace/ 2>/dev/null || cp /template/docmd.config.json ./ 2>/dev/null || true' \
    '  echo "✅ Project initialized"' \
    'else' \
    '  node /app/packages/core/dist/bin/docmd.js "$@"' \
    'fi' \
    > /usr/local/bin/docmd && chmod +x /usr/local/bin/docmd

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
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 CMD curl -f http://localhost:3000/ || exit 1

# Default command — exec form (preferred, no shell wrapping, signals pass through)
ENTRYPOINT ["docmd"]
CMD ["dev", "--host", "0.0.0.0"]