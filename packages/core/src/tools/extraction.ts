/**
 * Extraction Tools
 * Tools for extracting structured data from PDFs and documents
 */

import { MCPClient } from '../mcp/client.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'yaml';

export interface ExtractionParams {
  file: string;
  schema?: string;
  pages?: number[];
}

export interface StudyExtraction {
  study_id: string;
  title: string;
  authors: string[];
  year: number;
  journal: string;
  country: string;
  study_design: string;
  
  population: {
    total_n: number;
    intervention_n: number;
    control_n: number;
    age_mean?: number;
    age_sd?: number;
    male_percent?: number;
    diagnosis: string;
    inclusion_criteria: string[];
    exclusion_criteria: string[];
  };
  
  intervention: {
    name: string;
    type: string;
    details: string;
    timing?: string;
  };
  
  comparator: {
    name: string;
    type: string;
    details: string;
  };
  
  outcomes: {
    primary: OutcomeData[];
    secondary: OutcomeData[];
  };
  
  follow_up: {
    duration_months: number;
    completeness_percent: number;
  };
  
  quality?: {
    tool: string;
    assessment: Record<string, string>;
    overall: string;
  };
  
  notes?: string;
}

export interface OutcomeData {
  name: string;
  type: 'binary' | 'continuous' | 'time-to-event';
  timepoint: string;
  intervention: {
    events?: number;
    total?: number;
    mean?: number;
    sd?: number;
    median?: number;
    iqr?: [number, number];
    hr?: number;
  };
  control?: {
    events?: number;
    total?: number;
    mean?: number;
    sd?: number;
    median?: number;
    iqr?: [number, number];
  };
  effect?: {
    measure: string;
    estimate: number;
    ci_lower: number;
    ci_upper: number;
    p_value?: number;
  };
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// Standard neurosurgery extraction schema
const NEUROSURGERY_SCHEMA = {
  required: [
    'study_id',
    'year',
    'study_design',
    'population.total_n',
    'intervention.name',
  ],
  recommended: [
    'population.age_mean',
    'population.male_percent',
    'outcomes.primary',
    'follow_up.duration_months',
  ],
  outcome_types: ['mortality', 'mRS', 'GOS', 'complications', 'reoperation'],
};

export class ExtractionTools {
  private mcp: MCPClient;
  
  constructor(mcp: MCPClient) {
    this.mcp = mcp;
  }
  
  /**
   * Extract data from a PDF study
   */
  async extract(params: ExtractionParams): Promise<StudyExtraction> {
    // First, extract text from PDF
    const text = await this.extractPdfText(params.file, params.pages);
    
    // Parse with schema
    const extraction = await this.parseWithSchema(text, params.schema || 'neurosurgery');
    
    return extraction;
  }
  
  /**
   * Extract text from PDF
   */
  private async extractPdfText(file: string, pages?: number[]): Promise<string> {
    try {
      return await this.mcp.callTool('extract_pdf_text', { path: file, pages });
    } catch {
      // Fallback to reading file directly if MCP not available
      const pdfParse = await import('pdf-parse');
      const buffer = await fs.readFile(file);
      const data = await pdfParse.default(buffer);
      return data.text;
    }
  }
  
  /**
   * Parse text with extraction schema
   */
  private async parseWithSchema(text: string, schema: string): Promise<StudyExtraction> {
    // Use MCP tool if available
    try {
      return await this.mcp.callTool('parse_study', { text, schema });
    } catch {
      // Return empty extraction for manual completion
      return this.createEmptyExtraction();
    }
  }
  
  /**
   * Create empty extraction template
   */
  private createEmptyExtraction(): StudyExtraction {
    return {
      study_id: '',
      title: '',
      authors: [],
      year: 0,
      journal: '',
      country: '',
      study_design: '',
      population: {
        total_n: 0,
        intervention_n: 0,
        control_n: 0,
        diagnosis: '',
        inclusion_criteria: [],
        exclusion_criteria: [],
      },
      intervention: {
        name: '',
        type: '',
        details: '',
      },
      comparator: {
        name: '',
        type: '',
        details: '',
      },
      outcomes: {
        primary: [],
        secondary: [],
      },
      follow_up: {
        duration_months: 0,
        completeness_percent: 0,
      },
    };
  }
  
  /**
   * Validate extraction against schema
   */
  async validate(extraction: StudyExtraction): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check required fields
    for (const field of NEUROSURGERY_SCHEMA.required) {
      const value = this.getNestedValue(extraction, field);
      if (value === undefined || value === null || value === '' || value === 0) {
        errors.push(`Missing required field: ${field}`);
      }
    }
    
