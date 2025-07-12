#!/bin/bash

echo "=== Testing LSP Setup ==="
echo "Current directory: $(pwd)"

# Step 1: Kill any existing daemon
echo "1. Cleaning up old daemon..."
pkill -f rust-lsp-daemon 2>/dev/null || true
rm -f ~/.rust-lsp-daemon/daemon.sock 2>/dev/null || true
sleep 1

# Step 2: Start daemon using the simple starter
echo "2. Starting LSP daemon..."
./scripts/lsp-start.sh

# Step 3: Check status
echo "3. Checking daemon status..."
bun scripts/lsp-client.js status

# Step 4: Get workspace info
if [ -f workspace.config ]; then
    MAIN_PROJECT=$(grep "^main_project:" workspace.config | sed 's/main_project: *//')
    if [ -z "$MAIN_PROJECT" ]; then
        MAIN_PROJECT="."
    fi
else
    MAIN_PROJECT="."
fi

echo "Main project: $MAIN_PROJECT"

# Step 6: Test a command
echo "6. Testing symbols command..."
TEST_FILE="src/column_lineage.rs"

# Try to find a test file
if [ "$MAIN_PROJECT" != "." ]; then
    FULL_TEST_PATH="$MAIN_PROJECT/$TEST_FILE"
else
    FULL_TEST_PATH="$TEST_FILE"
fi

if [ -f "$FULL_TEST_PATH" ]; then
    echo "   Testing with: $FULL_TEST_PATH"
    
    # This will fail from workspace root
    echo "   From workspace root (expected to fail):"
    bun scripts/lsp-client.js symbols "$FULL_TEST_PATH" 2>&1 | head -5
    
    # This should work if we cd to project first
    echo "   From project directory (should work):"
    if [ "$MAIN_PROJECT" != "." ]; then
        (cd "$MAIN_PROJECT" && bun ../scripts/lsp-client.js symbols "$TEST_FILE" 2>&1 | head -5)
    else
        bun scripts/lsp-client.js symbols "$TEST_FILE" 2>&1 | head -5
    fi
else
    echo "   Test file not found at: $FULL_TEST_PATH"
    echo "   Looking for any Rust file..."
    FIRST_RS_FILE=$(find "$MAIN_PROJECT" -name "*.rs" -type f | head -1)
    if [ -n "$FIRST_RS_FILE" ]; then
        echo "   Found: $FIRST_RS_FILE"
        (cd "$(dirname "$FIRST_RS_FILE")" && bun "$PWD/scripts/lsp-client.js" symbols "$(basename "$FIRST_RS_FILE")" 2>&1 | head -5)
    fi
fi

# Cleanup
echo "7. Cleaning up..."
kill $DAEMON_PID 2>/dev/null || true

echo "=== Test Complete ==="