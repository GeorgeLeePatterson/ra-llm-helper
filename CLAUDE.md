# CLAUDE.md - Rust LSP Integration

## Quick Start for Rust Development

1. **Start the LSP daemon** (from workspace root):
   ```bash
   ./scripts/lsp-start.sh
   ```

2. **Use LSP commands** (from anywhere):
   ```bash
   # Check for errors/types
   bun scripts/lsp-client.js hover clickhouse-datafusion/src/file.rs 10:5
   bun scripts/lsp-client.js symbols clickhouse-datafusion/src/file.rs
   ```

## Workspace Configuration

The `workspace.config` file defines your project structure:
- `main_project`: The project you're editing (e.g., `clickhouse-datafusion`)
- `reference_projects`: Read-only projects for type lookups

## Key Rules

1. **NO cd commands** - Everything works from workspace root
2. **Always check types/errors before editing**
3. **The daemon must be running for any Rust work**
4. **NEVER use 'cd'. Always stay in root directory and run everything from root directory.**

## Common Commands

```bash
# Start daemon
./scripts/lsp-start.sh

# Check status
bun scripts/lsp-client.js status

# Get type info
bun scripts/lsp-client.js hover <project>/src/<file>.rs <line>:<col>

# Find definition
bun scripts/lsp-client.js def <project>/src/<file>.rs <line>:<col>

# List symbols
bun scripts/lsp-client.js symbols <project>/src/<file>.rs

# Get diagnostics (errors/warnings)
bun scripts/lsp-client.js diagnostics [<project>/src/<file>.rs]

# Restart the LSP daemon
bun scripts/lsp-client.js restart
```

## How It Works

1. The daemon runs rust-analyzer for each project
2. Projects are initialized with absolute paths
3. The client finds the right project for any file
4. All paths are relative to workspace root

Remember: **Always use the LSP before editing Rust code!**