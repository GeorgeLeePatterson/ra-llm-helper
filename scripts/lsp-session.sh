#!/bin/bash
# Session-aware LSP daemon starter
# The daemon will automatically stop when the terminal/session closes

echo "Starting session-aware LSP daemon..."

# Ensure we're in the workspace root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/.."

# Read workspace.config with fallback to current directory
MAIN_PROJECT="."
REFERENCE_PROJECTS=""

if [ -f workspace.config ]; then
    echo "Reading workspace.config..."
    # Try to get main_project
    if grep -q "^main_project:" workspace.config; then
        MAIN_PROJECT=$(grep "^main_project:" workspace.config | sed 's/main_project: *//')
        if [ -z "$MAIN_PROJECT" ]; then
            MAIN_PROJECT="."
        fi
    fi
    # Get reference projects
    REFERENCE_PROJECTS=$(grep "^  - " workspace.config | sed 's/^  - //' || true)
else
    echo "No workspace.config found, using current directory"
fi

# If we're already in a Rust project directory, use that
if [ "$MAIN_PROJECT" = "." ] && [ -f Cargo.toml ]; then
    echo "In Rust project directory, using current directory"
elif [ "$MAIN_PROJECT" = "." ] && [ ! -f Cargo.toml ]; then
    # Look for a single Rust project in subdirectories
    RUST_PROJECTS=$(find . -maxdepth 2 -name Cargo.toml -type f | head -1)
    if [ -n "$RUST_PROJECTS" ]; then
        MAIN_PROJECT=$(dirname "$RUST_PROJECTS")
        echo "Found Rust project at: $MAIN_PROJECT"
    fi
fi

echo "Main project: $MAIN_PROJECT"

# Clean up function that runs on exit
cleanup() {
    echo "Session ending, stopping LSP daemon..."
    if [ -n "$DAEMON_PID" ]; then
        kill $DAEMON_PID 2>/dev/null || true
    fi
    pkill -f rust-lsp-daemon 2>/dev/null || true
    rm -f ~/.rust-lsp-daemon/daemon.sock 2>/dev/null || true
    exit 0
}

# Trap all exit signals (including terminal close)
trap cleanup EXIT INT TERM HUP

# Kill any existing daemon first
pkill -f rust-lsp-daemon 2>/dev/null || true
rm -f ~/.rust-lsp-daemon/daemon.sock 2>/dev/null || true
sleep 1

# Start the daemon in background
bun scripts/rust-lsp-daemon.js daemon > daemon.log 2>&1 &
DAEMON_PID=$!

echo "LSP daemon started with PID: $DAEMON_PID"
echo "Daemon will automatically stop when this session ends"

# Wait for daemon to be ready
sleep 3

# Initialize the main project
echo "Initializing main project: $MAIN_PROJECT..."
if [ "$MAIN_PROJECT" = "." ]; then
    bun scripts/lsp-client.js init
else
    bun scripts/lsp-client.js init "$MAIN_PROJECT"
fi

# Initialize reference projects (if any)
if [ -n "$REFERENCE_PROJECTS" ]; then
    echo "Initializing reference projects..."
    echo "$REFERENCE_PROJECTS" | while read -r ref_project; do
        if [ -n "$ref_project" ]; then
            echo "   Initializing: $ref_project"
            bun scripts/lsp-client.js init "$ref_project"
        fi
    done
fi

# Show help
echo
echo "LSP daemon is ready! You can now use commands like:"
echo "  From project directory:"
echo "    cd $MAIN_PROJECT && bun ../scripts/lsp-client.js hover src/lib.rs 10:5"
echo "  Or use the wrapper:"
echo "    ./scripts/lsp.sh hover src/column_lineage.rs 22:5"
echo
echo "This process will keep running until the session ends."
echo "Press Ctrl+C or close the terminal to stop."

# If running interactively, keep the script running
if [ -t 0 ]; then
    echo "Running in interactive mode. Press Ctrl+C to stop."
    # Keep the script running until the session ends
    while true; do
        sleep 60
        # Check if daemon is still alive
        if ! kill -0 $DAEMON_PID 2>/dev/null; then
            echo "Daemon has died, restarting..."
            bun scripts/rust-lsp-daemon.js daemon > daemon.log 2>&1 &
            DAEMON_PID=$!
            sleep 3
            # Re-initialize projects
            if [ "$MAIN_PROJECT" = "." ]; then
                bun scripts/lsp-client.js init
            else
                bun scripts/lsp-client.js init "$MAIN_PROJECT"
            fi
            if [ -n "$REFERENCE_PROJECTS" ]; then
                echo "$REFERENCE_PROJECTS" | while read -r ref_project; do
                    if [ -n "$ref_project" ]; then
                        bun scripts/lsp-client.js init "$ref_project"
                    fi
                done
            fi
        fi
    done
else
    echo "Running in background mode. Daemon will stop when parent process exits."
fi