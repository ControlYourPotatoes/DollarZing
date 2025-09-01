# DollarZing Development Containers

This directory contains configurations for developing inside Docker containers using Cursor IDE.

## Quick Start

1. **Open your project in Cursor**
2. **Press `Ctrl+Shift+P`** (or `Cmd+Shift+P` on Mac)
3. **Type "Dev Containers: Reopen in Container"**
4. **Choose your preferred configuration**

## Available Configurations

### 1. `devcontainer.json` - Simple Node.js Environment

- Uses `node:22` base image
- Includes Git support
- Good for basic development
- **Use this if the Dockerfile version doesn't work**

### 2. `devcontainer-dockerfile.json` - Full Engine Environment

- Uses your existing engine Dockerfile
- Includes all your project dependencies
- Matches your production environment exactly
- **Recommended for full development**

## Alternative: Development Shell Scripts

If you prefer not to use devcontainers, you can use the shell scripts:

### Linux/Mac/WSL:

```bash
./scripts/dev-shell.sh
```

### Windows:

```cmd
scripts\dev-shell.bat
```

## Development Workflow

Once inside the container:

1. **Your code is mounted live** - changes are immediate
2. **Build after changes:**
   ```bash
   npm run build
   ```
3. **Test your CLI:**
   ```bash
   npm run cli simple-test
   npm run cli test-game
   ```
4. **No rebuilding needed!** - Changes are reflected immediately

## Troubleshooting

### If devcontainer fails to build:

1. Try the alternative configuration (`devcontainer-dockerfile.json`)
2. Or use the shell scripts instead
3. Check that Docker Desktop is running

### If you get permission errors:

- The container runs as `node` user by default
- Use `sudo` if you need root access

## Benefits

- ✅ **No more rebuilding containers** for every code change
- ✅ **Live code editing** with immediate feedback
- ✅ **Consistent development environment** across team members
- ✅ **Full IDE integration** with Cursor
- ✅ **Access to all container tools and dependencies**


