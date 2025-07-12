# CLAUDE.md - Rust Development Helper

## AUTO-STARTUP INSTRUCTIONS FOR CLAUDE

I am Claude Code working on a Rust project with ra-llm-helper installed. I should immediately:

1. **Check current location and understand workspace structure:**
```bash
pwd && ls -la
```

2. **CRITICAL: Stay in the current directory!**
- I must NOT use `cd` commands
- All paths should be relative to where I start
- The LSP daemon will be initialized for projects from this location

3. **Check and parse workspace configuration:**
```bash
if [ -f workspace.config ]; then
    echo "Found workspace.config:"
    cat workspace.config
    # Extract main project
    MAIN_PROJECT=$(grep "^main_project:" workspace.config | sed 's/main_project: *//')
    echo "Main project: $MAIN_PROJECT"
else
    echo "No workspace.config found, will use current directory"
    MAIN_PROJECT="."
fi
```

4. **Check if LSP daemon is running:**
```bash
bun scripts/lsp-client.js status 2>/dev/null || echo "Daemon not running"
```

5. **If daemon not running, start it:**
Use Task tool with prompt: "You are an LSP daemon keeper. Run ./scripts/daemon-keeper.sh and stay alive to keep the daemon running. You MUST stay in the current directory - do not cd anywhere. When you exit, the daemon will shutdown. Report when ready."

6. **Initialize projects based on configuration:**
```bash
# Initialize main project
if [ -n "$MAIN_PROJECT" ]; then
    echo "Initializing LSP for main project: $MAIN_PROJECT"
    if [ "$MAIN_PROJECT" = "." ]; then
        bun scripts/lsp-client.js init
    else
        bun scripts/lsp-client.js init "$MAIN_PROJECT"
    fi
fi

# Initialize reference projects if configured
if [ -f workspace.config ]; then
    grep "^  - " workspace.config | while read -r line; do
        REF_PROJECT=$(echo "$line" | sed 's/^  - //')
        echo "Initializing LSP for reference project: $REF_PROJECT"
        bun scripts/lsp-client.js init "$REF_PROJECT"
    done
fi
```

## Understanding the Workspace

After reading workspace.config, I understand:
- **Main project**: Where I'll be making changes (from `main_project` field)
- **Reference projects**: Read-only projects for looking up types/APIs (from `reference_projects` list)
- **Build commands**: Project-specific commands (from `commands` section)
- **Key files**: Important documentation or entry points (from `key_files` list)

## Critical Rules

1. **NEVER change directories** - Always work from where you start
2. **Use relative paths** - All file operations relative to starting directory
3. **Keep daemon alive** - The Task agent must stay running
4. **Respect project boundaries** - Only edit files in main_project, treat reference_projects as read-only

## Preventing Directory Changes

To prevent accidental `cd` commands, users can set up hooks in their Claude Code settings:

```json
{
  "hooks": {
    "pre-bash": "if echo \"$COMMAND\" | grep -q '^cd\\|^pushd'; then echo 'ERROR: Directory changes are not allowed. Use relative paths instead.' && exit 1; fi"
  }
}
```

This hook will:
- Detect any `cd` or `pushd` commands
- Show an error message
- Prevent the command from executing

For Task agents, remind them in the prompt:
"You MUST stay in the current directory - do not use cd commands"

## What This Provides

This repository contains helper scripts for enhanced Rust development with rust-analyzer LSP integration:

- **Full code intelligence**: Go to definition, find all references, hover for types
- **Cross-file navigation**: Track how changes ripple through the codebase  
- **Persistent indexing**: No startup delay for subsequent queries
- **Multi-project support**: Can analyze main project + reference dependencies

## Key Commands I Should Use

**Working with files** (use paths relative to starting directory):
- Main project file: `$MAIN_PROJECT/src/file.rs`
- Reference project file: `../datafusion/src/file.rs`

**Find symbol definition:**
```bash
bun scripts/lsp-client.js def <file> <line>:<col>
```

**Expand macros (derive, proc-macros, etc):**
```bash
bun scripts/lsp-client.js expand-macro <file> <line>:<col>
# Note: Position cursor on the trait name in derive, e.g., for #[derive(Debug)], use column of 'D' in Debug
```

**Find all references:**
```bash
bun scripts/lsp-client.js lsp "textDocument/references" '{"textDocument":{"uri":"file://<absolute-path>"},"position":{"line":<line-1>,"character":<col-1>},"context":{"includeDeclaration":true}}'
```

**Search workspace symbols:**
```bash
bun scripts/lsp-client.js lsp "workspace/symbol" '{"query":"<SymbolName>"}'
```

**Get file symbols:**
```bash
bun scripts/lsp-client.js symbols <file>
```

## Working With Different Setups

### Single Project (when started in project root):
```
.
├── Cargo.toml
├── src/
└── scripts/     (from ra-llm-helper)
```
Initialize: `bun scripts/lsp-client.js init`

### Multi-Project (when started in parent directory):
```
.
├── main-project/
│   └── Cargo.toml
├── reference-project/
│   └── Cargo.toml
└── scripts/     (from ra-llm-helper)
```
Initialize each: 
- `bun scripts/lsp-client.js init main-project`
- `bun scripts/lsp-client.js init reference-project`

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│   Claude    │────▶│ Task Agent  │────▶│ LSP Daemon   │
│ (stays in   │     │ (keeper)    │     │              │
│ start dir)  │     │             │     │ rust-analyzer│
└─────────────┘     └─────────────┘     └──────────────┘
```

Remember: The directory you start in is your workspace root. Never leave it!

## Task Agent Best Practices

When using the Task agent for LSP queries:

1. **Always ask the Task agent to confirm location first**: "What directory are you in?"
2. **Use the Task agent for information gathering**: 
   - Finding symbols: "Find all references to X"
   - Type information: "What type is at file.rs line 10 column 5?"
   - Expanding macros: "Show me what the derive macro at file.rs:17:10 expands to"
3. **Keep the Task agent alive**: It maintains the LSP daemon - if it exits, the daemon stops
4. **Remind in each prompt**: "Stay in the current directory, use relative paths"

The Task agent is your navigator, you are the editor!

---
*Part of ra-llm-helper - Rust development enhancement for LLM code assistants*