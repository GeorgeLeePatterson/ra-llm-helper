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
    
    # Reference projects - only process lines between reference_projects: and the next section
    awk '
    /^reference_projects:/ { in_ref=1; next }
    /^[a-zA-Z_]+:/ && in_ref { in_ref=0 }
    /^#/ && in_ref { in_ref=0 }
    /^$/ && in_ref { in_ref=0 }
    in_ref && /^  - / { gsub(/^  - /, ""); print }
    ' workspace.config 2>/dev/null | while read -r ref_project; do
        if [ -n "$ref_project" ]; then
            # Convert relative paths to absolute paths
            if [[ "$ref_project" == /* ]]; then
                # Already absolute path
                REF_PATH="$ref_project"
            else
                # Relative path, resolve from workspace root
                if [ -d "$WORKSPACE_ROOT/$ref_project" ]; then
                    REF_PATH=$(cd "$WORKSPACE_ROOT/$ref_project" && pwd)
                else
                    REF_PATH=""
                fi
            fi
            
            if [ -n "$REF_PATH" ] && [ -d "$REF_PATH" ]; then
                echo "Initializing reference: $REF_PATH"
                bun scripts/lsp-client.js init "$REF_PATH"
            else
                echo "Warning: Reference project not found: $ref_project"
            fi
        fi
    done
else
    echo "No workspace.config, initializing current directory"
    bun scripts/lsp-client.js init "$WORKSPACE_ROOT"
fi

echo "LSP daemon ready!"
echo "To stop: pkill -f rust-lsp-daemon"