# rust-analyzer LSP Helper Scripts

These scripts provide a persistent rust-analyzer LSP daemon for better performance and workspace support.

## Quick Start

From your workspace root:

```bash
# Start the LSP daemon
./scripts/lsp-start.sh

# Use LSP commands from anywhere in the workspace
bun scripts/lsp-client.js symbols your-project/src/main.rs
bun scripts/lsp-client.js hover your-project/src/lib.rs 10:5
bun scripts/lsp-client.js def your-project/src/mod.rs 25:15
```

## Workspace Support

The scripts support Rust workspaces with multiple projects. Create a `workspace.config` file:

```yaml
# Main project directory (where you'll be editing)
main_project: clickhouse-datafusion

# Reference projects (read-only, for type information)
reference_projects:
  - datafusion
  - datafusion-federation
```

When you run `lsp-start.sh`, it will:
1. Start the rust-analyzer daemon
2. Initialize all projects with their absolute paths
3. Allow you to query any file from the workspace root

## Available Commands

### Core Commands
- `status` - Check daemon status and list initialized projects
- `init <project>` - Initialize a project (done automatically by lsp-start.sh)
- `symbols <file>` - List all symbols in a file
- `hover <file> <line>:<col>` - Get type information at position
- `def <file> <line>:<col>` - Go to definition
- `refs <file> <line>:<col>` - Find all references

### Scripts

- **`lsp-start.sh`** - Start daemon and initialize projects from workspace.config
- **`lsp-session.sh`** - Start daemon tied to terminal session (for interactive use)
- **`test-lsp-setup.sh`** - Test the LSP setup
- **`lsp-help.sh`** - Show available commands and examples

## How It Works

1. The daemon (`rust-lsp-daemon.js`) runs rust-analyzer instances for each project
2. Projects are registered with their absolute paths
3. The client (`lsp-client.js`) automatically finds the right project for each file
4. All commands work from the workspace root - no need to cd into projects

## Requirements

- Bun (JavaScript runtime)
- rust-analyzer (installed via rustup)
- A Rust project with Cargo.toml

## Troubleshooting

If commands fail with "No LSP client for project":
1. Check daemon is running: `bun scripts/lsp-client.js status`
2. Ensure project was initialized with absolute path
3. Restart daemon: `pkill -f rust-lsp-daemon && ./scripts/lsp-start.sh`