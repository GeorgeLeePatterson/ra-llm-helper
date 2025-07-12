#!/bin/bash
# Simple LSP daemon starter for background use
# Usage: ./scripts/lsp-start.sh

echo "Starting LSP daemon..."

# Get the workspace root (parent of scripts directory)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
WORKSPACE_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

# Change to workspace root for running commands
cd "$WORKSPACE_ROOT"

# Kill any existing daemon
pkill -f rust-lsp-daemon 2>/dev/null || true
rm -f ~/.rust-lsp-daemon/daemon.sock 2>/dev/null || true
sleep 1

# Start daemon in background
bun scripts/rust-lsp-daemon.js daemon > daemon.log 2>&1 &
DAEMON_PID=$!
echo "LSP daemon started with PID: $DAEMON_PID"

# Wait for it to be ready
sleep 3

# Initialize projects from workspace.config
if [ -f workspace.config ]; then
    # Main project
    MAIN_PROJECT=$(grep "^main_project:" workspace.config 2>/dev/null | sed 's/main_project: *//')
    if [ -n "$MAIN_PROJECT" ] && [ "$MAIN_PROJECT" != "." ]; then
        echo "Initializing main project: $WORKSPACE_ROOT/$MAIN_PROJECT"
        bun scripts/lsp-client.js init "$WORKSPACE_ROOT/$MAIN_PROJECT"
    else
        echo "Initializing current directory: $WORKSPACE_ROOT"
        bun scripts/lsp-client.js init "$WORKSPACE_ROOT"
    fi
    
    # Reference projects
    grep "^  - " workspace.config 2>/dev/null | grep -v "^\s*#" | sed 's/^  - //' | while read -r ref_project; do
        if [ -n "$ref_project" ] && [ -d "$ref_project" ]; then
            echo "Initializing reference: $WORKSPACE_ROOT/$ref_project"
            bun scripts/lsp-client.js init "$WORKSPACE_ROOT/$ref_project"
        fi
    done
else
    echo "No workspace.config, initializing current directory"
    bun scripts/lsp-client.js init "$WORKSPACE_ROOT"
fi

echo "LSP daemon ready!"
echo "To stop: pkill -f rust-lsp-daemon"