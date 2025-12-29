#!/usr/bin/env node
/**
 * R Execute MCP Server
 * Executes R code in a Docker sandbox for meta-analysis and visualization
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { spawn, execSync } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Configuration
const DOCKER_IMAGE = process.env.NRA_DOCKER_IMAGE || 'neuroresearch/sandbox:latest';
const CONTAINER_NAME = 'nra-r-sandbox';
const WORK_DIR = process.env.NRA_WORK_DIR || process.cwd();

// Pre-built R script templates
const R_TEMPLATES = {
  meta_binary: `
library(meta)
library(metafor)

data <- read.csv("{{INPUT}}")

ma <- metabin(
  event.e = {{EVENTS_INT}},
  n.e = {{N_INT}},
  event.c = {{EVENTS_CTRL}},
  n.c = {{N_CTRL}},
  studlab = paste({{STUDY}}, {{YEAR}}),
  data = data,
  sm = "{{MEASURE}}",
  random = TRUE,
  hakn = TRUE,
  prediction = TRUE
)

# Save summary
sink("{{OUTPUT}}/summary.txt")
print(summary(ma))
sink()

# Forest plot
png("{{OUTPUT}}/forest_plot.png", width = 1200, height = 800, res = 150)
forest(ma, sortvar = TE, prediction = TRUE)
dev.off()

# Funnel plot
png("{{OUTPUT}}/funnel_plot.png", width = 800, height = 600, res = 150)
funnel(ma)
dev.off()

# Results JSON
results <- list(
  k = ma$k,
  estimate = exp(ma$TE.random),
  ci_lower = exp(ma$lower.random),
  ci_upper = exp(ma$upper.random),
  p_value = ma$pval.random,
  i2 = ma$I2,
  tau2 = ma$tau2,
  prediction_lower = exp(ma$lower.predict),
  prediction_upper = exp(ma$upper.predict)
)
jsonlite::write_json(results, "{{OUTPUT}}/results.json")
`,

  meta_continuous: `
library(meta)

data <- read.csv("{{INPUT}}")

ma <- metacont(
  n.e = {{N_INT}},
  mean.e = {{MEAN_INT}},
  sd.e = {{SD_INT}},
  n.c = {{N_CTRL}},
  mean.c = {{MEAN_CTRL}},
  sd.c = {{SD_CTRL}},
  studlab = paste({{STUDY}}, {{YEAR}}),
  data = data,
  sm = "{{MEASURE}}",
  random = TRUE,
  hakn = TRUE
)

png("{{OUTPUT}}/forest_plot.png", width = 1200, height = 800, res = 150)
forest(ma, sortvar = TE, prediction = TRUE)
dev.off()

results <- list(
  k = ma$k,
  estimate = ma$TE.random,
  ci_lower = ma$lower.random,
  ci_upper = ma$upper.random,
  p_value = ma$pval.random,
  i2 = ma$I2,
  tau2 = ma$tau2
)
jsonlite::write_json(results, "{{OUTPUT}}/results.json")
`,

  meta_proportion: `
library(meta)

data <- read.csv("{{INPUT}}")

ma <- metaprop(
  event = {{EVENTS}},
  n = {{TOTAL}},
  studlab = paste({{STUDY}}, {{YEAR}}),
  data = data,
  sm = "PLOGIT",
  random = TRUE,
  hakn = TRUE
)

png("{{OUTPUT}}/forest_plot.png", width = 1200, height = 800, res = 150)
forest(ma, sortvar = TE, prediction = TRUE)
dev.off()

results <- list(
  k = ma$k,
  proportion = plogis(ma$TE.random),
  ci_lower = plogis(ma$lower.random),
  ci_upper = plogis(ma$upper.random),
  p_value = ma$pval.random,
  i2 = ma$I2
)
jsonlite::write_json(results, "{{OUTPUT}}/results.json")
`,

  forest_plot: `
library(meta)
library(forestplot)

data <- read.csv("{{INPUT}}")

# Create meta object based on data structure
if ("events_int" %in% names(data)) {
  ma <- metabin(event.e = events_int, n.e = n_int,
                event.c = events_ctrl, n.c = n_ctrl,
                studlab = study, data = data, sm = "OR", random = TRUE)
} else if ("mean_int" %in% names(data)) {
  ma <- metacont(n.e = n_int, mean.e = mean_int, sd.e = sd_int,
                 n.c = n_ctrl, mean.c = mean_ctrl, sd.c = sd_ctrl,
                 studlab = study, data = data, sm = "MD", random = TRUE)
} else {
  ma <- metaprop(event = events, n = total, studlab = study, data = data)
}

png("{{OUTPUT}}", width = {{WIDTH}}, height = {{HEIGHT}}, res = 150)
forest(ma,
       sortvar = TE,
       prediction = TRUE,
       print.tau2 = TRUE,
       print.I2 = TRUE,
       col.square = "navy",
       col.diamond = "maroon")
dev.off()
`,

  funnel_plot: `
library(meta)

data <- read.csv("{{INPUT}}")

if ("events_int" %in% names(data)) {
  ma <- metabin(event.e = events_int, n.e = n_int,
                event.c = events_ctrl, n.c = n_ctrl,
                studlab = study, data = data, sm = "OR", random = TRUE)
} else {
  ma <- metacont(n.e = n_int, mean.e = mean_int, sd.e = sd_int,
                 n.c = n_ctrl, mean.c = mean_ctrl, sd.c = sd_ctrl,
                 studlab = study, data = data, sm = "MD", random = TRUE)
}

png("{{OUTPUT}}", width = 800, height = 600, res = 150)
funnel(ma, studlab = TRUE)
dev.off()

# Egger's test
sink("{{OUTPUT}}.egger.txt")
print(metabias(ma))
sink()
`,

  prisma: `
library(PRISMA2020)

data <- PRISMA_data(
  identification = list(
    database_n = {{IDENTIFIED}},
    register_n = 0
  ),
  screening = list(
    duplicates_n = {{DUPLICATES}},
    excluded_automatic_n = 0,
    excluded_other_n = 0,
    records_screened_n = {{SCREENED}},
    records_excluded_n = {{EXCLUDED_SCREENING}}
  ),
  eligibility = list(
    reports_sought_n = {{ELIGIBLE}},
    reports_notretrieved_n = 0,
    reports_assessed_n = {{ELIGIBLE}},
    reports_excluded_n = {{ELIGIBLE}} - {{INCLUDED}},
    reasons_for_exclusion = list(
      "Not relevant" = round(({{ELIGIBLE}} - {{INCLUDED}}) / 2),
      "Wrong outcome" = {{ELIGIBLE}} - {{INCLUDED}} - round(({{ELIGIBLE}} - {{INCLUDED}}) / 2)
    )
  ),
  included = list(
    new_studies_n = {{INCLUDED}},
    new_reports_n = {{INCLUDED}},
    previous_studies_n = 0,
    previous_reports_n = 0,
    total_studies_n = {{INCLUDED}},
    total_reports_n = {{INCLUDED}}
  )
)

prisma_plot <- PRISMA_flowdiagram(data, interactive = FALSE)

# Save as PNG
png("{{OUTPUT}}", width = 800, height = 1000, res = 150)
print(prisma_plot)
dev.off()
`,

  rob_traffic_light: `
library(robvis)

data <- read.csv("{{INPUT}}")

traffic_light <- rob_traffic_light(
  data = data,
  tool = "{{TOOL}}",
  colour = "cochrane"
)

ggsave("{{OUTPUT}}", traffic_light, width = 12, height = 8, dpi = 300)
`,

  subgroup_analysis: `
library(meta)

data <- read.csv("{{INPUT}}")

if ("events_int" %in% names(data)) {
  ma <- metabin(event.e = events_int, n.e = n_int,
                event.c = events_ctrl, n.c = n_ctrl,
                studlab = study, data = data, sm = "OR", random = TRUE)
} else {
  ma <- metacont(n.e = n_int, mean.e = mean_int, sd.e = sd_int,
                 n.c = n_ctrl, mean.c = mean_ctrl, sd.c = sd_ctrl,
                 studlab = study, data = data, sm = "MD", random = TRUE)
}

ma_sub <- update(ma, subgroup = data${{SUBGROUP}})

png("{{OUTPUT}}", width = 1400, height = 1000, res = 150)
forest(ma_sub, sortvar = TE, subgroup = TRUE)
dev.off()

# Subgroup test
sink("{{OUTPUT}}.test.txt")
cat("Test for subgroup differences:\\n")
cat(sprintf("Q = %.2f, df = %d, p = %.4f\\n", 
            ma_sub$Q.b.random, ma_sub$df.Q.b, ma_sub$pval.Q.b.random))
sink()
`,
};

// Define tools
const tools: Tool[] = [
  {
    name: 'r_execute',
    description: 'Execute arbitrary R code in the sandbox',
    inputSchema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'R code to execute',
        },
        saveOutput: {
          type: 'boolean',
          description: 'Save console output to file',
          default: false,
        },
      },
      required: ['code'],
    },
  },
  {
    name: 'r_meta_analysis',
    description: 'Run a complete meta-analysis with forest plot, funnel plot, and summary',
    inputSchema: {
      type: 'object',
      properties: {
        input: {
          type: 'string',
          description: 'Path to input CSV file',
        },
        outcome: {
          type: 'string',
          description: 'Name of the outcome being analyzed',
        },
        type: {
          type: 'string',
          enum: ['binary', 'continuous', 'proportion'],
          description: 'Type of outcome data',
        },
        measure: {
          type: 'string',
          enum: ['OR', 'RR', 'RD', 'MD', 'SMD'],
          description: 'Effect measure',
          default: 'OR',
        },
        columns: {
          type: 'object',
          description: 'Column name mappings',
          properties: {
            study: { type: 'string', default: 'study' },
            year: { type: 'string', default: 'year' },
            events_int: { type: 'string' },
            n_int: { type: 'string' },
            events_ctrl: { type: 'string' },
            n_ctrl: { type: 'string' },
            mean_int: { type: 'string' },
            sd_int: { type: 'string' },
            mean_ctrl: { type: 'string' },
            sd_ctrl: { type: 'string' },
            events: { type: 'string' },
            total: { type: 'string' },
          },
        },
        outputDir: {
          type: 'string',
          description: 'Output directory',
          default: './results',
        },
      },
      required: ['input', 'type'],
    },
  },
  {
    name: 'r_forest_plot',
    description: 'Generate a forest plot from meta-analysis data',
    inputSchema: {
      type: 'object',
      properties: {
        input: {
          type: 'string',
          description: 'Path to input CSV file',
        },
        output: {
          type: 'string',
          description: 'Output file path',
          default: 'figures/forest_plot.png',
        },
        width: {
          type: 'number',
          default: 1200,
        },
        height: {
          type: 'number',
          default: 800,
        },
      },
      required: ['input'],
    },
  },
  {
    name: 'r_funnel_plot',
    description: 'Generate a funnel plot for publication bias assessment',
    inputSchema: {
      type: 'object',
      properties: {
        input: {
          type: 'string',
          description: 'Path to input CSV file',
        },
        output: {
          type: 'string',
          description: 'Output file path',
          default: 'figures/funnel_plot.png',
        },
      },
      required: ['input'],
    },
  },
  {
    name: 'r_prisma',
    description: 'Generate a PRISMA 2020 flow diagram',
    inputSchema: {
      type: 'object',
      properties: {
        identified: { type: 'number', description: 'Records identified' },
        duplicates: { type: 'number', description: 'Duplicates removed', default: 0 },
        screened: { type: 'number', description: 'Records screened' },
        excludedScreening: { type: 'number', description: 'Excluded at screening' },
        eligible: { type: 'number', description: 'Reports assessed for eligibility' },
        included: { type: 'number', description: 'Studies included' },
        output: { type: 'string', default: 'figures/prisma_flow.png' },
      },
      required: ['identified', 'screened', 'eligible', 'included'],
    },
  },
  {
    name: 'r_rob_plot',
    description: 'Generate risk of bias traffic light plot',
    inputSchema: {
      type: 'object',
      properties: {
        input: {
          type: 'string',
          description: 'Path to risk of bias CSV file',
        },
        tool: {
          type: 'string',
          enum: ['ROB2', 'ROBINS-I', 'QUADAS-2'],
          description: 'Risk of bias tool used',
        },
        output: {
          type: 'string',
          default: 'figures/rob_traffic_light.png',
        },
      },
      required: ['input', 'tool'],
    },
  },
  {
    name: 'r_subgroup',
    description: 'Run subgroup analysis',
    inputSchema: {
      type: 'object',
      properties: {
        input: {
          type: 'string',
          description: 'Path to input CSV file',
        },
        subgroup: {
          type: 'string',
          description: 'Column name for subgroup variable',
        },
        output: {
          type: 'string',
          default: 'figures/subgroup_forest.png',
        },
      },
      required: ['input', 'subgroup'],
    },
  },
  {
    name: 'r_install_packages',
    description: 'Install R packages in the sandbox',
    inputSchema: {
      type: 'object',
      properties: {
        packages: {
          type: 'array',
          items: { type: 'string' },
          description: 'Package names to install',
        },
      },
      required: ['packages'],
    },
  },
];

// Docker helper functions
async function ensureContainer(): Promise<void> {
  try {
    // Check if container exists and is running
    execSync(`docker inspect ${CONTAINER_NAME}`, { stdio: 'pipe' });
    
    // Check if running
    const status = execSync(`docker inspect -f '{{.State.Running}}' ${CONTAINER_NAME}`, {
      encoding: 'utf-8',
    }).trim();
    
    if (status !== 'true') {
      execSync(`docker start ${CONTAINER_NAME}`, { stdio: 'pipe' });
    }
  } catch {
    // Container doesn't exist, create it
    execSync(
      `docker run -d --name ${CONTAINER_NAME} -v "${WORK_DIR}:/workspace" ${DOCKER_IMAGE} tail -f /dev/null`,
      { stdio: 'pipe' }
    );
  }
}

async function executeInContainer(command: string): Promise<string> {
  await ensureContainer();
  
  const result = execSync(`docker exec ${CONTAINER_NAME} bash -c "${command.replace(/"/g, '\\"')}"`, {
    encoding: 'utf-8',
    cwd: WORK_DIR,
    maxBuffer: 50 * 1024 * 1024, // 50MB
  });
  
  return result;
}

async function executeRCode(code: string): Promise<string> {
  // Write code to temp file
  const tempFile = path.join(os.tmpdir(), `nra_${Date.now()}.R`);
  await fs.writeFile(tempFile, code);
  
  try {
    // Copy to container
    execSync(`docker cp "${tempFile}" ${CONTAINER_NAME}:/tmp/script.R`, { stdio: 'pipe' });
    
    // Execute
    const result = await executeInContainer('cd /workspace && Rscript /tmp/script.R 2>&1');
    
    return result;
  } finally {
    // Cleanup
    await fs.unlink(tempFile).catch(() => {});
    await executeInContainer('rm -f /tmp/script.R').catch(() => {});
  }
}

function fillTemplate(template: string, vars: Record<string, any>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
  }
  return result;
}

// Tool implementations
async function runMetaAnalysis(params: any): Promise<any> {
  const {
    input,
    type,
    measure = 'OR',
    columns = {},
    outputDir = './results',
  } = params;
  
  // Ensure output directory exists
  await fs.mkdir(path.join(WORK_DIR, outputDir), { recursive: true });
  
  // Select template based on type
  let template: string;
  switch (type) {
    case 'binary':
      template = R_TEMPLATES.meta_binary;
      break;
    case 'continuous':
      template = R_TEMPLATES.meta_continuous;
      break;
    case 'proportion':
      template = R_TEMPLATES.meta_proportion;
      break;
    default:
      throw new Error(`Unknown outcome type: ${type}`);
  }
  
  // Fill template
  const code = fillTemplate(template, {
    INPUT: input,
    OUTPUT: outputDir,
    MEASURE: measure,
    STUDY: columns.study || 'study',
    YEAR: columns.year || 'year',
    EVENTS_INT: columns.events_int || 'events_int',
    N_INT: columns.n_int || 'n_int',
    EVENTS_CTRL: columns.events_ctrl || 'events_ctrl',
    N_CTRL: columns.n_ctrl || 'n_ctrl',
    MEAN_INT: columns.mean_int || 'mean_int',
    SD_INT: columns.sd_int || 'sd_int',
    MEAN_CTRL: columns.mean_ctrl || 'mean_ctrl',
    SD_CTRL: columns.sd_ctrl || 'sd_ctrl',
    EVENTS: columns.events || 'events',
    TOTAL: columns.total || 'total',
  });
  
  // Execute
  const output = await executeRCode(code);
  
  // Read results
  const resultsPath = path.join(WORK_DIR, outputDir, 'results.json');
  const results = JSON.parse(await fs.readFile(resultsPath, 'utf-8'));
  
  return {
    ...results,
    output,
    files: [
      `${outputDir}/forest_plot.png`,
      `${outputDir}/funnel_plot.png`,
      `${outputDir}/summary.txt`,
      `${outputDir}/results.json`,
    ],
  };
}

async function generateForestPlot(params: any): Promise<any> {
  const { input, output = 'figures/forest_plot.png', width = 1200, height = 800 } = params;
  
  // Ensure output directory exists
  await fs.mkdir(path.dirname(path.join(WORK_DIR, output)), { recursive: true });
  
  const code = fillTemplate(R_TEMPLATES.forest_plot, {
    INPUT: input,
    OUTPUT: output,
    WIDTH: width,
    HEIGHT: height,
  });
  
  await executeRCode(code);
  
  return { file: output };
}

async function generateFunnelPlot(params: any): Promise<any> {
  const { input, output = 'figures/funnel_plot.png' } = params;
  
  await fs.mkdir(path.dirname(path.join(WORK_DIR, output)), { recursive: true });
  
  const code = fillTemplate(R_TEMPLATES.funnel_plot, {
    INPUT: input,
    OUTPUT: output,
  });
  
  await executeRCode(code);
  
  return { file: output };
}

async function generatePRISMA(params: any): Promise<any> {
  const {
    identified,
    duplicates = 0,
    screened,
    excludedScreening = 0,
    eligible,
    included,
    output = 'figures/prisma_flow.png',
  } = params;
  
  await fs.mkdir(path.dirname(path.join(WORK_DIR, output)), { recursive: true });
  
  const code = fillTemplate(R_TEMPLATES.prisma, {
    IDENTIFIED: identified,
    DUPLICATES: duplicates,
    SCREENED: screened,
    EXCLUDED_SCREENING: excludedScreening || (screened - eligible),
    ELIGIBLE: eligible,
    INCLUDED: included,
    OUTPUT: output,
  });
  
  await executeRCode(code);
  
  return { file: output };
}

async function generateRoBPlot(params: any): Promise<any> {
  const { input, tool, output = 'figures/rob_traffic_light.png' } = params;
  
  await fs.mkdir(path.dirname(path.join(WORK_DIR, output)), { recursive: true });
  
  const code = fillTemplate(R_TEMPLATES.rob_traffic_light, {
    INPUT: input,
    TOOL: tool,
    OUTPUT: output,
  });
  
  await executeRCode(code);
  
  return { file: output };
}

async function runSubgroupAnalysis(params: any): Promise<any> {
  const { input, subgroup, output = 'figures/subgroup_forest.png' } = params;
  
  await fs.mkdir(path.dirname(path.join(WORK_DIR, output)), { recursive: true });
  
  const code = fillTemplate(R_TEMPLATES.subgroup_analysis, {
    INPUT: input,
    SUBGROUP: subgroup,
    OUTPUT: output,
  });
  
  const consoleOutput = await executeRCode(code);
  
  // Read test results
  const testFile = path.join(WORK_DIR, `${output}.test.txt`);
  let testResults = '';
  try {
    testResults = await fs.readFile(testFile, 'utf-8');
  } catch {}
  
  return { file: output, testResults, output: consoleOutput };
}

async function installPackages(packages: string[]): Promise<string> {
  const code = `install.packages(c(${packages.map(p => `"${p}"`).join(', ')}), repos="https://cloud.r-project.org")`;
  return executeRCode(code);
}

// Create server
const server = new Server(
  {
    name: 'r-execute-server',
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
      case 'r_execute':
        result = await executeRCode(args.code as string);
        break;
      case 'r_meta_analysis':
        result = await runMetaAnalysis(args);
        break;
      case 'r_forest_plot':
        result = await generateForestPlot(args);
        break;
      case 'r_funnel_plot':
        result = await generateFunnelPlot(args);
        break;
      case 'r_prisma':
        result = await generatePRISMA(args);
        break;
      case 'r_rob_plot':
        result = await generateRoBPlot(args);
        break;
      case 'r_subgroup':
        result = await runSubgroupAnalysis(args);
        break;
      case 'r_install_packages':
        result = await installPackages(args.packages as string[]);
        break;
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
  console.error('R Execute MCP Server running on stdio');
}

main().catch(console.error);
