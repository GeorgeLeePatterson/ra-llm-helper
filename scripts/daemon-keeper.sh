#!/bin/bash
# This script keeps the daemon alive by providing persistent stdin
# The daemon will exit when this script exits

# CRITICAL: Lock to parent directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PARENT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"
cd "$PARENT_DIR"

# Trap exit signals and forward to daemon
cleanup() {
    echo "Daemon keeper exiting, daemon will shutdown..."
    exit 0
}
trap cleanup EXIT INT TERM

echo "Starting LSP daemon with keeper (PID $$)..."
echo "Working directory locked to: $PARENT_DIR"
echo "IMPORTANT: Do NOT use 'cd' commands - work from this directory using relative paths"

# Start the daemon with our stdin - always from parent dir
bun scripts/rust-lsp-daemon.js daemon &
DAEMON_PID=$!

echo "Daemon started with PID $DAEMON_PID"
echo "Daemon will stop when this process ($$) exits"

# Keep this script running
while kill -0 $DAEMON_PID 2>/dev/null; do
    sleep 10
done

echo "Daemon has exited"