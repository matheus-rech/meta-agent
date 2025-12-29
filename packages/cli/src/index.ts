#!/usr/bin/env node
/**
 * NeuroResearch Agent CLI
 * Main entry point for the research agent
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { NeuroResearchAgent } from './agent/index.js';
import { Config } from './config/index.js';
import { version } from '../package.json';

const program = new Command();

// ASCII Art Banner
const banner = `
${chalk.cyan('╔═══════════════════════════════════════════════════════════╗')}
${chalk.cyan('║')}  ${chalk.bold.white('NeuroResearch Agent')} ${chalk.gray('v' + version)}                           ${chalk.cyan('║')}
${chalk.cyan('║')}  ${chalk.gray('AI-Powered Neurosurgery Systematic Review Assistant')}     ${chalk.cyan('║')}
${chalk.cyan('╚═══════════════════════════════════════════════════════════╝')}
`;

program
  .name('nra')
  .description('NeuroResearch Agent - AI-powered neurosurgery research assistant')
  .version(version);

// ============================================
// INIT COMMAND
// ============================================
program
  .command('init <project-name>')
  .description('Initialize a new research project')
  .option('-t, --template <template>', 'Project template', 'systematic-review')
  .option('--no-docker', 'Skip Docker setup')
  .action(async (projectName, options) => {
    console.log(banner);
    const spinner = ora('Initializing project...').start();
    
    try {
      const config = await Config.load();
      const agent = new NeuroResearchAgent(config);
      
      await agent.initProject(projectName, {
        template: options.template,
        setupDocker: options.docker,
      });
      
      spinner.succeed(chalk.green(`Project '${projectName}' initialized!`));
      console.log(`
${chalk.bold('Next steps:')}
  ${chalk.cyan('cd')} ${projectName}
  ${chalk.cyan('nra chat')}    # Start interactive session
  ${chalk.cyan('nra help')}    # Show all commands
      `);
    } catch (error) {
      spinner.fail(chalk.red('Failed to initialize project'));
      console.error(error);
      process.exit(1);
    }
  });

// ============================================
// CHAT COMMAND (Interactive Mode)
// ============================================
program
  .command('chat')
  .description('Start interactive chat session with the agent')
  .option('--no-sandbox', 'Disable Docker sandbox')
  .option('--model <model>', 'Claude model to use', 'claude-sonnet-4-20250514')
  .action(async (options) => {
    console.log(banner);
    
    const config = await Config.load();
    const agent = new NeuroResearchAgent({
      ...config,
      model: options.model,
      useSandbox: options.sandbox,
    });
    
    await agent.startSandbox();
    
    console.log(chalk.gray('Type your message or use /commands. Type /help for available commands.\n'));
    
    // Interactive loop
    while (true) {
      const { input } = await inquirer.prompt([
        {
          type: 'input',
          name: 'input',
          message: chalk.cyan('You:'),
          prefix: '',
        },
      ]);
      
      if (!input.trim()) continue;
      
      // Handle special commands
      if (input.startsWith('/')) {
        const handled = await handleSlashCommand(agent, input);
        if (handled === 'exit') break;
        continue;
      }
      
      // Regular message
      const spinner = ora('Thinking...').start();
      try {
        const response = await agent.chat(input);
        spinner.stop();
        console.log(chalk.green('\nAgent:'), response, '\n');
      } catch (error) {
        spinner.fail('Error processing message');
        console.error(error);
      }
    }
    
    await agent.stopSandbox();
  });

// ============================================
// SEARCH COMMAND
// ============================================
program
  .command('search <query>')
  .description('Search PubMed for neurosurgical literature')
  .option('-n, --max-results <n>', 'Maximum results', '20')
  .option('-y, --years <years>', 'Years to search', '10')
  .option('-t, --type <type>', 'Study type filter (rct, meta, cohort, all)', 'all')
  .option('-o, --output <file>', 'Output file')
  .option('--format <format>', 'Output format (text, markdown, json)', 'markdown')
  .action(async (query, options) => {
    const spinner = ora('Searching PubMed...').start();
    
    try {
      const config = await Config.load();
      const agent = new NeuroResearchAgent(config);
      
      const results = await agent.tools.pubmed.search({
        query,
        maxResults: parseInt(options.maxResults),
        years: parseInt(options.years),
        studyType: options.type,
      });
      
      spinner.succeed(`Found ${results.total} results`);
      
      const output = formatSearchResults(results, options.format);
      
      if (options.output) {
        const fs = await import('fs/promises');
        await fs.writeFile(options.output, output);
        console.log(chalk.green(`Saved to ${options.output}`));
      } else {
        console.log(output);
      }
    } catch (error) {
      spinner.fail('Search failed');
      console.error(error);
      process.exit(1);
    }
  });

// ============================================
// EXTRACT COMMAND
// ============================================
program
  .command('extract <files...>')
  .description('Extract data from PDF studies')
  .option('-s, --schema <schema>', 'Extraction schema', 'neurosurgery')
  .option('-o, --output <dir>', 'Output directory', './extractions')
  .option('--validate', 'Validate extracted data')
  .action(async (files, options) => {
    const spinner = ora('Extracting data...').start();
    
    try {
      const config = await Config.load();
      const agent = new NeuroResearchAgent(config);
      
      for (const file of files) {
        spinner.text = `Extracting: ${file}`;
        
        const extraction = await agent.tools.extraction.extract({
          file,
          schema: options.schema,
        });
        
        if (options.validate) {
          const validation = await agent.tools.extraction.validate(extraction);
          if (!validation.valid) {
            console.warn(chalk.yellow(`\nWarnings for ${file}:`));
            validation.warnings.forEach((w: string) => console.warn(`  - ${w}`));
          }
        }
        
        // Save extraction
        const fs = await import('fs/promises');
        const path = await import('path');
        const outputFile = path.join(
          options.output,
          path.basename(file, '.pdf') + '.yaml'
        );
        await fs.mkdir(options.output, { recursive: true });
        await fs.writeFile(outputFile, serializeExtraction(extraction));
        
        spinner.succeed(`Extracted: ${file} → ${outputFile}`);
      }
    } catch (error) {
      spinner.fail('Extraction failed');
      console.error(error);
      process.exit(1);
    }
  });

// ============================================
// META COMMAND
// ============================================
program
  .command('meta')
  .description('Run meta-analysis on extracted data')
  .requiredOption('-i, --input <file>', 'Input CSV file with extracted data')
  .requiredOption('-o, --outcome <outcome>', 'Outcome variable name')
  .option('-m, --measure <measure>', 'Effect measure (OR, RR, MD, SMD, HR)', 'OR')
  .option('-t, --type <type>', 'Outcome type (binary, continuous, survival)', 'binary')
  .option('--subgroup <var>', 'Subgroup variable')
  .option('--output <dir>', 'Output directory', './results')
  .action(async (options) => {
    const spinner = ora('Running meta-analysis...').start();
    
    try {
      const config = await Config.load();
      const agent = new NeuroResearchAgent(config);
      
      await agent.startSandbox();
      
      const result = await agent.tools.r.runMetaAnalysis({
        input: options.input,
        outcome: options.outcome,
        measure: options.measure,
        type: options.type,
        subgroup: options.subgroup,
        outputDir: options.output,
      });
      
      spinner.succeed('Meta-analysis complete');
      
      console.log(chalk.bold('\n📊 Results:'));
      console.log(`  Pooled ${options.measure}: ${result.estimate} [${result.ciLower}, ${result.ciUpper}]`);
      console.log(`  p-value: ${result.pValue}`);
      console.log(`  I²: ${(result.i2 * 100).toFixed(1)}%`);
      console.log(`  τ²: ${result.tau2.toFixed(4)}`);
      console.log(chalk.bold('\n📁 Generated files:'));
      result.files.forEach((f: string) => console.log(`  - ${f}`));
      
      await agent.stopSandbox();
    } catch (error) {
      spinner.fail('Meta-analysis failed');
      console.error(error);
      process.exit(1);
    }
  });

// ============================================
// FOREST COMMAND
// ============================================
program
  .command('forest')
  .description('Generate forest plot')
  .requiredOption('-i, --input <file>', 'Input data file')
  .option('-o, --output <file>', 'Output file', 'figures/forest_plot.png')
  .option('--width <px>', 'Width in pixels', '1200')
  .option('--height <px>', 'Height in pixels', '800')
  .action(async (options) => {
    const spinner = ora('Generating forest plot...').start();
    
    try {
      const config = await Config.load();
      const agent = new NeuroResearchAgent(config);
      
      await agent.startSandbox();
      
      await agent.tools.r.generateForestPlot({
        input: options.input,
        output: options.output,
        width: parseInt(options.width),
        height: parseInt(options.height),
      });
      
      spinner.succeed(`Forest plot saved to ${options.output}`);
      
      await agent.stopSandbox();
    } catch (error) {
      spinner.fail('Failed to generate forest plot');
      console.error(error);
      process.exit(1);
    }
  });

// ============================================
// PRISMA COMMAND
// ============================================
program
  .command('prisma')
  .description('Generate PRISMA flow diagram')
  .requiredOption('--identified <n>', 'Records identified')
  .requiredOption('--screened <n>', 'Records screened')
  .requiredOption('--eligible <n>', 'Reports assessed for eligibility')
  .requiredOption('--included <n>', 'Studies included')
  .option('--duplicates <n>', 'Duplicates removed', '0')
  .option('--excluded-screening <n>', 'Excluded at screening', '0')
  .option('--output <file>', 'Output file', 'figures/prisma_flow.png')
  .action(async (options) => {
    const spinner = ora('Generating PRISMA diagram...').start();
    
    try {
      const config = await Config.load();
      const agent = new NeuroResearchAgent(config);
      
      await agent.startSandbox();
      
      await agent.tools.r.generatePRISMA({
        identified: parseInt(options.identified),
        duplicates: parseInt(options.duplicates),
        screened: parseInt(options.screened),
        excludedScreening: parseInt(options.excludedScreening),
        eligible: parseInt(options.eligible),
        included: parseInt(options.included),
        output: options.output,
      });
      
      spinner.succeed(`PRISMA diagram saved to ${options.output}`);
      
      await agent.stopSandbox();
    } catch (error) {
      spinner.fail('Failed to generate PRISMA diagram');
      console.error(error);
      process.exit(1);
    }
  });

// ============================================
// SANDBOX COMMANDS
// ============================================
const sandbox = program
  .command('sandbox')
  .description('Manage Docker sandbox');

sandbox
  .command('start')
  .description('Start the Docker sandbox')
  .action(async () => {
    const spinner = ora('Starting sandbox...').start();
    try {
      const config = await Config.load();
      const agent = new NeuroResearchAgent(config);
      await agent.startSandbox();
      spinner.succeed('Sandbox started');
    } catch (error) {
      spinner.fail('Failed to start sandbox');
      console.error(error);
    }
  });

sandbox
  .command('stop')
  .description('Stop the Docker sandbox')
  .action(async () => {
    const spinner = ora('Stopping sandbox...').start();
    try {
      const config = await Config.load();
      const agent = new NeuroResearchAgent(config);
      await agent.stopSandbox();
      spinner.succeed('Sandbox stopped');
    } catch (error) {
      spinner.fail('Failed to stop sandbox');
      console.error(error);
    }
  });

sandbox
  .command('r')
  .description('Open interactive R session in sandbox')
  .action(async () => {
    const config = await Config.load();
    const agent = new NeuroResearchAgent(config);
    await agent.startSandbox();
    await agent.tools.sandbox.interactiveR();
  });

sandbox
  .command('exec-r <code>')
  .description('Execute R code in sandbox')
  .action(async (code) => {
    const config = await Config.load();
    const agent = new NeuroResearchAgent(config);
    await agent.startSandbox();
    const result = await agent.tools.r.execute(code);
    console.log(result);
    await agent.stopSandbox();
  });

// ============================================
// WRITE COMMAND
// ============================================
program
  .command('write <section>')
  .description('Write manuscript section (intro, methods, results, discussion)')
  .option('-o, --output <file>', 'Output file')
  .option('--journal <journal>', 'Target journal for formatting')
  .action(async (section, options) => {
    const spinner = ora(`Writing ${section} section...`).start();
    
    try {
      const config = await Config.load();
      const agent = new NeuroResearchAgent(config);
      
      const content = await agent.writeManuscriptSection(section, {
        journal: options.journal,
      });
      
      spinner.succeed(`${section} section written`);
      
      if (options.output) {
        const fs = await import('fs/promises');
        await fs.writeFile(options.output, content);
        console.log(chalk.green(`Saved to ${options.output}`));
      } else {
        console.log(content);
      }
    } catch (error) {
      spinner.fail(`Failed to write ${section}`);
      console.error(error);
      process.exit(1);
    }
  });

// ============================================
// DASHBOARD COMMAND
// ============================================
program
  .command('dashboard')
  .description('Start Shiny meta-analysis dashboard')
  .option('-p, --port <port>', 'Port number', '3838')
  .action(async (options) => {
    console.log(chalk.cyan(`Starting dashboard on port ${options.port}...`));
    
    const config = await Config.load();
    const agent = new NeuroResearchAgent(config);
    
    await agent.startSandbox();
    await agent.tools.sandbox.startShiny(parseInt(options.port));
    
    console.log(chalk.green(`\nDashboard running at http://localhost:${options.port}`));
    console.log(chalk.gray('Press Ctrl+C to stop\n'));
  });

// ============================================
// HELPER FUNCTIONS
// ============================================

async function handleSlashCommand(agent: NeuroResearchAgent, input: string): Promise<string | void> {
  const [command, ...args] = input.slice(1).split(' ');
  const argString = args.join(' ');
  
  switch (command.toLowerCase()) {
    case 'help':
      console.log(`
${chalk.bold('Available Commands:')}
  ${chalk.cyan('/search <query>')}      - Search PubMed
  ${chalk.cyan('/extract <file>')}      - Extract data from PDF
  ${chalk.cyan('/meta <outcome>')}      - Run meta-analysis
  ${chalk.cyan('/forest <outcome>')}    - Generate forest plot
  ${chalk.cyan('/funnel <outcome>')}    - Generate funnel plot
  ${chalk.cyan('/subgroup <var>')}      - Subgroup analysis
  ${chalk.cyan('/prisma')}              - Generate PRISMA diagram
  ${chalk.cyan('/grade <outcome>')}     - GRADE assessment
  ${chalk.cyan('/rob <tool>')}          - Risk of bias assessment
  ${chalk.cyan('/write <section>')}     - Write manuscript section
  ${chalk.cyan('/status')}              - Project status
  ${chalk.cyan('/clear')}               - Clear conversation history
  ${chalk.cyan('/exit')}                - Exit chat
      `);
      break;
      
    case 'exit':
    case 'quit':
    case 'q':
      console.log(chalk.gray('Goodbye!'));
      return 'exit';
      
    case 'clear':
      agent.clearHistory();
      console.log(chalk.gray('Conversation cleared.'));
      break;
      
    case 'status':
      const status = await agent.getProjectStatus();
      console.log(formatProjectStatus(status));
      break;
      
    case 'search':
      if (!argString) {
        console.log(chalk.yellow('Usage: /search <query>'));
        break;
      }
      const searchSpinner = ora('Searching...').start();
      const results = await agent.tools.pubmed.search({ query: argString });
      searchSpinner.stop();
      console.log(formatSearchResults(results, 'text'));
      break;
      
    default:
      // Pass to agent for handling
      const response = await agent.handleSlashCommand(command, argString);
      console.log(response);
  }
}

function formatSearchResults(results: any, format: string): string {
  if (format === 'json') {
    return JSON.stringify(results, null, 2);
  }
  
  if (format === 'markdown') {
    let output = `# PubMed Search Results\n\n`;
    output += `**Total:** ${results.total} | **Showing:** ${results.articles.length}\n\n`;
    
    for (const article of results.articles) {
      output += `## ${article.authors} (${article.year})\n`;
      output += `**${article.title}**\n\n`;
      output += `*${article.journal}* | PMID: [${article.pmid}](${article.url})\n\n`;
      if (article.abstract) {
        output += `> ${article.abstract.slice(0, 300)}...\n\n`;
      }
    }
    return output;
  }
  
  // Text format
  let output = `\n${'='.repeat(60)}\n`;
  output += `Found ${results.total} results (showing ${results.articles.length})\n`;
  output += `${'='.repeat(60)}\n\n`;
  
  for (let i = 0; i < results.articles.length; i++) {
    const a = results.articles[i];
    output += `[${i + 1}] ${a.authors} (${a.year})\n`;
    output += `    ${a.title}\n`;
    output += `    ${a.journal} | PMID: ${a.pmid}\n\n`;
  }
  
  return output;
}

function formatProjectStatus(status: any): string {
  return `
${chalk.bold('📊 Project Status')}
${chalk.gray('─'.repeat(40))}
  Extractions: ${status.extractions} studies
  Analyses: ${status.analyses} complete
  Figures: ${status.figures} generated
  Manuscript: ${status.manuscriptProgress}%
${chalk.gray('─'.repeat(40))}
  `;
}

function serializeExtraction(extraction: any): string {
  // Convert to YAML format
  const yaml = require('yaml');
  return yaml.stringify(extraction);
}

// Parse and run
program.parse();
