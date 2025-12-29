/**
 * Skills Registry
 * Loads and manages skill plugins for domain-specific knowledge
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'yaml';

export interface Skill {
  name: string;
  version: string;
  description: string;
  triggers: { pattern: string }[];
  requires?: string[];
  tools?: SkillTool[];
  schemas?: Record<string, any>;
  outputs?: string[];
  instructions: string;
}

export interface SkillTool {
  name: string;
  description: string;
  script?: string;
}

export interface SlashCommand {
  name: string;
  description: string;
  template: string;
}

export class SkillRegistry {
  private skills: Map<string, Skill> = new Map();
  private commands: Map<string, SlashCommand> = new Map();
  private skillsDir: string;
  
  constructor(skillsDir?: string) {
    this.skillsDir = skillsDir || path.join(process.cwd(), 'node_modules/@nra/skills');
  }
  
  /**
   * Load a skill by name
   */
  async load(skillName: string): Promise<Skill> {
    // Check multiple locations
    const locations = [
      path.join(this.skillsDir, skillName),
      path.join(process.cwd(), '.claude/skills', skillName),
      path.join(__dirname, '../../skills', skillName),
    ];
    
    let skillPath: string | null = null;
    
    for (const loc of locations) {
      try {
        await fs.access(path.join(loc, 'SKILL.md'));
        skillPath = loc;
        break;
      } catch {
        continue;
      }
    }
    
    if (!skillPath) {
      throw new Error(`Skill not found: ${skillName}`);
    }
    
    const skillFile = await fs.readFile(path.join(skillPath, 'SKILL.md'), 'utf-8');
    const skill = this.parseSkillFile(skillFile);
    
    this.skills.set(skillName, skill);
    console.error(`Loaded skill: ${skillName}`);
    
    return skill;
  }
  
  /**
   * Parse SKILL.md file with YAML frontmatter
   */
  private parseSkillFile(content: string): Skill {
    // Split frontmatter from content
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    
    if (!match) {
      throw new Error('Invalid skill file format');
    }
    
    const frontmatter = yaml.parse(match[1]);
    const instructions = match[2].trim();
    
    return {
      name: frontmatter.name,
      version: frontmatter.version || '1.0.0',
      description: frontmatter.description || '',
      triggers: frontmatter.triggers || [],
      requires: frontmatter.requires,
      tools: frontmatter.tools,
      schemas: frontmatter.schemas,
      outputs: frontmatter.outputs,
      instructions,
    };
  }
  
  /**
   * Load slash commands from project
   */
  async loadCommands(projectDir: string): Promise<void> {
    const commandsDir = path.join(projectDir, '.claude/commands');
    
    try {
      const files = await fs.readdir(commandsDir);
      
      for (const file of files) {
        if (!file.endsWith('.md')) continue;
        
        const content = await fs.readFile(path.join(commandsDir, file), 'utf-8');
        const command = this.parseCommandFile(content);
        
        if (command) {
          this.commands.set(command.name, command);
        }
      }
    } catch {
      // No commands directory
    }
  }
  
  /**
   * Parse command markdown file
   */
  private parseCommandFile(content: string): SlashCommand | null {
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    
    if (!match) return null;
    
    const frontmatter = yaml.parse(match[1]);
    
    return {
      name: frontmatter.name,
      description: frontmatter.description || '',
      template: match[2].trim(),
    };
  }
  
  /**
   * Find skills relevant to a message
   */
  findRelevant(message: string): Skill[] {
    const relevant: Skill[] = [];
    const lowerMessage = message.toLowerCase();
    
    for (const skill of this.skills.values()) {
      for (const trigger of skill.triggers) {
        const pattern = new RegExp(trigger.pattern, 'i');
        if (pattern.test(lowerMessage)) {
          relevant.push(skill);
          break;
        }
      }
    }
    
    return relevant;
  }
  
  /**
   * Get a skill by name
   */
  get(skillName: string): Skill | undefined {
    return this.skills.get(skillName);
  }
  
  /**
   * Get a command by name
   */
  getCommand(commandName: string): SlashCommand | undefined {
    return this.commands.get(commandName);
  }
  
  /**
   * Get all loaded skills
   */
  getAll(): Skill[] {
    return Array.from(this.skills.values());
  }
  
  /**
   * Get all commands
   */
  getAllCommands(): SlashCommand[] {
    return Array.from(this.commands.values());
  }
  
  /**
   * Check if a skill is loaded
   */
  has(skillName: string): boolean {
    return this.skills.has(skillName);
  }
}

export default SkillRegistry;
