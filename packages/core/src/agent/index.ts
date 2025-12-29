/**
 * NeuroResearch Agent Core
 * Main agent class with planning, execution, and memory
 */

import Anthropic from '@anthropic-ai/sdk';
import { MCPClient } from '../mcp/client.js';
import { SkillRegistry } from '../skills/registry.js';
import { Memory } from './memory.js';
import { Planner } from './planner.js';
import { Executor } from './executor.js';
import { PubMedTools } from '../tools/pubmed.js';
import { RTools } from '../tools/r-execute.js';
import { ExtractionTools } from '../tools/extraction.js';
import { SandboxTools } from '../tools/sandbox.js';
import { FileTools } from '../tools/files.js';

export interface AgentConfig {
  anthropicApiKey: string;
  model?: string;
  useSandbox?: boolean;
  workDir?: string;
  skills?: string[];
  mcpServers?: MCPServerConfig[];
}

export interface MCPServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface AgentTools {
  pubmed: PubMedTools;
  r: RTools;
  extraction: ExtractionTools;
  sandbox: SandboxTools;
  files: FileTools;
}

export class NeuroResearchAgent {
  private client: Anthropic;
  private mcp: MCPClient;
  private skills: SkillRegistry;
  private memory: Memory;
  private planner: Planner;
  private executor: Executor;
  private config: AgentConfig;
  
  public tools: AgentTools;
  
  constructor(config: AgentConfig) {
    this.config = {
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
      ...config,
    };
    
    // Initialize Anthropic client
    this.client = new Anthropic({
      apiKey: this.config.anthropicApiKey,
    });
    
    // Initialize MCP client
    this.mcp = new MCPClient();
    
    // Initialize skills registry
    this.skills = new SkillRegistry();
    
    // Initialize memory
    this.memory = new Memory({
      projectDir: this.config.workDir!,
    });
    
    // Initialize planner and executor
    this.planner = new Planner(this.client, this.skills);
    this.executor = new Executor(this.mcp, this.skills);
    
    // Initialize tool interfaces
    this.tools = {
      pubmed: new PubMedTools(this.mcp),
      r: new RTools(this.mcp),
      extraction: new ExtractionTools(this.mcp),
      sandbox: new SandboxTools(this.mcp),
      files: new FileTools(this.config.workDir!),
    };
  }
  
  /**
   * Initialize the agent and connect to MCP servers
   */
  async initialize(): Promise<void> {
    // Load skills
    for (const skillName of this.config.skills || []) {
      await this.skills.load(skillName);
    }
    
    // Connect to MCP servers
    await this.mcp.connect([
      {
        name: 'pubmed',
        command: 'npx',
        args: ['@nra/mcp-pubmed'],
      },
      {
        name: 'r-execute',
        command: 'npx',
        args: ['@nra/mcp-r-execute'],
      },
      {
        name: 'extraction',
        command: 'npx',
        args: ['@nra/mcp-extraction'],
      },
      {
        name: 'sandbox',
        command: 'npx',
        args: ['@nra/mcp-sandbox'],
      },
    ]);
    
    // Load memory
    await this.memory.load();
  }
  
  /**
   * Initialize a new research project
   */
  async initProject(name: string, options: {
    template: string;
    setupDocker: boolean;
  }): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const projectDir = path.join(process.cwd(), name);
    
    // Create directory structure
    const dirs = [
      '',
      '.claude/commands',
      '.claude/skills',
      'protocol',
      'searches',
      'screening',
      'extractions',
      'quality_assessment',
      'analysis/scripts',
      'figures',
      'tables',
      'manuscript',
      'submission/supplementary',
    ];
    
    for (const dir of dirs) {
      await fs.mkdir(path.join(projectDir, dir), { recursive: true });
    }
    
    // Copy template files
    await this.copyTemplate(options.template, projectDir);
    
    // Setup Docker if requested
    if (options.setupDocker) {
      await this.setupDocker(projectDir);
    }
    
    // Initialize git
    const { exec } = await import('child_process');
    const util = await import('util');
    const execAsync = util.promisify(exec);
    
    await execAsync('git init', { cwd: projectDir });
    
