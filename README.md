# ra-llm-helper - Rust Analyzer Helper for LLM Code Assistants

Enhanced Rust development capabilities for LLM code assistants (Claude, GPT, etc.) using persistent rust-analyzer LSP integration.

## What This Does

This toolkit gives Claude Code the same code intelligence that you have in your IDE:
- **Go to definition** - Jump to where symbols are defined
- **Find all references** - See everywhere a symbol is used
- **Hover for types** - Get type information at any position
- **Symbol search** - Find types, functions, etc. across your workspace
- **Diagnostics** - Get compilation errors and warnings
- **Persistent indexing** - No re-indexing delay between queries

## Why This Matters

Without this, Claude Code:
- Can't track how changes ripple through your codebase
- Makes mistakes that cascade into circular debugging sessions
- Lacks awareness of type relationships and dependencies
- Spends tokens repeatedly searching for the same information

With this, Claude Code:
- Knows exactly where symbols are defined and used
- Can refactor safely with full awareness of impacts
- Provides accurate type-aware assistance
- Works like a developer with a fully-featured IDE

## Installation

### Prerequisites
- `bun` (JavaScript runtime) - [Install from bun.sh](https://bun.sh)
- `rust-analyzer` - Usually comes with Rust installation
- A Rust project with `Cargo.toml`

### Setup

1. Clone this repository into your Rust workspace:
   ```bash
   cd /path/to/your/rust/project
   git clone https://github.com/GeorgeLeePatterson/ra-llm-helper .
   ```

   Or if you want it in a subdirectory:
   ```bash
   git clone https://github.com/GeorgeLeePatterson/ra-llm-helper .claude-helpers
   ```

2. That's it! Claude Code will automatically read `CLAUDE.md` and set itself up.

## Configuration

The `workspace.config` file defines your development environment:
- **main_project**: The primary project being developed
- **reference_projects**: Additional projects loaded for cross-references and type information
- **LSP Auto-initialization**: All projects are automatically loaded when starting the LSP daemon

## New Features (2025-07-12)

### Diagnostics Support
Get real-time compilation errors and warnings:
```bash
# Get diagnostics for a specific file
bun scripts/lsp-client.js diagnostics src/main.rs

# Get all diagnostics across the project
bun scripts/lsp-client.js diagnostics
```

### Easy Restart
Restart the LSP daemon without manual intervention:
```bash
bun scripts/lsp-client.js restart
```

## Contributing

Feel free to submit issues and PRs. Some ideas for enhancement:
- Support for other LSP servers (gopls, pylsp, etc.)
- Cargo command integration
- Build error navigation
- Automated test running with error positions

## License

MIT - Use this however you want!

---

Created to give AI assistants the code intelligence they need to be truly helpful with Rust development.
