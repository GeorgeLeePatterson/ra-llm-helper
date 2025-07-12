#!/bin/bash
# This script keeps the daemon alive by providing persistent stdin
# The daemon will exit when this script exits

# Trap exit signals and forward to daemon
cleanup() {
    echo "Daemon keeper exiting, daemon will shutdown..."
    exit 0
}
trap cleanup EXIT INT TERM

echo "Starting LSP daemon with keeper (PID $$)..."

# Start the daemon with our stdin
bun scripts/rust-lsp-daemon.js daemon &
DAEMON_PID=$!

echo "Daemon started with PID $DAEMON_PID"
echo "Daemon will stop when this process ($$) exits"

# Keep this script running
while kill -0 $DAEMON_PID 2>/dev/null; do
    sleep 10
done

echo "Daemon has exited"