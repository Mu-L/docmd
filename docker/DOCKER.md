# Docker Image for docmd

Official Docker image for docmd - the minimalist, zero-config documentation generator.

## Quick Start

> The examples below use `:latest` so you can copy-paste and run them immediately.
> **For production, CI, and any reproducible build**, replace `:latest` with the specific version you want — see [Available Tags](#available-tags).

### Pull the Image

```bash
# Pull from GitHub Container Registry (GHCR)
docker pull ghcr.io/docmd-io/docmd:latest
```

### Run Demo Site

The image ships with a demo template in `/template`. When you run the container with no volume mount, the entrypoint copies `/template` into `/docs` on first start, so the demo site comes up immediately.

```bash
# Start with built-in demo site — works out of the box
docker run -p 3000:3000 ghcr.io/docmd-io/docmd:latest

# Visit http://localhost:3000
```

### Initialize New Project

```bash
# Create and initialize a new project
mkdir my-docs && cd my-docs
docker run -v $(pwd):/workspace ghcr.io/docmd-io/docmd:latest init

# Start dev server
docker run -v $(pwd):/workspace -p 3000:3000 ghcr.io/docmd-io/docmd:latest dev
```

### Use Existing Docs

Mounting your own docs into `/docs` always wins — the entrypoint only seeds the demo template when `/docs` is completely empty, so your content is never overwritten.

```bash
# Mount your docs and start dev server
docker run -v $(pwd)/docs:/docs -p 3000:3000 ghcr.io/docmd-io/docmd:latest

# Build static site
docker run -v $(pwd)/docs:/docs -v $(pwd)/site:/site ghcr.io/docmd-io/docmd:latest build
```

## Available Tags

The image is published with two tags per release:

| Tag | Description | When to use |
|-----|-------------|-------------|
| `latest` | Floating alias for the most recent stable release | Quick start, local exploration, throwaway CI |
| `<X.Y.Z>` | Pinned stable release (substitute the version you want) | Production, CI/CD, anything that must be reproducible |

> **Pin a specific version in production.** The examples below use `:latest` so you can copy-paste and run them immediately. For any pipeline whose output must be reproducible (or whose contracts you don't want silently changing), replace `:latest` with the specific version you want (e.g. `0.8.7`). Check the [package versions page](https://github.com/orgs/docmd-io/packages/container/docmd/versions) for the full list.

## Multi-Platform Support

The image is built for multiple architectures:

- `linux/amd64` - Standard x86_64 servers
- `linux/arm64` - ARM-based servers (AWS Graviton, Raspberry Pi, Apple Silicon)

Docker automatically pulls the correct image for your platform.

## Usage Examples

### Docker Compose

```yaml
# Replace `:latest` with a specific version (e.g. `0.8.7`) for reproducible
# production builds. See the GitHub releases page for available versions.
services:
  docmd:
    image: ghcr.io/docmd-io/docmd:latest
    ports:
      - "3000:3000"
    volumes:
      - ./docs:/docs
      - ./site:/site
    command: dev --host 0.0.0.0
```

### GitHub Actions CI/CD

```yaml
name: Build Docs

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Build documentation
        # Pin to a specific version (replace `:latest`) for reproducible CI runs.
        run: |
          docker run --rm \
            -v ${{ github.workspace }}/docs:/docs \
            -v ${{ github.workspace }}/site:/site \
            ghcr.io/docmd-io/docmd:latest \
            build
      
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./site
```

### Kubernetes Deployment

```yaml
# Replace `:latest` with a specific version (e.g. `0.8.7`) for reproducible
# production deploys. Update the tag when you upgrade.
apiVersion: apps/v1
kind: Deployment
metadata:
  name: docmd-server
spec:
  replicas: 1
  selector:
    matchLabels:
      app: docmd
  template:
    metadata:
      labels:
        app: docmd
    spec:
      containers:
      - name: docmd
        image: ghcr.io/docmd-io/docmd:latest
        ports:
        - containerPort: 3000
        volumeMounts:
        - name: docs
          mountPath: /docs
        command: ["docmd", "dev", "--host", "0.0.0.0"]
      volumes:
      - name: docs
        configMap:
          name: docs-content
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Node environment | `production` |
| `DOCMD_CONTAINER` | Container mode flag | `true` |

## Building Locally

```bash
# Clone the repository
git clone https://github.com/docmd-io/docmd.git
cd docmd

# Build the image
docker build -t docmd:local -f docker/Dockerfile .

# Test the build
docker run --rm -v $(pwd)/docs:/docs docmd:local --version
```

## Security Features

- Runs as non-root user (`docmd`)
- Minimal Alpine Linux base image
- Multi-stage build reduces attack surface
- SBOM (Software Bill of Materials) included
- OCI provenance attestation

## Health Check

The image includes a health check that verifies the dev server is running:

```bash
# Check container health
docker inspect --format='{{.State.Health.Status}}' <container-id>
```

## Troubleshooting

### Permission Issues

```bash
# Fix permissions on host
chmod -R 755 ./docs

# Or run with specific user
docker run --user $(id -u):$(id -g) -v $(pwd)/docs:/docs ghcr.io/docmd-io/docmd:latest
```

### Network Issues

```bash
# Ensure you're binding to 0.0.0.0
docker run -p 3000:3000 ghcr.io/docmd-io/docmd:latest dev --host 0.0.0.0
```

### Memory Issues

```bash
# For large documentation sites
docker run --memory=2g -v $(pwd)/docs:/docs ghcr.io/docmd-io/docmd:latest build
```

## License

MIT License - see [LICENSE](../LICENSE) for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/docmd-io/docmd/issues)
- **Documentation**: [docs.docmd.io](https://docs.docmd.io)
- **Website**: [docmd.io](https://docmd.io)