    // Check recommended fields
    for (const field of NEUROSURGERY_SCHEMA.recommended) {
      const value = this.getNestedValue(extraction, field);
      if (value === undefined || value === null || value === '') {
        warnings.push(`Missing recommended field: ${field}`);
      }
    }
    
    // Validate logical constraints
    if (extraction.population.intervention_n + (extraction.population.control_n || 0) > extraction.population.total_n) {
      errors.push('Group sizes exceed total sample size');
    }
    
    if (extraction.population.male_percent && (extraction.population.male_percent < 0 || extraction.population.male_percent > 100)) {
      errors.push('Male percentage must be 0-100');
    }
    
    if (extraction.follow_up.completeness_percent && (extraction.follow_up.completeness_percent < 0 || extraction.follow_up.completeness_percent > 100)) {
      errors.push('Follow-up completeness must be 0-100');
    }
    
    // Check outcomes
    for (const outcome of [...extraction.outcomes.primary, ...extraction.outcomes.secondary]) {
      if (outcome.type === 'binary') {
        if (outcome.intervention.events !== undefined && outcome.intervention.total !== undefined) {
          if (outcome.intervention.events > outcome.intervention.total) {
            errors.push(`Events exceed total for outcome: ${outcome.name}`);
          }
        }
      }
      
      if (outcome.effect) {
        if (outcome.effect.ci_lower >= outcome.effect.ci_upper) {
          errors.push(`Invalid CI for outcome: ${outcome.name}`);
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
  
  /**
   * Get nested object value by path
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
  
  /**
   * Save extraction to YAML file
   */
  async save(extraction: StudyExtraction, outputPath: string): Promise<void> {
    const yamlContent = yaml.stringify(extraction);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, yamlContent);
  }
  
  /**
   * Load extraction from YAML file
   */
  async load(filePath: string): Promise<StudyExtraction> {
    const content = await fs.readFile(filePath, 'utf-8');
    return yaml.parse(content) as StudyExtraction;
  }
  
  /**
   * Compile multiple extractions into pooled dataset
   */
  async compile(
    extractionDir: string,
    outputFile: string,
    outcomeType: 'binary' | 'continuous'
  ): Promise<void> {
    const files = await fs.readdir(extractionDir);
    const yamlFiles = files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
    
    const rows: string[] = [];
    
    // Headers based on outcome type
    if (outcomeType === 'binary') {
      rows.push('study,year,events_int,n_int,events_ctrl,n_ctrl');
    } else {
      rows.push('study,year,n_int,mean_int,sd_int,n_ctrl,mean_ctrl,sd_ctrl');
    }
    
    for (const file of yamlFiles) {
      const extraction = await this.load(path.join(extractionDir, file));
      
      for (const outcome of extraction.outcomes.primary) {
        if (outcome.type === outcomeType) {
          const study = extraction.study_id || extraction.authors[0] || 'Unknown';
          const year = extraction.year;
          
          if (outcomeType === 'binary') {
            rows.push([
              study,
              year,
              outcome.intervention.events,
              outcome.intervention.total,
              outcome.control?.events || 0,
              outcome.control?.total || 0,
            ].join(','));
          } else {
            rows.push([
              study,
              year,
              outcome.intervention.total,
              outcome.intervention.mean,
              outcome.intervention.sd,
              outcome.control?.total || 0,
              outcome.control?.mean || 0,
              outcome.control?.sd || 0,
            ].join(','));
          }
        }
      }
    }
    
    await fs.writeFile(outputFile, rows.join('\n'));
  }
  
  /**
   * Generate extraction form template
   */
  generateTemplate(): string {
    const template = {
      study_id: '',
      title: '',
      authors: [],
      year: null,
      journal: '',
      country: '',
      study_design: '# RCT, prospective_cohort, retrospective_cohort, case_control, case_series',
      
      population: {
        total_n: null,
        intervention_n: null,
        control_n: null,
        age_mean: null,
        age_sd: null,
        male_percent: null,
        diagnosis: '',
        inclusion_criteria: [],
        exclusion_criteria: [],
      },
      
      intervention: {
        name: '',
        type: '# surgical, medical, device',
        details: '',
        timing: '',
      },
      
      comparator: {
        name: '',
        type: '',
        details: '',
      },
      
      outcomes: {
        primary: [
          {
            name: '',
            type: '# binary, continuous, time-to-event',
            timepoint: '',
            intervention: {
              events: null,
              total: null,
            },
            control: {
              events: null,
              total: null,
            },
          },
        ],
        secondary: [],
      },
      
      follow_up: {
        duration_months: null,
        completeness_percent: null,
      },
      
      quality: {
        tool: '# ROB2, NOS, ROBINS-I',
        assessment: {},
        overall: '',
      },
      
      notes: '',
    };
    
    return yaml.stringify(template);
  }
}

export default ExtractionTools;
