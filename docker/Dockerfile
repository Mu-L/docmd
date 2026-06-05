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

# Stub out packages that can't build in Docker before running the full build:
#   - engine-rust-binaries: requires cargo; pre-built .node files are in the repo
#   - _playground: dev sandbox, not part of the production image
RUN sh scripts/docker-prebuild.sh

# Build all packages
RUN pnpm -r run build

# Resolve workspace:* deps to real version numbers for standalone use
RUN node scripts/resolve-ws-deps.js

# Pack all packages into tarballs (mimics npm publish)
RUN pnpm -r pack --pack-destination /tarballs

# -----------------------------------------------------------------------------
# Stage 2: Production stage - minimal image with only runtime dependencies
# -----------------------------------------------------------------------------
FROM node:24-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache \
    git \
    curl \
    bash

# Install pnpm globally
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate

# Configure pnpm global directories
ENV PNPM_HOME="/usr/local/share/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN mkdir -p $PNPM_HOME && pnpm setup

# Create non-root user for security
RUN addgroup -g 1001 -S docmd && \
    adduser -S -D -H -u 1001 -h /app -s /bin/bash -G docmd -g docmd docmd

WORKDIR /app

# Copy packed tarballs from builder
COPY --from=builder /tarballs /tarballs

# Install ONLY @docmd/core from the tarball — this pulls in all its dependencies
# from the other tarballs, creating the exact same structure as `npm install @docmd/core`
RUN pnpm add --global /tarballs/docmd-core-*.tgz \
    --prefer-offline \
    --registry file:///tarballs

# Clean up tarballs and pnpm cache to reduce image size
RUN rm -rf /tarballs ~/.local/share/pnpm/store

# Create directories for user content
RUN mkdir -p /docs /site && chown -R docmd:docmd /docs /site

# Seed the default template by running docmd init non-interactively.
# This ensures the image ships exactly what a real `docmd init` produces.
RUN mkdir -p /template && \
    cd /template && \
    echo 'y' | docmd init || true

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