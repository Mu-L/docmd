# Docker Image for docmd

Official Docker image for docmd - the minimalist, zero-config documentation generator.

## Quick Start

### Pull the Image

```bash
# Pull from GitHub Container Registry (GHCR)
docker pull ghcr.io/docmd-io/docmd:0.8.6
```

### Run Demo Site

```bash
# Start with built-in demo site
docker run -p 3000:3000 ghcr.io/docmd-io/docmd:0.8.6

# Visit http://localhost:3000
```

### Initialize New Project

```bash
# Create and initialize a new project
mkdir my-docs && cd my-docs
docker run -v $(pwd):/workspace ghcr.io/docmd-io/docmd:0.8.6 init

# Start dev server
docker run -v $(pwd):/workspace -p 3000:3000 ghcr.io/docmd-io/docmd:0.8.6 dev
```

### Use Existing Docs

```bash
# Mount your docs and start dev server
docker run -v $(pwd)/docs:/docs -p 3000:3000 ghcr.io/docmd-io/docmd:0.8.6

# Build static site
docker run -v $(pwd)/docs:/docs -v $(pwd)/site:/site ghcr.io/docmd-io/docmd:0.8.6 build
```

## Available Tags

| Tag | Description |
|-----|-------------|
| `0.8.6` | Pinned stable release (**recommended for reproducibility**) |
| `edge` | Latest build from the `main` branch — bleeding edge, may be unstable |
| `latest` | Floating alias for the most recent stable release |
| `sha-<commit>` | Specific commit SHA for fully reproducible builds |

> **Why pin a version?** The `:latest` tag is convenient for trying things out, but for production and CI pipelines you should always pin a specific version (e.g. `:0.8.7`). That way your builds are reproducible and won't break when a new release ships. Check the [package versions page](https://github.com/orgs/docmd-io/packages/container/docmd/versions) for the full list.

## Multi-Platform Support

The image is built for multiple architectures:

- `linux/amd64` - Standard x86_64 servers
- `linux/arm64` - ARM-based servers (AWS Graviton, Raspberry Pi, Apple Silicon)

Docker automatically pulls the correct image for your platform.

## Usage Examples

### Docker Compose

```yaml
version: '3.8'

services:
  docmd:
    image: ghcr.io/docmd-io/docmd:0.8.6
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
        run: |
          docker run --rm \
            -v ${{ github.workspace }}/docs:/docs \
            -v ${{ github.workspace }}/site:/site \
            ghcr.io/docmd-io/docmd:0.8.6 \
            build
      
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./site
```

### Kubernetes Deployment

```yaml
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
        image: ghcr.io/docmd-io/docmd:0.8.6
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
docker run --user $(id -u):$(id -g) -v $(pwd)/docs:/docs ghcr.io/docmd-io/docmd:0.8.6
```

### Network Issues

```bash
# Ensure you're binding to 0.0.0.0
docker run -p 3000:3000 ghcr.io/docmd-io/docmd:0.8.6 dev --host 0.0.0.0
```

### Memory Issues

```bash
# For large documentation sites
docker run --memory=2g -v $(pwd)/docs:/docs ghcr.io/docmd-io/docmd:0.8.6 build
```

## License

MIT License - see [LICENSE](../LICENSE) for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/docmd-io/docmd/issues)
- **Documentation**: [docs.docmd.io](https://docs.docmd.io)
- **Website**: [docmd.io](https://docmd.io)
