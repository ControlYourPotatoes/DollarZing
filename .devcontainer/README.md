# DollarZing Development Containers

This directory contains configurations for developing inside Docker containers using Cursor IDE.

## Quick Start

1. **Open your project in Cursor**
2. **Press `Ctrl+Shift+P`** (or `Cmd+Shift+P` on Mac)
3. **Type "Dev Containers: Reopen in Container"**
4. **Choose your preferred configuration**

## Available Configurations

### 1. `devcontainer-full.json` - Complete DollarZing Environment ⭐ **RECOMMENDED**

- Uses custom development Dockerfile
- **Includes Claude Code CLI pre-installed**
- Mounts entire DollarZing project (not just engine)
- Full development tools and VS Code extensions
- **Best for working with Claude Code**

### 2. `devcontainer.json` - Simple Node.js Environment

- Uses `node:22` base image
- Engine-only workspace
- Good for basic engine development
- **Use this if you only need engine work**

### 3. `devcontainer-dockerfile.json` - Engine-Only Environment

- Uses your existing engine Dockerfile
- Engine-focused development
- Matches your production environment
- **For engine-specific work only**

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

### Using the Full Environment (devcontainer-full.json):

1. **Your entire project is mounted live** - changes are immediate
2. **Claude Code is pre-installed** - start chatting immediately:
   ```bash
   claude
   ```
3. **Work on engine:**
   ```bash
   cd engine
   npm run build
   npm run cli simple-test
   ```
4. **Work on frontend:**
   ```bash
   npm run dev  # React dev server
   ```
5. **Access both ports:** Engine (3001) and Frontend (3000)

### Using Engine-Only Environments:

1. **Your engine code is mounted live** - changes are immediate
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


