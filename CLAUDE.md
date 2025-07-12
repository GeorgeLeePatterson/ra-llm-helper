# CLAUDE.md - Rust Development with LSP Task Agent

## CRITICAL: START HERE - You CANNOT write Rust without LSP!

### 1. IMMEDIATELY Start the LSP Task Agent:

Use the Task tool with this EXACT prompt:

```
You are the LSP Task Agent for Rust development. Your role is to provide code intelligence using rust-analyzer.

STARTUP SEQUENCE (run these commands in order):
1. pwd
2. bun scripts/rust-lsp-daemon.js daemon > daemon.log 2>&1 &
3. sleep 3
4. bun scripts/lsp-client.js status
5. ./scripts/lsp-init-workspace.sh
6. echo "LSP ready! I can now check types, find errors, expand macros, and navigate code."

YOUR JOB:
- You are Claude's eyes into the Rust codebase
- Claude will ask you to check code BEFORE editing
- You provide type info, error checks, and code navigation
- NEVER use cd - stay in the current directory
- Use relative paths from where you started

COMMANDS YOU SHOULD KNOW:
- Check for errors: bun scripts/lsp-client.js lsp "textDocument/publishDiagnostics" <params>
- Get type info: bun scripts/lsp-client.js hover <file> <line>:<col>
- Find definition: bun scripts/lsp-client.js def <file> <line>:<col>
- Get symbols: bun scripts/lsp-client.js symbols <file>
- Expand macro: bun scripts/lsp-client.js expand-macro <file> <line>:<col>
- Find references: bun scripts/lsp-client.js lsp "textDocument/references" <params>
- Search symbols: bun scripts/lsp-client.js lsp "workspace/symbol" '{"query":"<name>"}'

When Claude asks about code, use these commands to provide accurate information.
```

### 2. Test the Task Agent Works:

Ask it: "What's the type of lineage_map in clickhouse-datafusion/src/column_lineage.rs at line 22?"

Expected: It should use `bun scripts/lsp-client.js hover clickhouse-datafusion/src/column_lineage.rs 22:5`

### 3. Before EVERY Rust Edit:

Ask the Task agent:
- "Are there any errors in [file]?"
- "What's the type at [file] [line]:[col]?"
- "Show me all symbols in [file]"

## Your Workspace Structure

Read `workspace.config` to understand:
- **main_project**: The ONLY directory where you edit files
- **reference_projects**: Read-only directories for looking up implementations

## Task Agent Communication Protocol

When you need LSP information, ask the Task agent with specific requests:

1. **For type information:**
   "What's the type of [variable] at [file]:[line]:[col]?"

2. **For error checking:**
   "Check [file] for any compilation errors"

3. **For navigation:**
   "Where is [symbol] defined?" or "Find all references to [symbol]"

4. **For macro expansion:**
   "Show me what the derive macro at [file]:[line]:[col] expands to"

5. **For symbols:**
   "List all structs/functions in [file]"

## Why This Matters

Without the LSP Task agent:
- ❌ You're coding blind - can't see types or errors
- ❌ You'll make preventable mistakes
- ❌ You'll waste time on compilation errors

With the LSP Task agent:
- ✅ See errors before you make edits
- ✅ Know exact types and signatures
- ✅ Navigate code intelligently
- ✅ Understand macro expansions

## Emergency Recovery

If the Task agent dies or gets confused:
1. Start a new Task agent with the startup prompt above
2. Check daemon status: `bun scripts/lsp-client.js status`
3. Re-initialize if needed: `./scripts/lsp-init-workspace.sh`

## The Golden Rules

1. **ALWAYS** have the Task agent running before editing Rust
2. **ALWAYS** ask it to check code before making changes
3. **NEVER** let the Task agent use `cd` commands
4. **ONLY** edit files in the main_project directory

Remember: The Task agent is your code intelligence system. Use it!