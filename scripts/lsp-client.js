#!/usr/bin/env bun

import net from 'net';
import { homedir } from 'os';
import { resolve, dirname } from 'path';
import { existsSync } from 'fs';

const SOCKET_PATH = `${homedir()}/.rust-lsp-daemon/daemon.sock`;

// Find the project root for a given file path
async function findProjectRoot(filePath) {
  // If it's already an absolute path, use it directly
  const absolutePath = filePath.startsWith('/') ? filePath : resolve(process.cwd(), filePath);
  
  // First, check if the daemon already knows about any projects
  try {
    const client = new LSPClient();
    const status = await client.request('status');
    
    if (status && status.projects && status.projects.length > 0) {
      // Check if the file is under any registered project
      for (const project of status.projects) {
        const projectPath = project.startsWith('/') ? project : resolve(process.cwd(), project);
        if (absolutePath.startsWith(projectPath + '/')) {
          return projectPath;
        }
      }
    }
  } catch (e) {
    // Daemon might not be running, continue with fallback
  }
  
  // Walk up the directory tree looking for Cargo.toml
  let currentDir = dirname(absolutePath);
  while (currentDir !== '/') {
    if (existsSync(`${currentDir}/Cargo.toml`)) {
      return currentDir;
    }
    currentDir = dirname(currentDir);
  }
  
  // Fallback to current directory
  return process.cwd();
}

// Get absolute path for a file
function getAbsolutePath(filePath) {
  return filePath.startsWith('/') ? filePath : resolve(process.cwd(), filePath);
}

class LSPClient {
  async request(command, params) {
    return new Promise((resolve, reject) => {
      const socket = net.connect(SOCKET_PATH, () => {
        socket.write(JSON.stringify({ command, params }) + '\n');
      });
      
      let buffer = '';
      socket.on('data', (data) => {
        buffer += data.toString();
        
        let newlineIndex;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          const line = buffer.substring(0, newlineIndex);
          buffer = buffer.substring(newlineIndex + 1);
          
          try {
            const response = JSON.parse(line);
            socket.end();
            
            if (response && response.error) {
              reject(new Error(response.error));
            } else {
              resolve(response || null);
            }
          } catch (e) {
            reject(e);
          }
        }
      });
      
      socket.on('error', (err) => {
        if (err.code === 'ECONNREFUSED' || err.code === 'ENOENT') {
          reject(new Error('LSP daemon not running. Start with: bun scripts/rust-lsp-daemon.js daemon'));
        } else {
          reject(err);
        }
      });
      
      socket.setTimeout(5000, () => {
        socket.destroy();
        reject(new Error('Request timeout'));
      });
    });
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  const client = new LSPClient();
  
