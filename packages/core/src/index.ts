/**
 * NeuroResearch Agent Core
 * Main exports
 */

// Agent
export { NeuroResearchAgent, type AgentConfig, type AgentTools } from './agent/index.js';
export { Memory, type Message, type ProjectState } from './agent/memory.js';
export { Planner, type Plan, type PlanStep } from './agent/planner.js';
export { Executor, type ExecutionResult, type StepResult } from './agent/executor.js';

// MCP
export { MCPClient, type MCPServerConfig } from './mcp/client.js';

// Skills
export { SkillRegistry, type Skill, type SlashCommand } from './skills/registry.js';

// Tools
export { PubMedTools, type SearchParams, type Article, type SearchResult } from './tools/pubmed.js';
export { RTools, type MetaAnalysisParams, type MetaAnalysisResult } from './tools/r-execute.js';
export { ExtractionTools, type StudyExtraction, type ValidationResult } from './tools/extraction.js';
export { SandboxTools } from './tools/sandbox.js';
export { FileTools } from './tools/files.js';
