/**
 * Configuration Management
 * Loads and manages agent configuration
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'yaml';

export interface AgentConfig {
  anthropicApiKey: string;
  model: string;
  useSandbox: boolean;
  workDir: string;
  skills: string[];
  
  docker: {
    image: string;
    autoPull: boolean;
    memoryLimit: string;
    cpuLimit: number;
  };
  
  pubmed: {
    email: string;
    apiKey?: string;
  };
  
  defaults: {
    outputDir: string;
    figuresDir: string;
    extractionsDir: string;
    effectMeasure: string;
    metaModel: string;
  };
  
  user?: {
    name: string;
    affiliation: string;
    email: string;
    orcid?: string;
  };
}

const DEFAULT_CONFIG: AgentConfig = {
  anthropicApiKey: '',
  model: 'claude-sonnet-4-20250514',
  useSandbox: true,
  workDir: process.cwd(),
  skills: [
    'neurosurgery-literature',
    'meta-analysis',
    'data-extraction',
    'risk-of-bias',
    'manuscript-writing',
  ],
  
  docker: {
    image: 'neuroresearch/sandbox:latest',
    autoPull: true,
    memoryLimit: '4g',
    cpuLimit: 2,
  },
  
  pubmed: {
    email: 'research@example.com',
  },
  
  defaults: {
    outputDir: './outputs',
    figuresDir: './figures',
    extractionsDir: './extractions',
    effectMeasure: 'OR',
    metaModel: 'random',
  },
};

export class Config {
  private static instance: AgentConfig | null = null;
  private static configPath: string = path.join(os.homedir(), '.nra', 'config.yaml');
  
  /**
   * Load configuration from file and environment
   */
  static async load(): Promise<AgentConfig> {
    if (this.instance) {
      return this.instance;
    }
    
    let fileConfig: Partial<AgentConfig> = {};
    
    // Load from file
    try {
      const content = await fs.readFile(this.configPath, 'utf-8');
      fileConfig = yaml.parse(content) || {};
    } catch {
      // Config file doesn't exist
    }
    
    // Load project-specific config
    let projectConfig: Partial<AgentConfig> = {};
    try {
      const projectConfigPath = path.join(process.cwd(), '.nra', 'config.yaml');
      const content = await fs.readFile(projectConfigPath, 'utf-8');
      projectConfig = yaml.parse(content) || {};
    } catch {
      // No project config
    }
    
    // Merge configs with environment variables
    this.instance = {
      ...DEFAULT_CONFIG,
      ...fileConfig,
      ...projectConfig,
      anthropicApiKey: process.env.ANTHROPIC_API_KEY || 
                       process.env.META_API_KEY || 
                       fileConfig.anthropicApiKey || 
                       '',
      pubmed: {
        ...DEFAULT_CONFIG.pubmed,
        ...fileConfig.pubmed,
        ...projectConfig.pubmed,
        apiKey: process.env.NCBI_API_KEY || fileConfig.pubmed?.apiKey,
      },
      docker: {
        ...DEFAULT_CONFIG.docker,
        ...fileConfig.docker,
        ...projectConfig.docker,
      },
      defaults: {
        ...DEFAULT_CONFIG.defaults,
        ...fileConfig.defaults,
        ...projectConfig.defaults,
      },
    };
    
    // Validate required fields
    if (!this.instance.anthropicApiKey) {
      console.error('Warning: No Anthropic API key configured.');
      console.error('Set ANTHROPIC_API_KEY environment variable or add to ~/.nra/config.yaml');
    }
    
    return this.instance;
  }
  
  /**
   * Save configuration to file
   */
  static async save(config: Partial<AgentConfig>): Promise<void> {
    // Ensure directory exists
    await fs.mkdir(path.dirname(this.configPath), { recursive: true });
    
    // Load existing config
    let existing: Partial<AgentConfig> = {};
    try {
      const content = await fs.readFile(this.configPath, 'utf-8');
      existing = yaml.parse(content) || {};
    } catch {
      // No existing config
    }
    
    // Merge and save
    const merged = { ...existing, ...config };
    
    // Don't save API keys to file
    const toSave = { ...merged };
    if (toSave.anthropicApiKey?.startsWith('sk-')) {
      delete toSave.anthropicApiKey;
    }
    
    await fs.writeFile(this.configPath, yaml.stringify(toSave));
  }
  
  /**
   * Get configuration value
   */
  static async get<K extends keyof AgentConfig>(key: K): Promise<AgentConfig[K]> {
    const config = await this.load();
    return config[key];
  }
  
  /**
   * Set configuration value
   */
  static async set<K extends keyof AgentConfig>(key: K, value: AgentConfig[K]): Promise<void> {
    await this.save({ [key]: value } as Partial<AgentConfig>);
    if (this.instance) {
      this.instance[key] = value;
    }
  }
  
  /**
   * Initialize configuration interactively
   */
  static async initialize(): Promise<AgentConfig> {
    const inquirer = await import('inquirer');
    
    const answers = await inquirer.default.prompt([
      {
        type: 'password',
        name: 'anthropicApiKey',
        message: 'Anthropic API Key:',
        mask: '*',
      },
      {
        type: 'input',
        name: 'pubmedEmail',
        message: 'Email for PubMed API:',
        default: 'research@example.com',
      },
      {
        type: 'input',
        name: 'userName',
        message: 'Your name (for manuscripts):',
      },
      {
        type: 'input',
        name: 'userAffiliation',
        message: 'Your affiliation:',
      },
    ]);
    
    const config: Partial<AgentConfig> = {
      anthropicApiKey: answers.anthropicApiKey,
      pubmed: {
        email: answers.pubmedEmail,
      },
    };
    
    if (answers.userName) {
      config.user = {
        name: answers.userName,
        affiliation: answers.userAffiliation || '',
        email: answers.pubmedEmail,
      };
    }
    
    await this.save(config);
    
    // Set API key in environment for current session
    process.env.ANTHROPIC_API_KEY = answers.anthropicApiKey;
    
    return this.load();
  }
  
  /**
   * Check if configuration is valid
   */
  static async isValid(): Promise<{ valid: boolean; issues: string[] }> {
    const config = await this.load();
    const issues: string[] = [];
    
    if (!config.anthropicApiKey) {
      issues.push('Missing Anthropic API key');
    }
    
    if (!config.pubmed.email || config.pubmed.email === 'research@example.com') {
      issues.push('PubMed email not configured (using default)');
    }
    
    return {
      valid: issues.filter(i => i.includes('Missing')).length === 0,
      issues,
    };
  }
  
  /**
   * Get config file path
   */
  static getConfigPath(): string {
    return this.configPath;
  }
  
  /**
   * Reset configuration
   */
  static async reset(): Promise<void> {
    try {
      await fs.unlink(this.configPath);
    } catch {
      // File doesn't exist
    }
    this.instance = null;
  }
}

export default Config;
