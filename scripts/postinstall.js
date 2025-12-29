#!/usr/bin/env node
/**
 * Post-install script for NeuroResearch Agent
 * Sets up configuration and checks dependencies
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const CONFIG_DIR = path.join(os.homedir(), '.nra');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.yaml');

console.log('\n🧠 NeuroResearch Agent - Post-Installation Setup\n');

// Create config directory
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  console.log('✓ Created config directory: ~/.nra/');
}

// Create default config if not exists
if (!fs.existsSync(CONFIG_FILE)) {
  const defaultConfig = `# NeuroResearch Agent Configuration
# See documentation for all options

# API Configuration (or use ANTHROPIC_API_KEY env var)
# anthropic:
#   api_key: sk-ant-...

# Default model
model: claude-sonnet-4-20250514

# Docker sandbox settings
docker:
  image: neuroresearch/sandbox:latest
  auto_pull: true
  memory_limit: 4g

# PubMed settings (required for literature search)
pubmed:
  email: your.email@institution.edu
  # api_key: your_ncbi_key  # Optional, for higher rate limits

# Default analysis settings
defaults:
  effect_measure: OR
  meta_model: random
  ci_level: 0.95
  prediction_interval: true

# Active skills
skills:
  - neurosurgery-literature
  - meta-analysis
  - data-extraction
  - risk-of-bias
  - manuscript-writing
  - network-meta-analysis
  - tsa-integration
`;
  
  fs.writeFileSync(CONFIG_FILE, defaultConfig);
  console.log('✓ Created default config: ~/.nra/config.yaml');
}

// Check for Docker
try {
  execSync('docker --version', { stdio: 'pipe' });
  console.log('✓ Docker detected');
  
  // Check if sandbox image exists
  try {
    execSync('docker inspect neuroresearch/sandbox:latest', { stdio: 'pipe' });
    console.log('✓ Sandbox image available');
  } catch {
    console.log('ℹ Sandbox image not found - will be pulled on first use');
    console.log('  Run: docker pull neuroresearch/sandbox:latest');
  }
} catch {
  console.log('⚠ Docker not found - R execution will require local R installation');
}

// Check for API key
if (!process.env.ANTHROPIC_API_KEY) {
  console.log('\n⚠ ANTHROPIC_API_KEY not set in environment');
  console.log('  Set it with: export ANTHROPIC_API_KEY=sk-ant-...');
  console.log('  Or add to ~/.nra/config.yaml');
}

console.log('\n✓ Installation complete!\n');
console.log('Quick start:');
console.log('  nra init my-systematic-review   # Create new project');
console.log('  nra chat                        # Start interactive session');
console.log('  nra help                        # Show all commands');
console.log('\nDocumentation: https://github.com/neuroresearch/neuroresearch-agent');
console.log('');
