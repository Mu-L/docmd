# @docmd/deployer

Deployment configuration generator for **[docmd](https://github.com/docmd-io/docmd)** - the zero-config documentation engine.

Generates production-ready deployment files from your `docmd.config.json`. All outputs are personalised to your project; no generic copy-paste templates.

## Supported Targets

### Self-hosted

| Flag | Output |
|------|--------|
| `--docker` | `Dockerfile` + `.dockerignore` |
| `--nginx` | Production-hardened `nginx.conf` |
| `--caddy` | HTTPS-ready `Caddyfile` |

### Cloud & CI

| Flag | Output |
|------|--------|
| `--github-pages` | `.github/workflows/deploy.yml` (GitHub Actions) |
| `--vercel` | `vercel.json` |
| `--netlify` | `netlify.toml` |

## Usage

This package is invoked via the `docmd` CLI. You do not need to import it directly.

```bash
# Self-hosted
docmd deploy --docker
docmd deploy --nginx
docmd deploy --caddy

# Cloud / CI
docmd deploy --github-pages
docmd deploy --vercel
docmd deploy --netlify

# Combine targets
docmd deploy --docker --nginx
```

Every run reads your `docmd.config.json` and regenerates the files to match. Zero-config projects use the same defaults as `docmd build`.

## Architecture

```
@docmd/deployer
  src/
    context.ts          Shared DeployContext type
    index.ts            Orchestrator - resolves options, writes files
    providers/
      docker.ts         Dockerfile + .dockerignore
      nginx.ts          nginx.conf
      caddy.ts          Caddyfile
      github-pages.ts   GitHub Actions deploy workflow
      vercel.ts         vercel.json
      netlify.ts        netlify.toml
```

Each provider is a pure function `(ctx: DeployContext) => string` - no side effects, no I/O. File writing is handled by the orchestrator. Adding a new provider is a single file with no changes to other providers.

**Dependency graph (no cycles):**

```
@docmd/core  →  @docmd/deployer  →  @docmd/api
```

Config resolution (`loadConfig`, `normalizeConfig`) stays in `@docmd/core` to keep `@docmd/deployer` free of any dependency on its parent package.

## Documentation

See **[docmd.io/deployment](https://docmd.io/deployment)** for detailed, service-specific guides.

## License

MIT - Copyright (c) 2025-present docmd.io