# Claude Code Configuration

This directory contains configuration to help prevent directory navigation issues.

## Hook Configuration

To enable the cd prevention hook, add this to your Claude Code settings:

```json
{
  "hooks": {
    "pre-bash": "if echo \"$1\" | grep -q '^cd\\|^pushd'; then echo '⚠️  ERROR: Directory changes are not allowed in ra-llm-helper. Use relative paths from the parent directory instead.' && exit 1; fi"
  }
}
```

This hook will:
1. Detect `cd` or `pushd` commands before execution
2. Show an error message
3. Prevent the command from running

## Why This Matters

The ra-llm-helper system relies on staying in a consistent directory to:
- Properly resolve relative paths
- Maintain LSP daemon connections
- Avoid confusion between project directories

## Alternative Approaches

Instead of `cd project && command`, use:
- `command project/file.rs`
- `ls project/src/`
- `grep pattern project/**/*.rs`