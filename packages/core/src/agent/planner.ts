/**
 * Planner
 * Decomposes user requests into executable plans
 */

import Anthropic from '@anthropic-ai/sdk';
import { SkillRegistry, Skill } from '../skills/registry.js';
import { Message } from './memory.js';

export interface Plan {
  goal: string;
  steps: PlanStep[];
  requiredTools: string[];
  estimatedTime: string;
  context: Record<string, any>;
}

export interface PlanStep {
  id: number;
  action: string;
  tool?: string;
  toolArgs?: Record<string, any>;
  dependencies: number[];
  description: string;
  expectedOutput?: string;
}

export interface PlanContext {
  skills: Skill[];
  history: Message[];
  availableTools: string[];
  projectState?: Record<string, any>;
}

const PLANNING_SYSTEM_PROMPT = `You are a research planning assistant for neurosurgery systematic reviews and meta-analyses.

Your task is to decompose user requests into concrete, executable steps.

Output your plan as JSON with this structure:
{
  "goal": "Clear statement of what we're trying to achieve",
  "steps": [
    {
      "id": 1,
      "action": "Description of what to do",
      "tool": "tool_name (if applicable)",
      "toolArgs": { "arg1": "value1" },
      "dependencies": [],
      "description": "Human-readable explanation",
      "expectedOutput": "What this step produces"
    }
  ],
  "requiredTools": ["tool1", "tool2"],
  "estimatedTime": "X minutes"
}

Available tools:
- search_pubmed: Search medical literature
- r_execute: Run R code
- r_meta_analysis: Run a full meta-analysis
- r_forest_plot: Generate forest plot
- r_funnel_plot: Generate funnel plot
- extract_pdf: Extract data from PDF
- file_read: Read a file
- file_write: Write to a file

Keep plans focused and practical. Include validation steps where appropriate.`;

export class Planner {
  private client: Anthropic;
  private skills: SkillRegistry;
  
  constructor(client: Anthropic, skills: SkillRegistry) {
    this.client = client;
    this.skills = skills;
  }
  
  /**
   * Create an execution plan for a user request
   */
  async plan(message: string, context: PlanContext): Promise<Plan> {
    // Build context-aware prompt
    const systemPrompt = this.buildSystemPrompt(context);
    
    // Get recent conversation for context
    const recentHistory = context.history.slice(-5).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));
    
    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [
        ...recentHistory,
        {
          role: 'user',
          content: `Create an execution plan for this request: ${message}
          
Respond with ONLY valid JSON, no explanation.`,
        },
      ],
    });
    
    // Parse plan from response
    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }
    
    try {
      // Extract JSON from response
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      
      const plan = JSON.parse(jsonMatch[0]) as Plan;
      plan.context = { originalMessage: message };
      
      return this.validatePlan(plan, context);
      
    } catch (error) {
      // Fall back to simple single-step plan
      return this.createSimplePlan(message, context);
    }
  }
  
  /**
   * Build system prompt with skill context
   */
  private buildSystemPrompt(context: PlanContext): string {
    let prompt = PLANNING_SYSTEM_PROMPT;
    
    // Add skill-specific knowledge
    if (context.skills.length > 0) {
      prompt += '\n\nRelevant domain knowledge:\n';
      for (const skill of context.skills) {
        prompt += `\n## ${skill.name}\n${skill.description}\n`;
        if (skill.tools) {
          prompt += 'Skill tools: ' + skill.tools.map(t => t.name).join(', ') + '\n';
        }
      }
    }
    
    // Add available tools
    prompt += '\n\nTools available for this session:\n';
    prompt += context.availableTools.join(', ');
    
    return prompt;
  }
  
  /**
   * Validate and enhance a plan
   */
  private validatePlan(plan: Plan, context: PlanContext): Plan {
    // Ensure all required fields exist
    if (!plan.goal) {
      plan.goal = 'Complete the requested task';
    }
    
    if (!plan.steps || plan.steps.length === 0) {
      plan.steps = [{
        id: 1,
        action: 'Process request',
        dependencies: [],
        description: 'Handle the user request',
      }];
    }
    
    // Validate tool names
    const availableToolsSet = new Set(context.availableTools);
    plan.requiredTools = (plan.requiredTools || []).filter(t => availableToolsSet.has(t));
    
    // Ensure step IDs are sequential
    plan.steps.forEach((step, i) => {
      step.id = i + 1;
    });
    
    return plan;
  }
  
  /**
   * Create a simple single-step plan for fallback
   */
  private createSimplePlan(message: string, context: PlanContext): Plan {
    // Detect intent from message
    const lowerMessage = message.toLowerCase();
    
    let tool: string | undefined;
    let toolArgs: Record<string, any> | undefined;
    
    if (lowerMessage.includes('search') || lowerMessage.includes('find')) {
      tool = 'search_pubmed';
      toolArgs = { query: message };
    } else if (lowerMessage.includes('meta-analysis') || lowerMessage.includes('pool')) {
      tool = 'r_meta_analysis';
    } else if (lowerMessage.includes('forest plot')) {
      tool = 'r_forest_plot';
    } else if (lowerMessage.includes('extract')) {
      tool = 'extract_pdf';
    }
    
    return {
      goal: message,
      steps: [
        {
          id: 1,
          action: 'Execute request',
          tool,
          toolArgs,
          dependencies: [],
          description: message,
        },
      ],
      requiredTools: tool ? [tool] : [],
      estimatedTime: '1-2 minutes',
      context: { originalMessage: message },
    };
  }
  
  /**
   * Refine a plan based on feedback
   */
  async refine(plan: Plan, feedback: string): Promise<Plan> {
    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: PLANNING_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Current plan: ${JSON.stringify(plan, null, 2)}

Feedback: ${feedback}

Please provide a refined plan as JSON.`,
        },
      ],
    });
    
    const content = response.content[0];
    if (content.type !== 'text') {
      return plan;
    }
    
    try {
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as Plan;
      }
    } catch {
      // Return original plan if parsing fails
    }
    
    return plan;
  }
}

export default Planner;