  try {
    let result;
    
    if (args.includes('--debug')) {
      console.error('Debug: Command:', command);
      console.error('Debug: Args:', args);
    }
    
    switch (command) {
      case 'init':
        const projectPath = args[1] || process.cwd();
        result = await client.request('init', { projectPath });
        break;
        
      case 'lsp':
        // Generic LSP request
        const [, method, paramsJson] = args;
        const projectPath2 = process.cwd();
        result = await client.request('lsp', {
          projectPath: projectPath2,
          method,
          lspParams: JSON.parse(paramsJson)
        });
        break;
        
      case 'hover':
        const [, file, pos] = args;
        const [line, col] = pos.split(':').map(Number);
        const hoverAbsolutePath = getAbsolutePath(file);
        const hoverProjectPath = await findProjectRoot(hoverAbsolutePath);
        result = await client.request('lsp', {
          projectPath: hoverProjectPath,
          method: 'textDocument/hover',
          lspParams: {
            textDocument: { uri: `file://${hoverAbsolutePath}` },
            position: { line: line - 1, character: col - 1 }
          }
        });
        break;
        
      case 'def':
        const [, defFile, defPos] = args;
        const [defLine, defCol] = defPos.split(':').map(Number);
        const defAbsolutePath = getAbsolutePath(defFile);
        const defProjectPath = await findProjectRoot(defAbsolutePath);
        result = await client.request('lsp', {
          projectPath: defProjectPath,
          method: 'textDocument/definition',
          lspParams: {
            textDocument: { uri: `file://${defAbsolutePath}` },
            position: { line: defLine - 1, character: defCol - 1 }
          }
        });
        break;
        
      case 'symbols':
        const [, symbolFile] = args;
        const symbolAbsolutePath = getAbsolutePath(symbolFile);
        const symbolProjectPath = await findProjectRoot(symbolAbsolutePath);
        result = await client.request('lsp', {
          projectPath: symbolProjectPath,
          method: 'textDocument/documentSymbol',
          lspParams: {
            textDocument: { uri: `file://${symbolAbsolutePath}` }
          }
        });
        break;
        
      case 'refresh':
        const [, refreshFile] = args;
        result = await client.request('refresh', {
          projectPath: process.cwd(),
          filePath: refreshFile
        });
        break;
        
      case 'status':
        result = await client.request('status', {});
        break;
        
      case 'shutdown':
        result = await client.request('shutdown', {});
        break;
        
      // Enhanced rust-analyzer commands
      case 'expand-macro':
        const [, macroFile, macroPos] = args;
        const [macroLine, macroCol] = macroPos.split(':').map(Number);
        const macroAbsolutePath = getAbsolutePath(macroFile);
        const macroProjectPath = await findProjectRoot(macroAbsolutePath);
        result = await client.request('lsp', {
          projectPath: macroProjectPath,
          method: 'rust-analyzer/expandMacro',
          lspParams: {
            textDocument: { uri: `file://${macroAbsolutePath}` },
            position: { line: macroLine - 1, character: macroCol - 1 }
          }
        });
        break;
        
      case 'syntax-tree':
        const [, treeFile] = args;
        const treeAbsolutePath = getAbsolutePath(treeFile);
        const treeProjectPath = await findProjectRoot(treeAbsolutePath);
        result = await client.request('lsp', {
          projectPath: treeProjectPath,
          method: 'rust-analyzer/syntaxTree',
          lspParams: {
            textDocument: { uri: `file://${treeAbsolutePath}` }
          }
        });
        break;
        
      case 'find-tests':
        const [, testFile, testPos] = args;
        const [testLine, testCol] = testPos.split(':').map(Number);
        const testAbsolutePath = getAbsolutePath(testFile);
        const testProjectPath = await findProjectRoot(testAbsolutePath);
        result = await client.request('lsp', {
          projectPath: testProjectPath,
          method: 'rust-analyzer/relatedTests',
          lspParams: {
            textDocument: { uri: `file://${testAbsolutePath}` },
            position: { line: testLine - 1, character: testCol - 1 }
          }
        });
        break;
        
      case 'analyzer-status':
        const [, statusFile] = args;
        const statusAbsolutePath = statusFile ? getAbsolutePath(statusFile) : null;
        const statusProjectPath = statusFile ? await findProjectRoot(statusAbsolutePath) : process.cwd();
        result = await client.request('lsp', {
          projectPath: statusProjectPath,
          method: 'rust-analyzer/analyzerStatus',
          lspParams: statusFile ? {
            textDocument: { uri: `file://${statusAbsolutePath}` }
          } : {}
        });
        break;
        
      case 'reload-workspace':
        result = await client.request('lsp', {
          projectPath: process.cwd(),
          method: 'rust-analyzer/reloadWorkspace',
          lspParams: null
        });
        break;
        
      default:
        console.log('Usage:');
        console.log('  Basic commands:');
        console.log('    init [project-path]         - Initialize LSP for project');
        console.log('    hover <file> <l>:<c>        - Get hover info');
        console.log('    def <file> <l>:<c>          - Go to definition');
        console.log('    symbols <file>              - Get document symbols');
        console.log('    refresh <file>              - Refresh file in LSP');
        console.log('    status                      - Get daemon status');
        console.log('    shutdown                    - Shutdown daemon');
        console.log('');
        console.log('  Enhanced rust-analyzer commands:');
        console.log('    expand-macro <file> <l>:<c> - Expand macro at position');
        console.log('    syntax-tree <file>          - View syntax tree');
        console.log('    find-tests <file> <l>:<c>   - Find related tests');
        console.log('    analyzer-status [file]      - Get analyzer status');
        console.log('    reload-workspace            - Force reload workspace');
        console.log('');
        console.log('  Generic:');
        console.log('    lsp <method> <params>       - Send any LSP request');
        process.exit(1);
    }
    
    if (args.includes('--debug')) {
      console.error('Debug: Result:', result);
    }
    
    console.log(JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();