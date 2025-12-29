/**
 * Memory
 * Persistent conversation history and project state
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  name: string;
  arguments: Record<string, any>;
  result?: any;
}

export interface ProjectState {
  currentPhase: string;
  searchesComplete: boolean;
  screeningComplete: boolean;
  extractionsCount: number;
  analysesRun: string[];
  lastActivity: number;
}

export interface MemoryConfig {
  projectDir: string;
  maxHistory?: number;
}

export class Memory {
  private messages: Message[] = [];
  private state: ProjectState;
  private config: MemoryConfig;
  private memoryFile: string;
  private stateFile: string;
  
  constructor(config: MemoryConfig) {
    this.config = {
      maxHistory: 100,
      ...config,
    };
    
    this.memoryFile = path.join(config.projectDir, '.claude/memory.json');
    this.stateFile = path.join(config.projectDir, '.claude/state.json');
    
    this.state = {
      currentPhase: 'planning',
      searchesComplete: false,
      screeningComplete: false,
      extractionsCount: 0,
      analysesRun: [],
      lastActivity: Date.now(),
    };
  }
  
  /**
   * Load memory from disk
   */
  async load(): Promise<void> {
    try {
      // Load conversation history
      const memoryData = await fs.readFile(this.memoryFile, 'utf-8');
      const parsed = JSON.parse(memoryData);
      this.messages = parsed.messages || [];
      
    } catch {
      this.messages = [];
    }
    
    try {
      // Load project state
      const stateData = await fs.readFile(this.stateFile, 'utf-8');
      this.state = { ...this.state, ...JSON.parse(stateData) };
      
    } catch {
      // Use default state
    }
  }
  
  /**
   * Save memory to disk
   */
  async save(): Promise<void> {
    // Ensure directory exists
    await fs.mkdir(path.dirname(this.memoryFile), { recursive: true });
    
    // Save conversation history
    await fs.writeFile(
      this.memoryFile,
      JSON.stringify({ messages: this.messages }, null, 2)
    );
    
    // Save state
    this.state.lastActivity = Date.now();
    await fs.writeFile(this.stateFile, JSON.stringify(this.state, null, 2));
  }
  
  /**
   * Add a message to history
   */
  addMessage(message: Message): void {
    this.messages.push({
      ...message,
      timestamp: Date.now(),
    });
    
    // Trim to max history
    if (this.messages.length > this.config.maxHistory!) {
      this.messages = this.messages.slice(-this.config.maxHistory!);
    }
  }
  
  /**
   * Get conversation history
   */
  getHistory(limit?: number): Message[] {
    const n = limit || this.config.maxHistory!;
    return this.messages.slice(-n);
  }
  
  /**
   * Get history formatted for Claude API
   */
  getFormattedHistory(limit?: number): { role: 'user' | 'assistant'; content: string }[] {
    return this.getHistory(limit)
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));
  }
  
  /**
   * Clear conversation history
   */
  clear(): void {
    this.messages = [];
  }
  
  /**
   * Get project state
   */
  getState(): ProjectState {
    return { ...this.state };
  }
  
  /**
   * Update project state
   */
  updateState(updates: Partial<ProjectState>): void {
    this.state = { ...this.state, ...updates };
  }
  
  /**
   * Mark phase as complete
   */
  completePhase(phase: string): void {
    switch (phase) {
      case 'search':
        this.state.searchesComplete = true;
        this.state.currentPhase = 'screening';
        break;
      case 'screening':
        this.state.screeningComplete = true;
        this.state.currentPhase = 'extraction';
        break;
      case 'extraction':
        this.state.currentPhase = 'analysis';
        break;
      case 'analysis':
        this.state.currentPhase = 'writing';
        break;
    }
  }
  
  /**
   * Record completed analysis
   */
  recordAnalysis(analysisName: string): void {
    if (!this.state.analysesRun.includes(analysisName)) {
      this.state.analysesRun.push(analysisName);
    }
  }
  
  /**
   * Search history for relevant context
   */
  searchHistory(query: string, limit: number = 5): Message[] {
    const queryLower = query.toLowerCase();
    const keywords = queryLower.split(/\s+/).filter(w => w.length > 3);
    
    return this.messages
      .filter(m => {
        const contentLower = m.content.toLowerCase();
        return keywords.some(kw => contentLower.includes(kw));
      })
      .slice(-limit);
  }
  
  /**
   * Get summary of recent activity
   */
  getSummary(): string {
    const recent = this.messages.slice(-10);
    const topics = new Set<string>();
    
    // Extract topics from recent messages
    for (const msg of recent) {
      const words = msg.content.toLowerCase().split(/\s+/);
      for (const word of words) {
        if (word.length > 6 && !['assistant', 'message', 'please', 'would', 'could'].includes(word)) {
          topics.add(word);
        }
      }
    }
    
    return `Recent topics: ${Array.from(topics).slice(0, 10).join(', ')}`;
  }
}

export default Memory;
