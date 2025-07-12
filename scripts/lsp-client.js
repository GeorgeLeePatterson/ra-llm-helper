#!/usr/bin/env bun

import net from 'net';
import { homedir } from 'os';

const SOCKET_PATH = `${homedir()}/.rust-lsp-daemon/daemon.sock`;

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
            
            if (response.error) {
              reject(new Error(response.error));
            } else {
              resolve(response);
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
        result = await client.request('lsp', {
          projectPath: process.cwd(),
          method: 'textDocument/hover',
          lspParams: {
            textDocument: { uri: `file://${process.cwd()}/${file}` },
            position: { line: line - 1, character: col - 1 }
          }
        });
        break;
        
      case 'def':
        const [, defFile, defPos] = args;
        const [defLine, defCol] = defPos.split(':').map(Number);
        result = await client.request('lsp', {
          projectPath: process.cwd(),
          method: 'textDocument/definition',
          lspParams: {
            textDocument: { uri: `file://${process.cwd()}/${defFile}` },
            position: { line: defLine - 1, character: defCol - 1 }
          }
        });
        break;
        
      case 'symbols':
        const [, symbolFile] = args;
        result = await client.request('lsp', {
          projectPath: process.cwd(),
          method: 'textDocument/documentSymbol',
          lspParams: {
            textDocument: { uri: `file://${process.cwd()}/${symbolFile}` }
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
        
      default:
        console.log('Usage:');
        console.log('  lsp-client init [project-path]   - Initialize LSP for project');
        console.log('  lsp-client hover <file> <l>:<c>  - Get hover info');
        console.log('  lsp-client def <file> <l>:<c>    - Go to definition');
        console.log('  lsp-client symbols <file>        - Get document symbols');
        console.log('  lsp-client refresh <file>        - Refresh file in LSP');
        console.log('  lsp-client status                - Get daemon status');
        console.log('  lsp-client shutdown              - Shutdown daemon');
        console.log('  lsp-client lsp <method> <params> - Generic LSP request');
        process.exit(1);
    }
    
    console.log(JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();