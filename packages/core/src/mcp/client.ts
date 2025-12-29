/**
 * MCP Client
 * Connects to and manages multiple MCP servers
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export interface MCPServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

interface ConnectedServer {
  client: Client;
  process: ChildProcess;
  tools: Map<string, any>;
}

export class MCPClient extends EventEmitter {
  private servers: Map<string, ConnectedServer> = new Map();
  private allTools: Map<string, { server: string; schema: any }> = new Map();
  
  constructor() {
    super();
  }
  
  /**
   * Connect to multiple MCP servers
   */
  async connect(configs: MCPServerConfig[]): Promise<void> {
    const connections = configs.map(config => this.connectToServer(config));
    await Promise.all(connections);
    
    this.emit('connected', {
      servers: Array.from(this.servers.keys()),
      tools: Array.from(this.allTools.keys()),
    });
  }
  
  /**
   * Connect to a single MCP server
   */
  private async connectToServer(config: MCPServerConfig): Promise<void> {
    const { name, command, args = [], env = {} } = config;
    
    try {
      // Spawn server process
      const serverProcess = spawn(command, args, {
        env: { ...process.env, ...env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      
      serverProcess.stderr?.on('data', (data) => {
        console.error(`[${name}] ${data.toString()}`);
      });
      
      // Create transport and client
      const transport = new StdioClientTransport({
        writer: serverProcess.stdin!,
        reader: serverProcess.stdout!,
      });
      
      const client = new Client(
        {
          name: 'neuroresearch-agent',
          version: '1.0.0',
        },
        {
          capabilities: {},
        }
      );
      
      await client.connect(transport);
      
      // Discover tools
      const toolsResponse = await client.listTools();
      const tools = new Map<string, any>();
      
      for (const tool of toolsResponse.tools) {
        tools.set(tool.name, tool);
        this.allTools.set(tool.name, { server: name, schema: tool });
      }
      
      this.servers.set(name, {
        client,
        process: serverProcess,
        tools,
      });
      
      console.error(`Connected to MCP server: ${name} (${tools.size} tools)`);
      
    } catch (error) {
      console.error(`Failed to connect to ${name}:`, error);
      throw error;
    }
  }
  
  /**
   * Call a tool on the appropriate server
   */
  async callTool(toolName: string, args: Record<string, any>): Promise<any> {
    const toolInfo = this.allTools.get(toolName);
    
    if (!toolInfo) {
      throw new Error(`Unknown tool: ${toolName}`);
    }
    
    const server = this.servers.get(toolInfo.server);
    
    if (!server) {
      throw new Error(`Server not connected: ${toolInfo.server}`);
    }
    
    const result = await server.client.callTool({
      name: toolName,
      arguments: args,
    });
    
    // Parse result
    if (result.content?.[0]?.type === 'text') {
      try {
        return JSON.parse(result.content[0].text);
      } catch {
        return result.content[0].text;
      }
    }
    
    return result;
  }
  
  /**
   * Get all available tools
   */
  getTools(): Map<string, any> {
    return this.allTools;
  }
  
  /**
   * Get tools from a specific server
   */
  getServerTools(serverName: string): Map<string, any> | undefined {
    return this.servers.get(serverName)?.tools;
  }
  
  /**
   * Check if a tool exists
   */
  hasTool(toolName: string): boolean {
    return this.allTools.has(toolName);
  }
  
  /**
   * Disconnect from all servers
   */
  async disconnect(): Promise<void> {
    for (const [name, server] of this.servers) {
      try {
        await server.client.close();
        server.process.kill();
        console.error(`Disconnected from: ${name}`);
      } catch (error) {
        console.error(`Error disconnecting from ${name}:`, error);
      }
    }
    
    this.servers.clear();
    this.allTools.clear();
    this.emit('disconnected');
  }
}

export default MCPClient;
