/**
 * Core Package Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock modules
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Mock response' }]
      })
    }
  }))
}));

vi.mock('child_process', () => ({
  spawn: vi.fn(),
  execSync: vi.fn().mockReturnValue('mock output')
}));

describe('Memory', () => {
  it('should add and retrieve messages', async () => {
    const { Memory } = await import('../src/agent/memory.js');
    
    const memory = new Memory({ projectDir: '/tmp/test' });
    
    memory.addMessage({ role: 'user', content: 'Hello' });
    memory.addMessage({ role: 'assistant', content: 'Hi there!' });
    
    const history = memory.getHistory();
    expect(history).toHaveLength(2);
    expect(history[0].content).toBe('Hello');
    expect(history[1].content).toBe('Hi there!');
  });
  
  it('should respect max history limit', async () => {
    const { Memory } = await import('../src/agent/memory.js');
    
    const memory = new Memory({ projectDir: '/tmp/test', maxHistory: 3 });
    
    for (let i = 0; i < 5; i++) {
      memory.addMessage({ role: 'user', content: `Message ${i}` });
    }
    
    const history = memory.getHistory();
    expect(history).toHaveLength(3);
    expect(history[0].content).toBe('Message 2');
  });
  
  it('should update project state', async () => {
    const { Memory } = await import('../src/agent/memory.js');
    
    const memory = new Memory({ projectDir: '/tmp/test' });
    
    memory.updateState({ currentPhase: 'extraction' });
    memory.updateState({ extractionsCount: 5 });
    
    const state = memory.getState();
    expect(state.currentPhase).toBe('extraction');
    expect(state.extractionsCount).toBe(5);
  });
  
  it('should search history by keywords', async () => {
    const { Memory } = await import('../src/agent/memory.js');
    
    const memory = new Memory({ projectDir: '/tmp/test' });
    
    memory.addMessage({ role: 'user', content: 'Run meta-analysis on mortality data' });
    memory.addMessage({ role: 'assistant', content: 'Analysis complete' });
    memory.addMessage({ role: 'user', content: 'Show forest plot' });
    
    const results = memory.searchHistory('meta-analysis');
    expect(results).toHaveLength(1);
    expect(results[0].content).toContain('meta-analysis');
  });
});

describe('SkillRegistry', () => {
  it('should find relevant skills by trigger', async () => {
    const { SkillRegistry } = await import('../src/skills/registry.js');
    
    const registry = new SkillRegistry();
    
    // Add mock skill
    (registry as any).skills.set('meta-analysis', {
      name: 'meta-analysis',
      triggers: [{ pattern: 'meta-analysis|forest plot|heterogeneity' }],
      instructions: 'Run meta-analysis'
    });
    
    const relevant = registry.findRelevant('Run a meta-analysis on mortality');
    expect(relevant).toHaveLength(1);
    expect(relevant[0].name).toBe('meta-analysis');
  });
  
  it('should return empty array when no skills match', async () => {
    const { SkillRegistry } = await import('../src/skills/registry.js');
    
    const registry = new SkillRegistry();
    
    const relevant = registry.findRelevant('What is the weather?');
    expect(relevant).toHaveLength(0);
  });
});

describe('FileTools', () => {
  it('should parse CSV correctly', async () => {
    const { FileTools } = await import('../src/tools/files.js');
    
    const tools = new FileTools('/tmp');
    
    // Test CSV parsing logic
    const parseLine = (tools as any).parseCsvLine.bind(tools);
    
    expect(parseLine('a,b,c')).toEqual(['a', 'b', 'c']);
    expect(parseLine('"hello, world",test')).toEqual(['hello, world', 'test']);
    expect(parseLine('value,"with ""quotes"""')).toEqual(['value', 'with "quotes"']);
  });
});

describe('RTools', () => {
  it('should interpret heterogeneity correctly', async () => {
    const { RTools } = await import('../src/tools/r-execute.js');
    
    const mockMcp = {
      callTool: vi.fn()
    };
    
    const tools = new RTools(mockMcp as any);
    
    expect(tools.interpretHeterogeneity(0.1).level).toBe('Low');
    expect(tools.interpretHeterogeneity(0.35).level).toBe('Moderate');
    expect(tools.interpretHeterogeneity(0.6).level).toBe('Substantial');
    expect(tools.interpretHeterogeneity(0.85).level).toBe('Considerable');
  });
});

describe('Effect Size Calculations', () => {
  it('should calculate OR from 2x2 table', () => {
    // a=15, b=35, c=25, d=25 (intervention vs control)
    const a = 15, b = 35, c = 25, d = 25;
    const or = (a * d) / (b * c);
    const seLogOr = Math.sqrt(1/a + 1/b + 1/c + 1/d);
    
    expect(or).toBeCloseTo(0.43, 2);
    expect(seLogOr).toBeCloseTo(0.41, 2);
  });
  
  it('should calculate SMD from means', () => {
    // Hedges' g calculation
    const m1 = 12.5, sd1 = 3.2, n1 = 50;
    const m2 = 15.8, sd2 = 4.1, n2 = 50;
    
    const pooledSd = Math.sqrt(((n1-1)*sd1**2 + (n2-1)*sd2**2) / (n1+n2-2));
    const cohensD = (m1 - m2) / pooledSd;
    const correction = 1 - 3 / (4*(n1+n2) - 9);
    const hedgesG = cohensD * correction;
    
    expect(hedgesG).toBeCloseTo(-0.89, 2);
  });
});

describe('Validation', () => {
  it('should validate extraction data', async () => {
    const { ExtractionTools } = await import('../src/tools/extraction.js');
    
    const tools = new ExtractionTools({} as any);
    
    const validExtraction = {
      study_id: 'Smith_2020',
      title: 'Test Study',
      authors: ['Smith'],
      year: 2020,
      journal: 'Test Journal',
      country: 'USA',
      study_design: 'RCT',
      population: {
        total_n: 100,
        intervention_n: 50,
        control_n: 50,
        diagnosis: 'Condition',
        inclusion_criteria: [],
        exclusion_criteria: []
      },
      intervention: { name: 'Treatment', type: 'surgical', details: '' },
      comparator: { name: 'Control', type: 'standard', details: '' },
      outcomes: { primary: [], secondary: [] },
      follow_up: { duration_months: 12, completeness_percent: 95 }
    };
    
    const result = await tools.validate(validExtraction as any);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
  
  it('should catch validation errors', async () => {
    const { ExtractionTools } = await import('../src/tools/extraction.js');
    
    const tools = new ExtractionTools({} as any);
    
    const invalidExtraction = {
      study_id: '',
      year: 0,
      population: {
        total_n: 100,
        intervention_n: 60,
        control_n: 60, // Sum > total
        male_percent: 150 // Invalid percentage
      }
    };
    
    const result = await tools.validate(invalidExtraction as any);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
