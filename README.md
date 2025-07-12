# ra-llm-helper - Rust Analyzer Helper for LLM Code Assistants

Enhanced Rust development capabilities for LLM code assistants (Claude, GPT, etc.) using persistent rust-analyzer LSP integration.

## What This Does

This toolkit gives Claude Code the same code intelligence that you have in your IDE:
- **Go to definition** - Jump to where symbols are defined
- **Find all references** - See everywhere a symbol is used
- **Hover for types** - Get type information at any position
- **Symbol search** - Find types, functions, etc. across your workspace
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

## How It Works

The system uses three components:

1. **LSP Daemon** (`rust-lsp-daemon.js`) - Manages persistent rust-analyzer instances
2. **Daemon Keeper** (`daemon-keeper.sh`) - Keeps the daemon alive during your session
3. **LSP Client** (`lsp-client.js`) - Simple interface for queries

```
Your Terminal → Claude Code → Task Agent → Daemon Keeper → LSP Daemon → rust-analyzer
                                  ↑                              ↓
                                  └──────── Stays alive ─────────┘
```

## Usage

When you start a new Claude Code session in a Rust project with ra-helper installed:

1. Claude will automatically read `CLAUDE.md`
2. Claude will check if the LSP daemon is running
3. If not, Claude will start it using a Task agent
4. You're ready to go!

### Manual Commands (if needed)

Check daemon status:
```bash
bun scripts/lsp-client.js status
```

Find what defines a symbol:
```bash
bun scripts/lsp-client.js def src/main.rs 10:15
```

Find all usages:
```bash
bun scripts/lsp-client.js lsp "textDocument/references" '{"textDocument":{"uri":"file:///full/path/to/file.rs"},"position":{"line":9,"character":14},"context":{"includeDeclaration":true}}'
```

## Architecture Notes

- The daemon uses Unix domain sockets for communication
- When the daemon keeper exits, the daemon automatically shuts down
- No background processes are left running after your session
- Each project gets its own rust-analyzer instance
- Supports multiple projects in a workspace

## Troubleshooting

**"Daemon not running" errors:**
- The Task agent running the keeper may have exited
- Ask Claude to restart the daemon

**"No references found" for symbols you know exist:**
- rust-analyzer needs 10-30 seconds to fully index large projects
- Document-level queries work immediately, workspace queries need full indexing

**Performance issues:**
- Each rust-analyzer instance uses ~200-500MB RAM
- For very large workspaces, consider using for specific subdirectories

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