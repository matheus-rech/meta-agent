#!/usr/bin/env node
/**
 * Extraction MCP Server
 * Extracts structured data from medical research PDFs for systematic reviews
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { z } from 'zod';
import * as yaml from 'yaml';

// ============================================
// SCHEMAS
// ============================================

const OutcomeDataSchema = z.object({
  name: z.string(),
  type: z.enum(['binary', 'continuous', 'time-to-event']),
  timepoint: z.string().optional(),
  intervention: z.object({
    events: z.number().optional(),
    total: z.number().optional(),
    mean: z.number().optional(),
    sd: z.number().optional(),
    median: z.number().optional(),
    iqr: z.tuple([z.number(), z.number()]).optional(),
    hr: z.number().optional(),
  }),
  control: z.object({
    events: z.number().optional(),
    total: z.number().optional(),
    mean: z.number().optional(),
    sd: z.number().optional(),
    median: z.number().optional(),
    iqr: z.tuple([z.number(), z.number()]).optional(),
  }).optional(),
  effect: z.object({
    measure: z.string(),
    estimate: z.number(),
    ci_lower: z.number(),
    ci_upper: z.number(),
    p_value: z.number().optional(),
  }).optional(),
});

const StudyExtractionSchema = z.object({
  study_id: z.string(),
  title: z.string(),
  authors: z.array(z.string()),
  year: z.number(),
  journal: z.string(),
  doi: z.string().optional(),
  pmid: z.string().optional(),
  country: z.string(),
  study_design: z.enum([
    'RCT',
    'prospective_cohort',
    'retrospective_cohort',
    'case_control',
    'case_series',
    'cross_sectional',
    'meta_analysis',
  ]),

  population: z.object({
    total_n: z.number(),
    intervention_n: z.number(),
    control_n: z.number().optional(),
    age_mean: z.number().optional(),
    age_sd: z.number().optional(),
    age_median: z.number().optional(),
    age_range: z.tuple([z.number(), z.number()]).optional(),
    male_percent: z.number().optional(),
    diagnosis: z.string(),
    severity: z.string().optional(),
    inclusion_criteria: z.array(z.string()),
    exclusion_criteria: z.array(z.string()),
  }),

  intervention: z.object({
    name: z.string(),
    type: z.enum(['surgical', 'medical', 'device', 'behavioral', 'other']),
    details: z.string(),
    timing: z.string().optional(),
    technique: z.string().optional(),
  }),

  comparator: z.object({
    name: z.string(),
    type: z.enum(['standard_care', 'placebo', 'active_comparator', 'historical', 'none']),
    details: z.string(),
  }).optional(),

  outcomes: z.object({
    primary: z.array(OutcomeDataSchema),
    secondary: z.array(OutcomeDataSchema),
  }),

  follow_up: z.object({
    duration_months: z.number(),
    completeness_percent: z.number().optional(),
    loss_to_followup_n: z.number().optional(),
  }),

  quality: z.object({
    tool: z.enum(['ROB2', 'NOS', 'ROBINS-I', 'QUADAS-2', 'JBI']),
    domains: z.record(z.string(), z.enum(['low', 'some_concerns', 'high', 'unclear'])),
    overall: z.enum(['low', 'some_concerns', 'high', 'unclear']),
    notes: z.string().optional(),
  }).optional(),

  funding: z.string().optional(),
  conflicts: z.string().optional(),
  notes: z.string().optional(),
});

type StudyExtraction = z.infer<typeof StudyExtractionSchema>;
type OutcomeData = z.infer<typeof OutcomeDataSchema>;

// ============================================
// NEUROSURGERY DOMAIN KNOWLEDGE
// ============================================

const NEUROSURGERY_OUTCOMES = {
  mortality: ['mortality', 'death', 'survival', 'died', 'fatal'],
  functional: ['mRS', 'modified Rankin', 'GOS', 'Glasgow Outcome', 'Barthel', 'NIHSS', 'Karnofsky'],
  complications: ['complication', 'adverse', 'infection', 'hemorrhage', 'hematoma', 'CSF leak', 'wound'],
  reoperation: ['reoperation', 'revision', 're-intervention', 'second surgery'],
  neurological: ['deficit', 'paresis', 'paralysis', 'aphasia', 'seizure', 'epilepsy'],
  pain: ['VAS', 'visual analog', 'pain score', 'NRS', 'ODI', 'Oswestry'],
  quality_of_life: ['SF-36', 'EQ-5D', 'quality of life', 'QoL', 'HRQOL'],
};

const STUDY_DESIGN_PATTERNS = {
  RCT: /\b(randomized|randomised|RCT|random allocation|randomly assigned)\b/i,
  prospective_cohort: /\b(prospective cohort|prospectively enrolled|prospective study)\b/i,
  retrospective_cohort: /\b(retrospective|chart review|medical records|database)\b/i,
  case_control: /\b(case-control|case control|matched controls)\b/i,
  case_series: /\b(case series|consecutive cases|single-arm|single arm)\b/i,
  meta_analysis: /\b(meta-analysis|meta analysis|systematic review|pooled analysis)\b/i,
};

// ============================================
// EXTRACTION FUNCTIONS
// ============================================

async function extractPdfText(filePath: string): Promise<string> {
  const pdfParse = (await import('pdf-parse')).default;
  const buffer = await fs.readFile(filePath);
  const data = await pdfParse(buffer);
  return data.text;
}

function detectStudyDesign(text: string): StudyExtraction['study_design'] {
  for (const [design, pattern] of Object.entries(STUDY_DESIGN_PATTERNS)) {
    if (pattern.test(text)) {
      return design as StudyExtraction['study_design'];
    }
  }
  return 'retrospective_cohort'; // Default
}

function extractYear(text: string): number | null {
  // Look for publication year patterns
  const patterns = [
    /(?:published|received|accepted).*?(\d{4})/i,
    /©\s*(\d{4})/,
    /\b(19\d{2}|20[0-2]\d)\b/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const year = parseInt(match[1]);
      if (year >= 1950 && year <= new Date().getFullYear()) {
        return year;
      }
    }
  }
  return null;
}

function extractSampleSize(text: string): { total: number; intervention?: number; control?: number } | null {
  // Common patterns for sample sizes
  const patterns = [
    /(?:n\s*=\s*|total of\s+|included\s+)(\d+)\s*(?:patients|subjects|participants)/i,
    /(\d+)\s*(?:patients|subjects|participants)\s*(?:were\s+)?(?:included|enrolled|recruited)/i,
    /(\d+)\s*in\s*(?:the\s+)?(?:intervention|treatment|study)\s*group.*?(\d+)\s*in\s*(?:the\s+)?(?:control|comparison)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      if (match[2]) {
        // Has intervention and control groups
        return {
          intervention: parseInt(match[1]),
          control: parseInt(match[2]),
          total: parseInt(match[1]) + parseInt(match[2]),
        };
      }
      return { total: parseInt(match[1]) };
    }
  }
  return null;
}

function extractAge(text: string): { mean?: number; sd?: number; median?: number; range?: [number, number] } {
  const result: { mean?: number; sd?: number; median?: number; range?: [number, number] } = {};

  // Mean ± SD pattern
  const meanSdMatch = text.match(/(?:mean\s+)?age[:\s]+(\d+(?:\.\d+)?)\s*[±+-]\s*(\d+(?:\.\d+)?)/i);
  if (meanSdMatch) {
    result.mean = parseFloat(meanSdMatch[1]);
    result.sd = parseFloat(meanSdMatch[2]);
  }

  // Median (range) pattern
  const medianMatch = text.match(/median\s+age[:\s]+(\d+(?:\.\d+)?)\s*\((\d+)[-–](\d+)\)/i);
  if (medianMatch) {
    result.median = parseFloat(medianMatch[1]);
    result.range = [parseInt(medianMatch[2]), parseInt(medianMatch[3])];
  }

  return result;
}

function extractMalePercent(text: string): number | null {
  const patterns = [
    /(\d+(?:\.\d+)?)\s*%?\s*(?:were\s+)?(?:male|men)/i,
    /male[:\s]+(\d+(?:\.\d+)?)\s*%/i,
    /(\d+)\s*(?:males?|men).*?(\d+)\s*(?:females?|women)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      if (match[2]) {
        // Has both male and female counts
        const males = parseInt(match[1]);
        const females = parseInt(match[2]);
        return Math.round((males / (males + females)) * 100 * 10) / 10;
      }
      const percent = parseFloat(match[1]);
      if (percent <= 100) {
        return percent;
      }
    }
  }
  return null;
}

function extractFollowUp(text: string): { duration_months: number; completeness_percent?: number } | null {
  const durationPatterns = [
    /follow[- ]?up[:\s]+(\d+(?:\.\d+)?)\s*(months?|years?|weeks?)/i,
    /(\d+(?:\.\d+)?)\s*(months?|years?|weeks?)\s*(?:of\s+)?follow[- ]?up/i,
    /median\s+follow[- ]?up[:\s]+(\d+(?:\.\d+)?)\s*(months?|years?)/i,
  ];

  for (const pattern of durationPatterns) {
    const match = text.match(pattern);
    if (match) {
      let duration = parseFloat(match[1]);
      const unit = match[2].toLowerCase();

      if (unit.startsWith('year')) {
        duration *= 12;
      } else if (unit.startsWith('week')) {
        duration /= 4.33;
      }

      // Look for completeness
      const completenessMatch = text.match(/(\d+(?:\.\d+)?)\s*%\s*(?:complete|follow[- ]?up|retention)/i);

      return {
        duration_months: Math.round(duration * 10) / 10,
        completeness_percent: completenessMatch ? parseFloat(completenessMatch[1]) : undefined,
      };
    }
  }
  return null;
}

function extractBinaryOutcome(text: string, outcomeName: string): OutcomeData | null {
  // Look for patterns like "mortality was 15/100 (15%) in intervention vs 25/95 (26.3%) in control"
  const keywords = NEUROSURGERY_OUTCOMES[outcomeName as keyof typeof NEUROSURGERY_OUTCOMES] || [outcomeName];

  for (const keyword of keywords) {
    const pattern = new RegExp(
      `${keyword}[^.]*?(\\d+)[/\\s]+(\\d+)[^.]*?(?:intervention|treatment|surgery)[^.]*?(\\d+)[/\\s]+(\\d+)[^.]*?(?:control|conservative)`,
      'i'
    );

    const match = text.match(pattern);
    if (match) {
      return {
        name: outcomeName,
        type: 'binary',
        intervention: {
          events: parseInt(match[1]),
          total: parseInt(match[2]),
        },
        control: {
          events: parseInt(match[3]),
          total: parseInt(match[4]),
        },
      };
    }
  }

  // Simpler pattern: just the outcome with events/total
  for (const keyword of keywords) {
    const simplePattern = new RegExp(`${keyword}[^.]*?(\\d+)[/\\s]+(\\d+)\\s*\\(`, 'i');
    const match = text.match(simplePattern);
    if (match) {
      return {
        name: outcomeName,
        type: 'binary',
        intervention: {
          events: parseInt(match[1]),
          total: parseInt(match[2]),
        },
      };
    }
  }

  return null;
}

function extractContinuousOutcome(text: string, outcomeName: string): OutcomeData | null {
  const keywords = NEUROSURGERY_OUTCOMES[outcomeName as keyof typeof NEUROSURGERY_OUTCOMES] || [outcomeName];

  for (const keyword of keywords) {
    // Pattern: "score was 25.3 ± 5.2 vs 30.1 ± 6.1"
    const pattern = new RegExp(
      `${keyword}[^.]*?(\\d+(?:\\.\\d+)?)\\s*[±+-]\\s*(\\d+(?:\\.\\d+)?)[^.]*?vs[^.]*?(\\d+(?:\\.\\d+)?)\\s*[±+-]\\s*(\\d+(?:\\.\\d+)?)`,
      'i'
    );

    const match = text.match(pattern);
    if (match) {
      return {
        name: outcomeName,
        type: 'continuous',
        intervention: {
          mean: parseFloat(match[1]),
          sd: parseFloat(match[2]),
        },
        control: {
          mean: parseFloat(match[3]),
          sd: parseFloat(match[4]),
        },
      };
    }
  }

  return null;
}

function extractEffectSize(text: string, outcomeName: string): OutcomeData['effect'] | null {
  const patterns = [
    // OR pattern
    /(?:odds ratio|OR)[:\s]+(\d+(?:\.\d+)?)\s*\(?(?:95%?\s*CI)?[:\s]*(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)/i,
    // RR pattern
    /(?:relative risk|risk ratio|RR)[:\s]+(\d+(?:\.\d+)?)\s*\(?(?:95%?\s*CI)?[:\s]*(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)/i,
    // HR pattern
    /(?:hazard ratio|HR)[:\s]+(\d+(?:\.\d+)?)\s*\(?(?:95%?\s*CI)?[:\s]*(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)/i,
    // MD pattern
    /(?:mean difference|MD)[:\s]+(-?\d+(?:\.\d+)?)\s*\(?(?:95%?\s*CI)?[:\s]*(-?\d+(?:\.\d+)?)\s*[-–]\s*(-?\d+(?:\.\d+)?)/i,
  ];

  const measureNames = ['OR', 'RR', 'HR', 'MD'];

  for (let i = 0; i < patterns.length; i++) {
    const match = text.match(patterns[i]);
    if (match) {
      // Look for p-value
      const pMatch = text.match(/p\s*[=<]\s*(\d+(?:\.\d+)?)/i);

      return {
        measure: measureNames[i],
        estimate: parseFloat(match[1]),
        ci_lower: parseFloat(match[2]),
        ci_upper: parseFloat(match[3]),
        p_value: pMatch ? parseFloat(pMatch[1]) : undefined,
      };
    }
  }

  return null;
}

function extractDOI(text: string): string | null {
  const match = text.match(/10\.\d{4,}\/[^\s]+/);
  return match ? match[0].replace(/[.,;]$/, '') : null;
}

function extractPMID(text: string): string | null {
  const match = text.match(/PMID[:\s]+(\d{7,8})/i);
  return match ? match[1] : null;
}

async function extractFromPdf(
  filePath: string,
  schema: string = 'neurosurgery'
): Promise<Partial<StudyExtraction>> {
  const text = await extractPdfText(filePath);

  // Extract basic study info
  const sampleSize = extractSampleSize(text);
  const age = extractAge(text);
  const followUp = extractFollowUp(text);

  // Extract outcomes
  const outcomes: { primary: OutcomeData[]; secondary: OutcomeData[] } = {
    primary: [],
    secondary: [],
  };

  // Try to extract mortality as primary outcome for neurosurgery
  const mortality = extractBinaryOutcome(text, 'mortality');
  if (mortality) {
    outcomes.primary.push(mortality);
  }

  // Try to extract functional outcomes
  const functional = extractContinuousOutcome(text, 'functional');
  if (functional) {
    outcomes.secondary.push(functional);
  }

  // Build extraction
  const extraction: Partial<StudyExtraction> = {
    study_id: path.basename(filePath, '.pdf'),
    title: '', // Would need NLP to extract properly
    authors: [],
    year: extractYear(text) || 0,
    journal: '',
    doi: extractDOI(text) || undefined,
    pmid: extractPMID(text) || undefined,
    country: '',
    study_design: detectStudyDesign(text),

    population: {
      total_n: sampleSize?.total || 0,
      intervention_n: sampleSize?.intervention || sampleSize?.total || 0,
      control_n: sampleSize?.control,
      age_mean: age.mean,
      age_sd: age.sd,
      age_median: age.median,
      age_range: age.range,
      male_percent: extractMalePercent(text) || undefined,
      diagnosis: '',
      inclusion_criteria: [],
      exclusion_criteria: [],
    },

    intervention: {
      name: '',
      type: 'surgical',
      details: '',
    },

    outcomes,

    follow_up: followUp || { duration_months: 0 },
  };

  return extraction;
}

function validateExtraction(extraction: Partial<StudyExtraction>): {
  valid: boolean;
  errors: string[];
  warnings: string[];
  completeness: number;
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  const requiredFields = ['study_id', 'year', 'study_design'];
  for (const field of requiredFields) {
    const value = extraction[field as keyof StudyExtraction];
    if (value === undefined || value === null || value === '' || value === 0) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Population validation
  if (extraction.population) {
    if (!extraction.population.total_n || extraction.population.total_n === 0) {
      errors.push('Missing sample size (population.total_n)');
    }

    if (extraction.population.intervention_n && extraction.population.control_n) {
      const sum = extraction.population.intervention_n + extraction.population.control_n;
      if (sum > extraction.population.total_n) {
        errors.push('Group sizes exceed total sample size');
      }
    }

    if (extraction.population.male_percent !== undefined) {
      if (extraction.population.male_percent < 0 || extraction.population.male_percent > 100) {
        errors.push('Male percentage must be 0-100');
      }
    }

    if (!extraction.population.age_mean && !extraction.population.age_median) {
      warnings.push('Missing age data');
    }
  }

  // Outcome validation
  if (extraction.outcomes) {
    if (extraction.outcomes.primary.length === 0) {
      warnings.push('No primary outcomes extracted');
    }

    for (const outcome of [...extraction.outcomes.primary, ...extraction.outcomes.secondary]) {
      if (outcome.type === 'binary' && outcome.intervention.events !== undefined) {
        if (outcome.intervention.total && outcome.intervention.events > outcome.intervention.total) {
          errors.push(`Events exceed total for outcome: ${outcome.name}`);
        }
      }

      if (outcome.effect) {
        if (outcome.effect.ci_lower >= outcome.effect.ci_upper) {
          errors.push(`Invalid CI for outcome: ${outcome.name}`);
        }
      }
    }
  }

  // Follow-up validation
  if (extraction.follow_up) {
    if (extraction.follow_up.completeness_percent !== undefined) {
      if (extraction.follow_up.completeness_percent < 0 || extraction.follow_up.completeness_percent > 100) {
        errors.push('Follow-up completeness must be 0-100');
      }
    }
  }

  // Calculate completeness
  const allFields = [
    'study_id', 'title', 'authors', 'year', 'journal', 'country', 'study_design',
    'population.total_n', 'population.age_mean', 'population.male_percent',
    'intervention.name', 'outcomes.primary', 'follow_up.duration_months',
  ];

  let filledFields = 0;
  for (const field of allFields) {
    const parts = field.split('.');
    let value: any = extraction;
    for (const part of parts) {
      value = value?.[part];
    }
    if (value !== undefined && value !== null && value !== '' && value !== 0) {
      if (Array.isArray(value) ? value.length > 0 : true) {
        filledFields++;
      }
    }
  }

  const completeness = Math.round((filledFields / allFields.length) * 100);

  if (completeness < 50) {
    warnings.push(`Low extraction completeness: ${completeness}%`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    completeness,
  };
}

function generateTemplate(): string {
  const template = {
    study_id: '',
    title: '',
    authors: [],
    year: null,
    journal: '',
    doi: '',
    pmid: '',
    country: '',
    study_design: '# RCT, prospective_cohort, retrospective_cohort, case_control, case_series',

    population: {
      total_n: null,
      intervention_n: null,
      control_n: null,
      age_mean: null,
      age_sd: null,
      age_median: null,
      age_range: null,
      male_percent: null,
      diagnosis: '',
      severity: '',
      inclusion_criteria: [],
      exclusion_criteria: [],
    },

    intervention: {
      name: '',
      type: '# surgical, medical, device, behavioral, other',
      details: '',
      timing: '',
      technique: '',
    },

    comparator: {
      name: '',
      type: '# standard_care, placebo, active_comparator, historical, none',
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
            mean: null,
            sd: null,
          },
          control: {
            events: null,
            total: null,
            mean: null,
            sd: null,
          },
          effect: {
            measure: '# OR, RR, HR, MD, SMD',
            estimate: null,
            ci_lower: null,
            ci_upper: null,
            p_value: null,
          },
        },
      ],
      secondary: [],
    },

    follow_up: {
      duration_months: null,
      completeness_percent: null,
      loss_to_followup_n: null,
    },

    quality: {
      tool: '# ROB2, NOS, ROBINS-I, QUADAS-2, JBI',
      domains: {},
      overall: '',
      notes: '',
    },

    funding: '',
    conflicts: '',
    notes: '',
  };

  return yaml.stringify(template);
}

async function compileExtractions(
  extractionDir: string,
  outputFile: string,
  outcomeType: 'binary' | 'continuous'
): Promise<{ rowCount: number; studies: string[] }> {
  const files = await fs.readdir(extractionDir);
  const yamlFiles = files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));

  const rows: string[] = [];
  const studies: string[] = [];

  // Headers based on outcome type
  if (outcomeType === 'binary') {
    rows.push('study,year,events_int,n_int,events_ctrl,n_ctrl,subgroup');
  } else {
    rows.push('study,year,n_int,mean_int,sd_int,n_ctrl,mean_ctrl,sd_ctrl,subgroup');
  }

  for (const file of yamlFiles) {
    const content = await fs.readFile(path.join(extractionDir, file), 'utf-8');
    const extraction = yaml.parse(content) as Partial<StudyExtraction>;

    const allOutcomes = [
      ...extraction.outcomes?.primary || [],
      ...extraction.outcomes?.secondary || [],
    ];

    for (const outcome of allOutcomes) {
      if (outcome.type === outcomeType) {
        const study = extraction.study_id || path.basename(file, '.yaml');
        studies.push(study);

        if (outcomeType === 'binary') {
          rows.push([
            study,
            extraction.year || '',
            outcome.intervention.events ?? '',
            outcome.intervention.total ?? '',
            outcome.control?.events ?? '',
            outcome.control?.total ?? '',
            '', // subgroup
          ].join(','));
        } else {
          rows.push([
            study,
            extraction.year || '',
            outcome.intervention.total ?? '',
            outcome.intervention.mean ?? '',
            outcome.intervention.sd ?? '',
            outcome.control?.total ?? '',
            outcome.control?.mean ?? '',
            outcome.control?.sd ?? '',
            '', // subgroup
          ].join(','));
        }
      }
    }
  }

  await fs.writeFile(outputFile, rows.join('\n'));

  return {
    rowCount: rows.length - 1, // Exclude header
    studies: [...new Set(studies)],
  };
}

// ============================================
// MCP TOOLS DEFINITION
// ============================================

const tools: Tool[] = [
  {
    name: 'extract_pdf',
    description: 'Extract structured study data from a PDF file for systematic review',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the PDF file',
        },
        schema: {
          type: 'string',
          enum: ['neurosurgery', 'general', 'oncology'],
          description: 'Extraction schema to use',
          default: 'neurosurgery',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'extract_pdf_text',
    description: 'Extract raw text from a PDF file',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the PDF file',
        },
        pages: {
          type: 'array',
          items: { type: 'number' },
          description: 'Specific pages to extract (optional)',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'validate_extraction',
    description: 'Validate an extraction against the schema',
    inputSchema: {
      type: 'object',
      properties: {
        extraction: {
          type: 'object',
          description: 'The extraction object to validate',
        },
      },
      required: ['extraction'],
    },
  },
  {
    name: 'generate_template',
    description: 'Generate an empty extraction template in YAML format',
    inputSchema: {
      type: 'object',
      properties: {
        schema: {
          type: 'string',
          enum: ['neurosurgery', 'general'],
          default: 'neurosurgery',
        },
      },
    },
  },
  {
    name: 'compile_extractions',
    description: 'Compile multiple extraction YAML files into a pooled CSV for meta-analysis',
    inputSchema: {
      type: 'object',
      properties: {
        directory: {
          type: 'string',
          description: 'Directory containing extraction YAML files',
        },
        output: {
          type: 'string',
          description: 'Output CSV file path',
        },
        outcomeType: {
          type: 'string',
          enum: ['binary', 'continuous'],
          description: 'Type of outcome to compile',
        },
      },
      required: ['directory', 'output', 'outcomeType'],
    },
  },
  {
    name: 'parse_study',
    description: 'Parse structured study data from text using domain knowledge',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Text to parse (e.g., from PDF)',
        },
        schema: {
          type: 'string',
          enum: ['neurosurgery', 'general'],
          default: 'neurosurgery',
        },
      },
      required: ['text'],
    },
  },
];

// ============================================
// MCP SERVER
// ============================================

const server = new Server(
  {
    name: 'extraction-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools,
}));

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: any;

    switch (name) {
      case 'extract_pdf': {
        const extraction = await extractFromPdf(
          args.path as string,
          args.schema as string
        );
        const validation = validateExtraction(extraction);
        result = {
          extraction,
          validation,
          yaml: yaml.stringify(extraction),
        };
        break;
      }

      case 'extract_pdf_text': {
        const text = await extractPdfText(args.path as string);
        result = { text, length: text.length };
        break;
      }

      case 'validate_extraction': {
        result = validateExtraction(args.extraction as Partial<StudyExtraction>);
        break;
      }

      case 'generate_template': {
        result = { template: generateTemplate() };
        break;
      }

      case 'compile_extractions': {
        result = await compileExtractions(
          args.directory as string,
          args.output as string,
          args.outcomeType as 'binary' | 'continuous'
        );
        break;
      }

      case 'parse_study': {
        // Parse text similar to PDF extraction
        const text = args.text as string;
        const sampleSize = extractSampleSize(text);
        const age = extractAge(text);
        const followUp = extractFollowUp(text);

        result = {
          study_design: detectStudyDesign(text),
          year: extractYear(text),
          sample_size: sampleSize,
          age,
          follow_up: followUp,
          male_percent: extractMalePercent(text),
          doi: extractDOI(text),
          pmid: extractPMID(text),
        };
        break;
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Extraction MCP Server running on stdio');
}

main().catch(console.error);
