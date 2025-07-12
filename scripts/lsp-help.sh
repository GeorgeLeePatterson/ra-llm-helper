#!/bin/bash

echo "🚀 LSP CAPABILITIES - What I can do for you:"
echo
echo "📍 NAVIGATION:"
echo "  • Find definition:     'def <file> <line>:<col>'"
echo "  • Find references:     'refs <file> <line>:<col>'"
echo "  • Show symbols:        'symbols <file>'"
echo
echo "🔍 INSPECTION:"
echo "  • Check types:         'hover <file> <line>:<col>'"
echo "  • Show errors:         'diagnostics <file>'"
echo "  • Expand macro:        'expand-macro <file> <line>:<col>'"
echo
echo "💡 BEFORE YOU EDIT:"
echo "  • Always ask me:       'Any errors in <file>?'"
echo "  • Check types:         'What type is X at line Y?'"
echo "  • Find usages:         'Where is X used?'"
echo
echo "🎯 EXAMPLES:"
echo "  bun scripts/lsp-client.js hover src/lib.rs 10:5"
echo "  bun scripts/lsp-client.js diagnostics src/main.rs"
echo "  bun scripts/lsp-client.js def src/lib.rs 20:15"
echo
echo "⚡ QUICK STATUS CHECK:"
bun scripts/lsp-client.js status 2>/dev/null || echo "  ❌ Daemon not running!"
echo
echo "Remember: I'm here to prevent errors, not fix them after!"