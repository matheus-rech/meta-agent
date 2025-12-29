# NeuroResearch Agent SDK

> **AI-powered systematic review and meta-analysis toolkit for neurosurgery research**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)

## Overview

NeuroResearch Agent (NRA) is a complete toolkit for conducting systematic reviews and meta-analyses in neurosurgery. It combines:

- 🤖 **Claude AI** for intelligent task decomposition and execution
- 📚 **Domain expertise** in neurosurgery subspecialties
- 📊 **R/Python** statistical analysis in Docker sandbox
- 🔧 **MCP servers** for modular tool integration
- 📝 **PRISMA-compliant** manuscript generation

## Quick Start

```bash
# Install globally
npm install -g neuroresearch-agent

# Configure API key
export ANTHROPIC_API_KEY=sk-ant-...

# Create new project
nra init my-systematic-review

# Start interactive session
cd my-systematic-review
nra chat
```

## Features

### 📖 Literature Search
- PubMed with neurosurgery-specific MeSH expansion
- PICO-based search strategy building
- Citation and related article discovery
- Subspecialty knowledge: vascular, oncology, spine, functional, pediatric, trauma

### 📊 Meta-Analysis
- Binary outcomes (OR, RR, RD)
- Continuous outcomes (MD, SMD)
- Proportions and incidence rates
- Survival/time-to-event (HR)
- Network meta-analysis
- Trial sequential analysis

### 📈 Visualizations
- Forest plots (publication-ready)
- Funnel plots with trim-and-fill
- PRISMA flow diagrams
- Risk of bias traffic lights
- Network geometry plots
- Subgroup and cumulative analyses

### 📝 Manuscript Writing
- PRISMA 2020 compliant sections
- Journal-specific formatting
- GRADE certainty assessment
- Summary of findings tables

## Architecture

```
neuroresearch-agent/
├── packages/
│   ├── cli/                    # Command-line interface
│   ├── core/                   # Agent core (planner, executor, memory)
│   ├── mcp-servers/
│   │   ├── pubmed/             # PubMed search server
│   │   └── r-execute/          # R execution server
│   └── skills/
│       ├── neurosurgery-literature/
│       ├── meta-analysis/
│       ├── data-extraction/
│       ├── risk-of-bias/
│       ├── manuscript-writing/
│       ├── network-meta-analysis/
│       └── tsa-integration/
└── docker/
    └── Dockerfile.sandbox      # R/Python environment
```

## Commands

### Project Management
```bash
nra init <name>           # Create new project
nra status                # Show project progress
nra chat                  # Interactive session
```

### Research Workflow
```bash
nra search <query>        # Search PubMed
nra extract <file>        # Extract study data
nra meta --input data.csv # Run meta-analysis
nra prisma                # Generate PRISMA diagram
```

### Analysis
```bash
nra meta --type binary --measure OR
nra forest --input results.csv
nra funnel --input results.csv
nra subgroup --by timing
```

### Reporting
```bash
nra write methods         # Draft methods section
nra grade                 # GRADE assessment
nra export --journal "J Neurosurg"
```

### Docker Sandbox
```bash
nra sandbox start         # Start R/Python container
nra sandbox stop          # Stop container
nra sandbox r             # Interactive R session
```

## Skills System

Skills are modular plugins that provide domain knowledge:

| Skill | Description |
|-------|-------------|
| `neurosurgery-literature` | Subspecialty-aware literature search |
| `meta-analysis` | Statistical analysis templates |
| `data-extraction` | Structured extraction schemas |
| `risk-of-bias` | RoB 2, NOS, ROBINS-I assessment |
| `manuscript-writing` | PRISMA-compliant drafting |
| `network-meta-analysis` | Multi-treatment comparisons |
| `tsa-integration` | Trial sequential analysis |

## Configuration

Configuration is stored in `~/.nra/config.yaml`:

```yaml
# API Configuration
anthropic:
  api_key: ${ANTHROPIC_API_KEY}

model: claude-sonnet-4-20250514

# Docker sandbox
docker:
  image: neuroresearch/sandbox:latest
  auto_pull: true
  memory_limit: 4g

# PubMed
pubmed:
  email: your.email@institution.edu
  api_key: ${NCBI_API_KEY}

# Default analysis settings
defaults:
  effect_measure: OR
  meta_model: random
  ci_level: 0.95
  prediction_interval: true
```

## Docker Sandbox

The sandbox container includes:

**R Packages:**
- meta, metafor, dmetar, netmeta
- robvis, forestplot, PRISMA2020
- survival, survminer
- gtsummary, flextable, officer
- tidyverse, ggplot2

**Python Packages:**
- pandas, numpy, scipy
- pdfplumber, tabula-py
- matplotlib, seaborn

### Build locally:
```bash
docker build -t neuroresearch/sandbox:latest -f docker/Dockerfile.sandbox .
```

## Example Workflow

```bash
# 1. Initialize project
nra init "DBS for Parkinsons"

# 2. Start interactive session
nra chat

> Search for RCTs on DBS vs best medical therapy for Parkinson's

# Claude searches PubMed with appropriate MeSH terms...

> Extract data from the included studies

# Claude guides you through structured extraction...

> Run meta-analysis on motor outcomes (UPDRS-III)

# Claude executes R analysis, generates forest plot...

> Write the methods section for JAMA Neurology

# Claude drafts PRISMA-compliant methods...

# 3. Export final package
nra export --journal "JAMA Neurol"
```

## Development

```bash
# Clone repository
git clone https://github.com/neuroresearch/neuroresearch-agent
cd neuroresearch-agent

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Development mode
pnpm dev
```

## Requirements

- Node.js ≥ 18.0.0
- Docker (for R/Python sandbox)
- Anthropic API key

## License

MIT License - see [LICENSE](LICENSE)

## Acknowledgments

- [Anthropic Claude](https://anthropic.com) - AI reasoning
- [Model Context Protocol](https://modelcontextprotocol.io) - Tool integration
- [R meta package](https://cran.r-project.org/package=meta) - Statistical analysis
- [robvis](https://mcguinlu.shinyapps.io/robvis/) - Risk of bias visualization

---

**NeuroResearch Agent** - *Making systematic reviews systematic.*
