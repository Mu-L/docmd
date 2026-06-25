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
FROM node:20-alpine AS builder

# Install build dependencies for native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    curl

# Install pnpm directly — avoids corepack version resolution issues in CI.
# Bump the pinned version here whenever the monorepo's packageManager field changes.
RUN npm install -g pnpm@10.33.2

WORKDIR /app

# Copy everything (excluding files via .dockerignore)
COPY . .

# Install dependencies
RUN pnpm install --frozen-lockfile

# Stub out packages that can't build in Docker before running the full build:
#   - engine-rust-binaries: requires cargo; pre-built .node files are in the repo
#   - _playground: dev sandbox, not part of the production image
RUN sh tools/docker-prebuild.sh

# Build all packages
RUN pnpm -r run build

# Resolve workspace:* deps to real version numbers for standalone use
RUN node tools/resolve-ws-deps.js

# Pack all packages into tarballs (mimics npm publish)
RUN pnpm -r pack --pack-destination /tarballs

# -----------------------------------------------------------------------------
# Stage 2: Production stage - minimal image with only runtime dependencies
# -----------------------------------------------------------------------------
FROM node:20-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache \
    git \
    curl \
    bash \
    su-exec

# Install pnpm directly — avoids corepack version resolution issues in CI.
# Bump the pinned version here whenever the monorepo's packageManager field changes.
RUN npm install -g pnpm@10.33.2

# Configure pnpm global directories
ENV PNPM_HOME="/usr/local/share/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN mkdir -p $PNPM_HOME

# Create non-root user for security
RUN addgroup -g 1001 -S docmd && \
    adduser -S -D -H -u 1001 -h /app -s /bin/bash -G docmd -g docmd docmd

WORKDIR /app

# Copy packed tarballs from builder
COPY --from=builder /tarballs /tarballs

# Install ONLY @docmd/core from the tarball — this pulls in all its dependencies
# from the other tarballs, creating the exact same structure as `npm install @docmd/core`
RUN pnpm add --global /tarballs/docmd-core-*.tgz \
    --global-bin-dir=$PNPM_HOME \
    --global-dir=/usr/local/lib/pnpm-global

# Clean up tarballs and pnpm cache to reduce image size
RUN rm -rf /tarballs ~/.local/share/pnpm/store

# Create directories for user content
RUN mkdir -p /docs /site && chown -R docmd:docmd /docs /site

# Seed the default template by running docmd init non-interactively.
# This ensures the image ships exactly what a real `docmd init` produces.
#
# Build does NOT fail on init failure: the image still publishes (so users
# who mount their own /docs are unaffected), but the demo experience is
# degraded and a clear warning is printed. Full stderr from `docmd init`
# is in the build log above this block for diagnosis.
RUN mkdir -p /template && \
    cd /template && \
    if echo 'y' | docmd init; then \
      if [ ! -f /template/docmd.config.json ]; then \
        printf '\n[docmd-docker] WARNING: docmd init exited 0 but /template/docmd.config.json is missing.\n' >&2; \
        printf '[docmd-docker] Demo seeding will not work. Mount your own /docs.\n' >&2; \
      fi; \
    else \
      printf '\n[docmd-docker] WARNING: docmd init failed during image build.\n' >&2; \
      printf '[docmd-docker] The `docker run` demo experience will not work. Mount your own /docs.\n' >&2; \
      printf '[docmd-docker] Full error from docmd init is in the build log above this block.\n' >&2; \
    fi

# Install entrypoint + healthcheck scripts (see docker/docker-entrypoint.sh
# and docker/docker-healthcheck.sh). The entrypoint seeds /docs from
# /template when /docs is empty, so `docker run` with no volume mount
# still works out of the box. The healthcheck probes a port range because
# `docmd dev` may auto-increment past 3000 if the port is already taken.
COPY docker/docker-entrypoint.sh /usr/local/bin/docmd-entrypoint.sh
COPY docker/docker-healthcheck.sh /usr/local/bin/docmd-healthcheck.sh
RUN chmod +x /usr/local/bin/docmd-entrypoint.sh /usr/local/bin/docmd-healthcheck.sh

# Set environment variables
ENV NODE_ENV=production
ENV DOCMD_CONTAINER=true

# Run as root so the entrypoint can inspect /docs ownership and use
# su-exec to re-exec as the correct uid:gid. The entrypoint never stays
# as root — it always drops to the detected uid before exec-ing docmd.
# This is the same pattern used by postgres, redis, and other official images.

# Set working directory to docs (where user content will be mounted)
WORKDIR /docs

# Expose default port (dev server may pick a higher one if 3000 is in use)
EXPOSE 3000

# Health check — probes 3000-3005 to follow the dev server's actual port
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 CMD ["/usr/local/bin/docmd-healthcheck.sh"]

# Default command — entrypoint detects /docs uid, drops privileges, then
# seeds /docs if empty and execs the supplied command.
ENTRYPOINT ["/usr/local/bin/docmd-entrypoint.sh"]
CMD ["dev", "--host", "0.0.0.0"]