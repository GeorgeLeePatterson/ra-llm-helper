#!/usr/bin/env bun

import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { resolve } from 'path';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import net from 'net';
import { homedir } from 'os';

// Constants
const SOCKET_DIR = `${homedir()}/.rust-lsp-daemon`;
const SOCKET_PATH = `${SOCKET_DIR}/daemon.sock`;
const SHUTDOWN_TIMEOUT = 5000;

// Ensure socket directory exists
if (!existsSync(SOCKET_DIR)) {
  mkdirSync(SOCKET_DIR, { recursive: true });
}

class RustAnalyzerClient extends EventEmitter {
  constructor(projectRoot) {
    super();
    this.projectRoot = projectRoot;
    this.requestId = 0;
    this.pendingRequests = new Map();
    this.buffer = '';
    this.initialized = false;
    this.fileVersions = new Map();
    this.indexingComplete = false;
    this.progressTokens = new Map();
  }

  async start() {
    this.process = spawn('rust-analyzer', [], {
      cwd: this.projectRoot,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.process.stdout.on('data', (data) => {
      this.buffer += data.toString();
      this.processBuffer();
    });

    this.process.stderr.on('data', (data) => {
      if (process.env.DEBUG) {
        console.error('rust-analyzer stderr:', data.toString());
      }
    });

    this.process.on('close', (code) => {
      console.log(`rust-analyzer exited with code ${code}`);
      this.emit('closed');
    });

    await this.initialize();
  }

  processBuffer() {
    while (true) {
      const headerEnd = this.buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) break;

      const header = this.buffer.substring(0, headerEnd);
      const contentLengthMatch = header.match(/Content-Length: (\d+)/);
      if (!contentLengthMatch) {
        this.buffer = this.buffer.substring(headerEnd + 4);
        continue;
      }

      const contentLength = parseInt(contentLengthMatch[1]);
      const messageStart = headerEnd + 4;
      
      if (this.buffer.length < messageStart + contentLength) break;

      const message = this.buffer.substring(messageStart, messageStart + contentLength);
      this.buffer = this.buffer.substring(messageStart + contentLength);

      try {
        const json = JSON.parse(message);
        this.handleMessage(json);
      } catch (e) {
        console.error('Failed to parse message:', e);
      }
    }
  }

  handleMessage(message) {
    if (message.id !== undefined && this.pendingRequests.has(message.id)) {
      const { resolve, reject } = this.pendingRequests.get(message.id);
      this.pendingRequests.delete(message.id);
      
      if (message.error) {
        reject(new Error(message.error.message));
      } else {
        resolve(message.result);
      }
    } else if (message.method) {
      this.handleNotification(message);
      this.emit('notification', message);
    }
  }

  handleNotification(message) {
    if (message.method === '$/progress') {
      const { token, value } = message.params;
      
      if (value.kind === 'begin') {
        this.progressTokens.set(token, { title: value.title, message: value.message });
        if (value.title === 'Indexing' || token === 'rustAnalyzer/Indexing') {
          console.log('Indexing started...');
        }
      } else if (value.kind === 'end') {
        if (this.progressTokens.has(token)) {
          const progress = this.progressTokens.get(token);
          if (progress.title === 'Indexing' || token === 'rustAnalyzer/Indexing') {
            console.log('Indexing complete!');
            this.indexingComplete = true;
            this.emit('ready');
          }
          this.progressTokens.delete(token);
        }
      }
    }
    
    if (message.method === 'window/workDoneProgress/create') {
      if (message.id !== undefined) {
        const response = {
          jsonrpc: '2.0',
          id: message.id,
          result: null
        };
        const responseMessage = JSON.stringify(response);
        const header = `Content-Length: ${Buffer.byteLength(responseMessage)}\r\n\r\n`;
        this.process.stdin.write(header + responseMessage);
      }
    }
  }

  sendRequest(method, params) {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId;
      this.pendingRequests.set(id, { resolve, reject });

      const request = {
        jsonrpc: '2.0',
        id,
        method,
        params
      };

      const message = JSON.stringify(request);
      const header = `Content-Length: ${Buffer.byteLength(message)}\r\n\r\n`;
      
      this.process.stdin.write(header + message);
    });
  }

  sendNotification(method, params) {
    const notification = {
      jsonrpc: '2.0',
      method,
      params
    };

    const message = JSON.stringify(notification);
    const header = `Content-Length: ${Buffer.byteLength(message)}\r\n\r\n`;
    
    this.process.stdin.write(header + message);
  }

  async initialize() {
    console.log(`Initializing rust-analyzer for ${this.projectRoot}`);
    const result = await this.sendRequest('initialize', {
      processId: process.pid,
      rootUri: `file://${this.projectRoot}`,
      capabilities: {
        textDocument: {
          hover: { contentFormat: ['plaintext', 'markdown'] },
          definition: { linkSupport: false },
          references: { dynamicRegistration: false },
          documentSymbol: { 
            hierarchicalDocumentSymbolSupport: true,
            symbolKind: { valueSet: Array.from({length: 26}, (_, i) => i + 1) }
          },
          synchronization: {
            didSave: true,
            willSave: false,
            willSaveWaitUntil: false
          }
        },
        workspace: {
          symbol: { 
            symbolKind: { valueSet: Array.from({length: 26}, (_, i) => i + 1) }
          }
        },
        window: {
          workDoneProgress: true
        }
      }
    });

    this.sendNotification('initialized', {});
    this.initialized = true;
    
    await this.waitForReady();
    return result;
  }

  async waitForReady() {
    if (this.indexingComplete) return;
    
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.log('Timeout waiting for indexing, proceeding anyway...');
        resolve();
      }, 10000);
      
      this.once('ready', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  async ensureFileOpen(filePath) {
    const uri = `file://${filePath}`;
    if (!this.fileVersions.has(uri)) {
      const content = await Bun.file(filePath).text();
      const version = 1;
      this.fileVersions.set(uri, version);
      
      this.sendNotification('textDocument/didOpen', {
        textDocument: {
          uri,
          languageId: 'rust',
          version,
          text: content
        }
      });
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  async refreshFile(filePath) {
    const absolutePath = resolve(this.projectRoot, filePath);
    const uri = `file://${absolutePath}`;
    const content = await Bun.file(absolutePath).text();
    
    const version = (this.fileVersions.get(uri) || 0) + 1;
    this.fileVersions.set(uri, version);

    if (version === 1) {
      this.sendNotification('textDocument/didOpen', {
        textDocument: {
          uri,
          languageId: 'rust',
          version,
          text: content
        }
      });
    } else {
      this.sendNotification('textDocument/didChange', {
        textDocument: { uri, version },
        contentChanges: [{ text: content }]
      });
    }

    this.sendNotification('textDocument/didSave', {
      textDocument: { uri }
    });

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  async shutdown() {
    await this.sendRequest('shutdown', null);
    this.sendNotification('exit', null);
    this.process.kill();
  }
}

// Daemon Server
class LSPDaemon {
  constructor() {
    this.clients = new Map(); // projectPath -> RustAnalyzerClient
    this.server = null;
    this.connections = new Set();
  }

  async start() {
    // Clean up any existing socket
    if (existsSync(SOCKET_PATH)) {
      unlinkSync(SOCKET_PATH);
    }

    // Watch for parent process death via stdin
    // When parent dies, stdin gets EOF
    process.stdin.on('end', () => {
      console.log('Parent process died (stdin closed), shutting down...');
      this.shutdown();
    });
    
    // Also watch for explicit termination signals
    process.on('SIGHUP', () => {
      console.log('Received SIGHUP, shutting down...');
      this.shutdown();
    });

    this.server = net.createServer((connection) => {
      console.log('Client connected');
      this.connections.add(connection);
      
      let buffer = '';
      
      connection.on('data', async (data) => {
        buffer += data.toString();
        
        let newlineIndex;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          const line = buffer.substring(0, newlineIndex);
          buffer = buffer.substring(newlineIndex + 1);
          
          try {
            const request = JSON.parse(line);
            const response = await this.handleRequest(request);
            connection.write(JSON.stringify(response) + '\n');
          } catch (error) {
            connection.write(JSON.stringify({
              error: error.message,
              stack: error.stack
            }) + '\n');
          }
        }
      });
      
      connection.on('close', () => {
        console.log('Client disconnected');
        this.connections.delete(connection);
        // No auto-shutdown - daemon stays alive until parent dies
      });
      
      connection.on('error', (err) => {
        console.error('Connection error:', err);
        this.connections.delete(connection);
      });
    });

    await new Promise((resolve, reject) => {
      this.server.listen(SOCKET_PATH, (err) => {
        if (err) reject(err);
        else {
          console.log(`LSP daemon listening on ${SOCKET_PATH}`);
          resolve();
        }
      });
    });

    // Handle graceful shutdown
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }

  async handleRequest(request) {
    const { command, params } = request;
    
    switch (command) {
      case 'init':
        return await this.initProject(params.projectPath);
        
      case 'lsp':
        return await this.handleLSPRequest(params);
        
      case 'refresh':
        return await this.refreshFile(params);
        
      case 'status':
        return this.getStatus();
        
      case 'shutdown':
        this.shutdown();
        return { status: 'shutting down' };
        
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  }

  async initProject(projectPath) {
    if (!this.clients.has(projectPath)) {
      const client = new RustAnalyzerClient(projectPath);
      await client.start();
      this.clients.set(projectPath, client);
      return { status: 'initialized', projectPath };
    }
    return { status: 'already initialized', projectPath };
  }

  async handleLSPRequest(params) {
    const { projectPath, method, lspParams } = params;
    const client = this.clients.get(projectPath);
    
    if (!client) {
      throw new Error(`No LSP client for project: ${projectPath}`);
    }
    
    // Ensure file is open for textDocument methods
    if (method.startsWith('textDocument/') && lspParams.textDocument?.uri) {
      const filePath = lspParams.textDocument.uri.replace('file://', '');
      await client.ensureFileOpen(filePath);
    }
    
    return await client.sendRequest(method, lspParams);
  }

  async refreshFile(params) {
    const { projectPath, filePath } = params;
    const client = this.clients.get(projectPath);
    
    if (!client) {
      throw new Error(`No LSP client for project: ${projectPath}`);
    }
    
    await client.refreshFile(filePath);
    return { status: 'refreshed', filePath };
  }

  getStatus() {
    const projects = Array.from(this.clients.keys());
    return {
      status: 'running',
      projects,
      connections: this.connections.size
    };
  }

  async shutdown() {
    console.log('Shutting down LSP daemon...');
    
    // Close all LSP clients
    for (const [path, client] of this.clients) {
      console.log(`Shutting down LSP for ${path}`);
      await client.shutdown();
    }
    
    // Close all connections
    for (const connection of this.connections) {
      connection.end();
    }
    
    // Close server
    if (this.server) {
      this.server.close();
    }
    
    // Clean up socket
    if (existsSync(SOCKET_PATH)) {
      unlinkSync(SOCKET_PATH);
    }
    
    process.exit(0);
  }
}

// Client for testing
class LSPDaemonClient {
  constructor() {
    this.socket = null;
    this.requestId = 0;
    this.pendingRequests = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.socket = net.connect(SOCKET_PATH, () => {
        console.log('Connected to LSP daemon');
        resolve();
      });
      
      let buffer = '';
      this.socket.on('data', (data) => {
        buffer += data.toString();
        
        let newlineIndex;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          const line = buffer.substring(0, newlineIndex);
          buffer = buffer.substring(newlineIndex + 1);
          
          try {
            const response = JSON.parse(line);
            const { resolve } = this.pendingRequests.get(this.requestId);
            this.pendingRequests.delete(this.requestId);
            resolve(response);
          } catch (e) {
            console.error('Failed to parse response:', e);
          }
        }
      });
      
      this.socket.on('error', reject);
    });
  }

  async request(command, params) {
    this.requestId++;
    
    return new Promise((resolve) => {
      this.pendingRequests.set(this.requestId, { resolve });
      this.socket.write(JSON.stringify({ command, params }) + '\n');
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.end();
    }
  }
}

// Main
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (command === 'daemon') {
    // Start daemon mode
    const daemon = new LSPDaemon();
    await daemon.start();
    
  } else if (command === 'client') {
    // Client mode for testing
    const client = new LSPDaemonClient();
    await client.connect();
    
    const subcommand = args[1];
    const projectPath = '/Users/georgepatterson/projects/georgeleepatterson/clickhouse-datafusion';
    
    switch (subcommand) {
      case 'init':
        console.log(await client.request('init', { projectPath }));
        break;
        
      case 'hover':
        const [,, file, pos] = args;
        const [line, col] = pos.split(':').map(Number);
        console.log(await client.request('lsp', {
          projectPath,
          method: 'textDocument/hover',
          lspParams: {
            textDocument: { uri: `file://${resolve(projectPath, file)}` },
            position: { line: line - 1, character: col - 1 }
          }
        }));
        break;
        
      case 'status':
        console.log(await client.request('status', {}));
        break;
        
      case 'shutdown':
        console.log(await client.request('shutdown', {}));
        break;
        
      default:
        console.log('Usage: client {init|hover|status|shutdown}');
    }
    
    client.disconnect();
    
  } else {
    console.log('Usage:');
    console.log('  rust-lsp-daemon.js daemon     - Start the daemon');
    console.log('  rust-lsp-daemon.js client ... - Send commands to daemon');
    console.log('');
    console.log('Client commands:');
    console.log('  client init                   - Initialize project LSP');
    console.log('  client hover <file> <l>:<c>   - Get hover info');
    console.log('  client status                 - Get daemon status');
    console.log('  client shutdown               - Shutdown daemon');
  }
}

main().catch(console.error);