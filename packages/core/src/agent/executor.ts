/**
 * Executor
 * Executes plans step by step with error handling and retries
 */

import { MCPClient } from '../mcp/client.js';
import { SkillRegistry } from '../skills/registry.js';
import { Memory } from './memory.js';
import { Plan, PlanStep } from './planner.js';

export interface ExecutionResult {
  success: boolean;
  stepResults: StepResult[];
  outputs: Record<string, any>;
  errors: string[];
  duration: number;
}

export interface StepResult {
  stepId: number;
  success: boolean;
  output?: any;
  error?: string;
  duration: number;
}

export interface ExecutionContext {
  tools: any;
  memory: Memory;
  onProgress?: (step: number, total: number, message: string) => void;
}

export class Executor {
  private mcp: MCPClient;
  private skills: SkillRegistry;
  private maxRetries: number = 3;
  
  constructor(mcp: MCPClient, skills: SkillRegistry) {
    this.mcp = mcp;
    this.skills = skills;
  }
  
  /**
   * Execute a plan
   */
  async execute(plan: Plan, context: ExecutionContext): Promise<ExecutionResult> {
    const startTime = Date.now();
    const stepResults: StepResult[] = [];
    const outputs: Record<string, any> = {};
    const errors: string[] = [];
    
    // Build dependency graph
    const completed = new Set<number>();
    
    // Execute steps in order, respecting dependencies
    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      
      // Report progress
      context.onProgress?.(i + 1, plan.steps.length, step.description);
      
      // Check dependencies
      const depsComplete = step.dependencies.every(d => completed.has(d));
      if (!depsComplete) {
        errors.push(`Step ${step.id}: Dependencies not met`);
        stepResults.push({
          stepId: step.id,
          success: false,
          error: 'Dependencies not met',
          duration: 0,
        });
        continue;
      }
      
      // Execute step with retries
      const result = await this.executeStep(step, context, outputs);
      stepResults.push(result);
      
      if (result.success) {
        completed.add(step.id);
        if (result.output !== undefined) {
          outputs[`step_${step.id}`] = result.output;
        }
      } else {
        errors.push(`Step ${step.id}: ${result.error}`);
        
        // Check if this is a blocking error
        const isBlocking = plan.steps
          .slice(i + 1)
          .some(s => s.dependencies.includes(step.id));
          
        if (isBlocking) {
          errors.push('Stopping execution due to blocking error');
          break;
        }
      }
    }
    
    return {
      success: errors.length === 0,
      stepResults,
      outputs,
      errors,
      duration: Date.now() - startTime,
    };
  }
  
  /**
   * Execute a single step with retries
   */
  private async executeStep(
    step: PlanStep,
    context: ExecutionContext,
    previousOutputs: Record<string, any>
  ): Promise<StepResult> {
    const startTime = Date.now();
    
    let lastError: string = '';
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const output = await this.runStep(step, context, previousOutputs);
        
        return {
          stepId: step.id,
          success: true,
          output,
          duration: Date.now() - startTime,
        };
        
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        
        if (attempt < this.maxRetries) {
          // Wait before retry with exponential backoff
          await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
        }
      }
    }
    
    return {
      stepId: step.id,
      success: false,
      error: lastError,
      duration: Date.now() - startTime,
    };
  }
  
  /**
   * Run a single step
   */
  private async runStep(
    step: PlanStep,
    context: ExecutionContext,
    previousOutputs: Record<string, any>
  ): Promise<any> {
    // No tool specified - just return the action description
    if (!step.tool) {
      return { action: step.action, description: step.description };
    }
    
    // Prepare arguments with variable substitution
    const args = this.prepareArgs(step.toolArgs || {}, previousOutputs);
    
    // Route to appropriate tool handler
    switch (step.tool) {
      case 'search_pubmed':
        return context.tools.pubmed.search(args);
        
      case 'get_article':
        return context.tools.pubmed.getArticle(args.pmid);
        
      case 'r_execute':
        return context.tools.r.execute(args.code);
        
      case 'r_meta_analysis':
        return context.tools.r.runMetaAnalysis(args);
        
      case 'r_forest_plot':
        return context.tools.r.generateForestPlot(args);
        
      case 'r_funnel_plot':
        return context.tools.r.generateFunnelPlot(args);
        
      case 'r_prisma':
        return context.tools.r.generatePRISMA(args);
        
      case 'r_subgroup':
        return context.tools.r.runSubgroupAnalysis(args);
        
      case 'extract_pdf':
        return context.tools.extraction.extract(args);
        
      case 'validate_extraction':
        return context.tools.extraction.validate(args);
        
      case 'file_read':
        return context.tools.files.read(args.path);
        
      case 'file_write':
        return context.tools.files.write(args.path, args.content);
        
      case 'sandbox_exec':
        return context.tools.sandbox.execute(args.command);
        
      default:
        // Try calling via MCP directly
        if (this.mcp.hasTool(step.tool)) {
          return this.mcp.callTool(step.tool, args);
        }
        
        throw new Error(`Unknown tool: ${step.tool}`);
    }
  }
  
  /**
   * Prepare arguments with variable substitution
   */
  private prepareArgs(
    args: Record<string, any>,
    outputs: Record<string, any>
  ): Record<string, any> {
    const result: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(args)) {
      if (typeof value === 'string') {
        // Substitute variables like {{step_1.output}}
        result[key] = value.replace(/\{\{([^}]+)\}\}/g, (_, path) => {
          const parts = path.split('.');
          let current: any = outputs;
          
          for (const part of parts) {
            if (current?.[part] !== undefined) {
              current = current[part];
            } else {
              return `{{${path}}}`; // Keep original if not found
            }
          }
          
          return typeof current === 'string' ? current : JSON.stringify(current);
        });
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.prepareArgs(value, outputs);
      } else {
        result[key] = value;
      }
    }
    
    return result;
  }
  
  /**
   * Validate execution results
   */
  validateResults(result: ExecutionResult): { valid: boolean; issues: string[] } {
    const issues: string[] = [];
    
    // Check for failed steps
    const failedSteps = result.stepResults.filter(s => !s.success);
    if (failedSteps.length > 0) {
      issues.push(`${failedSteps.length} step(s) failed`);
    }
    
    // Check for long-running steps
    const slowSteps = result.stepResults.filter(s => s.duration > 60000);
    if (slowSteps.length > 0) {
      issues.push(`${slowSteps.length} step(s) took over 1 minute`);
    }
    
    return {
      valid: issues.length === 0,
      issues,
    };
  }
}

export default Executor;