    // Create initial commit
    await execAsync('git add .', { cwd: projectDir });
    await execAsync('git commit -m "Initial commit: project setup"', { cwd: projectDir });
  }
  
  /**
   * Copy project template files
   */
  private async copyTemplate(template: string, projectDir: string): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    // README
    await fs.writeFile(
      path.join(projectDir, 'README.md'),
      `# Systematic Review Project

Created with NeuroResearch Agent.

## Quick Start

\`\`\`bash
nra chat
\`\`\`

## Project Structure

- \`protocol/\` - Study protocol and PROSPERO registration
- \`searches/\` - Search strategies and results
- \`screening/\` - Screening decisions
- \`extractions/\` - Extracted study data
- \`quality_assessment/\` - Risk of bias assessments
- \`analysis/\` - R scripts and results
- \`figures/\` - Generated figures
- \`tables/\` - Generated tables
- \`manuscript/\` - Manuscript drafts
`
    );
    
    // .gitignore
    await fs.writeFile(
      path.join(projectDir, '.gitignore'),
      `# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/

# Dependencies
node_modules/

# Build
dist/
*.log

# Secrets
.env
config.local.yaml

# Large files
*.pdf
!protocol/*.pdf
`
    );
    
    // Slash commands
    await this.createSlashCommands(projectDir);
  }
  
  /**
   * Create default slash commands
   */
  private async createSlashCommands(projectDir: string): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const commands = {
      'search.md': `---
name: search
description: Search neurosurgical literature
---

Search PubMed for: $ARGUMENTS

1. Parse into PICO if applicable
2. Build search with MeSH + free text
3. Execute search
4. Summarize top results by evidence level
5. Save to searches/
`,
      'extract.md': `---
name: extract
description: Extract data from study
---

Extract data from: $ARGUMENTS

Use standard neurosurgery extraction schema.
Validate all fields.
Save to extractions/[author]_[year].yaml
`,
      'meta.md': `---
name: meta
description: Run meta-analysis
---

Run meta-analysis for outcome: $ARGUMENTS

1. Load pooled data
2. Select appropriate model
3. Generate forest plot
4. Assess heterogeneity
5. Check publication bias
6. Save results and figures
`,
    };
    
    for (const [filename, content] of Object.entries(commands)) {
      await fs.writeFile(
        path.join(projectDir, '.claude/commands', filename),
        content
      );
    }
  }
  
  /**
   * Setup Docker configuration
   */
  private async setupDocker(projectDir: string): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const devcontainerDir = path.join(projectDir, '.devcontainer');
    await fs.mkdir(devcontainerDir, { recursive: true });
    
    // Dockerfile
    const dockerfile = `FROM rocker/shiny-verse:latest

# System dependencies
RUN apt-get update && apt-get install -y \\
    libcurl4-openssl-dev libssl-dev libxml2-dev \\
    libpoppler-cpp-dev pandoc git curl \\
    && rm -rf /var/lib/apt/lists/*

# Meta-analysis packages
RUN R -q -e 'install.packages(c(
  "meta", "metafor", "dmetar", "netmeta",
  "robvis", "forestplot", "esc",
  "gtsummary", "flextable", "officer",
  "PRISMAstatement", "PRISMA2020"
), repos="https://cloud.r-project.org")'

# Node.js for MCP
RUN curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - \\
    && apt-get install -y nodejs

# VS Code support
RUN R -q -e 'install.packages(c("languageserver", "httpgd"))'

EXPOSE 3838
WORKDIR /workspaces
`;
    
    await fs.writeFile(path.join(devcontainerDir, 'Dockerfile'), dockerfile);
    
    // devcontainer.json
    const devcontainer = {
      name: 'NeuroResearch',
      build: { dockerfile: 'Dockerfile' },
      customizations: {
        vscode: {
          extensions: [
            'REditorSupport.r',
            'Posit.shiny',
          ],
        },
      },
      forwardPorts: [3838],
    };
    
    await fs.writeFile(
      path.join(devcontainerDir, 'devcontainer.json'),
      JSON.stringify(devcontainer, null, 2)
    );
  }
  
  /**
   * Start Docker sandbox
   */
  async startSandbox(): Promise<void> {
    if (!this.config.useSandbox) return;
    await this.tools.sandbox.start();
  }
  
  /**
   * Stop Docker sandbox
   */
  async stopSandbox(): Promise<void> {
    if (!this.config.useSandbox) return;
    await this.tools.sandbox.stop();
  }
  
  /**
   * Main chat interface
   */
  async chat(message: string): Promise<string> {
    // Add to memory
    this.memory.addMessage({ role: 'user', content: message });
    
    // Get relevant skills
    const relevantSkills = this.skills.findRelevant(message);
    
    // Build system prompt with skills
    const systemPrompt = this.buildSystemPrompt(relevantSkills);
    
    // Get conversation history
    const history = this.memory.getHistory();
    
    // Plan the response
    const plan = await this.planner.plan(message, {
      skills: relevantSkills,
      history,
      availableTools: this.getAvailableTools(),
    });
    
    // Execute plan
    const result = await this.executor.execute(plan, {
      tools: this.tools,
      memory: this.memory,
    });
    
    // Generate final response
    const response = await this.generateResponse(message, plan, result);
    
    // Add to memory
    this.memory.addMessage({ role: 'assistant', content: response });
    await this.memory.save();
    
    return response;
  }
  
  /**
   * Build system prompt with relevant skills
   */
  private buildSystemPrompt(skills: any[]): string {
    let prompt = `You are NeuroResearch Agent, an AI assistant specialized in neurosurgery systematic reviews and meta-analyses.

You have access to the following capabilities:
- PubMed literature search with neurosurgery domain knowledge
- Data extraction from PDF studies
- Meta-analysis execution in R (forest plots, heterogeneity, publication bias)
- Risk of bias assessment
- PRISMA flow diagram generation
- Manuscript section writing

Always:
1. Be precise and evidence-based
2. Cite sources when making claims
3. Show your work (calculations, code)
4. Ask for clarification if needed
5. Save outputs to appropriate directories
`;
    
    // Add skill-specific knowledge
    for (const skill of skills) {
      prompt += `\n\n## ${skill.name}\n${skill.instructions}`;
    }
    
    return prompt;
  }
  
  /**
   * Get list of available tools
   */
  private getAvailableTools(): string[] {
    return [
      'pubmed_search',
      'pubmed_get_article',
      'r_execute',
      'r_meta_analysis',
      'r_forest_plot',
      'r_funnel_plot',
      'extract_pdf',
      'validate_extraction',
      'file_read',
      'file_write',
      'sandbox_exec',
    ];
  }
  
  /**
   * Generate final response from plan execution
   */
  private async generateResponse(
    message: string,
    plan: any,
    result: any
  ): Promise<string> {
    const response = await this.client.messages.create({
      model: this.config.model!,
      max_tokens: 4096,
      system: 'Synthesize the execution results into a clear, helpful response.',
      messages: [
        {
          role: 'user',
          content: `Original request: ${message}

Plan executed: ${JSON.stringify(plan, null, 2)}

Execution results: ${JSON.stringify(result, null, 2)}

Please provide a clear summary of what was done and the results.`,
        },
      ],
    });
    
    return response.content[0].type === 'text' 
      ? response.content[0].text 
      : 'Response generated.';
  }
  
  /**
   * Handle slash commands
   */
  async handleSlashCommand(command: string, args: string): Promise<string> {
    const commandDef = this.skills.getCommand(command);
    
    if (!commandDef) {
      return `Unknown command: /${command}. Type /help for available commands.`;
    }
    
    // Replace $ARGUMENTS in command template
    const prompt = commandDef.template.replace('$ARGUMENTS', args);
    
    return this.chat(prompt);
  }
  
  /**
   * Write manuscript section
   */
  async writeManuscriptSection(
    section: string,
    options: { journal?: string }
  ): Promise<string> {
    const skill = this.skills.get('manuscript-writing');
    
    const prompt = `Write the ${section} section for my systematic review.
${options.journal ? `Target journal: ${options.journal}` : ''}

Use PRISMA 2020 guidelines.
Reference my extracted data and analyses.
Format with proper academic tone.`;
    
    return this.chat(prompt);
  }
  
  /**
   * Get project status
   */
  async getProjectStatus(): Promise<{
    extractions: number;
    analyses: number;
    figures: number;
    manuscriptProgress: number;
  }> {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const countFiles = async (dir: string, ext: string): Promise<number> => {
      try {
        const files = await fs.readdir(path.join(this.config.workDir!, dir));
        return files.filter(f => f.endsWith(ext)).length;
      } catch {
        return 0;
      }
    };
    
    return {
      extractions: await countFiles('extractions', '.yaml'),
      analyses: await countFiles('analysis', '.R'),
      figures: await countFiles('figures', '.png'),
      manuscriptProgress: await this.calculateManuscriptProgress(),
    };
  }
  
  private async calculateManuscriptProgress(): Promise<number> {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const sections = ['introduction', 'methods', 'results', 'discussion'];
    let completed = 0;
    
    for (const section of sections) {
      try {
        await fs.access(path.join(this.config.workDir!, 'manuscript', `${section}.md`));
        completed++;
      } catch {
        // Section not yet written
      }
    }
    
    return Math.round((completed / sections.length) * 100);
  }
  
  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.memory.clear();
  }
  
  /**
   * Run a task (programmatic API)
   */
  async run(task: string): Promise<any> {
    return this.chat(task);
  }
}

export default NeuroResearchAgent;
