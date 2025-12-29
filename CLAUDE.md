# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

**Meta** is an AI-powered research partner for systematic reviews and meta-analyses, built on the Claude Agent SDK. It provides domain-specific expertise for neurosurgery/medical research with native R execution, PubMed integration, and PRISMA-compliant outputs.

## Quick Start

```bash
# Install (Python 3.11+)
pip install -e .

# Configure
meta config --api-key YOUR_KEY

# Create project
meta init "My Systematic Review"

# Start interactive session
meta
```

## Architecture

```
src/
├── agent/
│   ├── index.py          # NeuroResearchAgent - main SDK client
│   ├── subagents.py      # 5 specialist AgentDefinitions
│   └── schemas.py        # JSON schemas for structured outputs
├── tools/
│   └── __init__.py       # 4 MCP tools (@tool decorator)
└── cli/
    ├── main.py           # Click CLI entry point
    ├── banner.py         # ASCII art, formatted output
    ├── config.py         # Configuration management
    ├── project.py        # Project scaffolding
    ├── state.py          # State persistence
    └── repl.py           # Interactive REPL

.claude/skills/           # Auto-loaded domain skills
├── meta-analysis/
├── data-extraction/
├── neurosurgery-literature/
├── risk-of-bias/
└── manuscript-writing/
```

## CLI Commands

```bash
meta                      # Interactive REPL with banner
meta init "Title"         # Create project structure
meta config               # Configure API key, user info
meta status               # Show project progress
meta search "query"       # Search PubMed
meta extract paper.pdf    # Extract data from PDF
meta analyze data.csv -o mortality  # Run meta-analysis
meta plot data.csv --type forest    # Generate plots
meta write -s methods     # Draft manuscript sections
```

## Key Components

### Agent (Claude SDK)
```python
from neuroresearch.agent import NeuroResearchAgent

async with NeuroResearchAgent() as agent:
    response = await agent.chat("Search for RCTs on DBS")
```

### Configuration
- Global: `~/.meta/config.yaml`
- Project: `.meta/config.yaml`
- Environment: `META_API_KEY`, `NCBI_API_KEY`

### Skills (Auto-loaded)
Skills in `.claude/skills/*/SKILL.md` are automatically loaded via `setting_sources=["project"]`. Each skill has YAML frontmatter with `name` and `description` that triggers auto-invocation.

### Custom Tools
Four MCP tools defined with `@tool` decorator:
- `search_pubmed` - PubMed E-utilities API
- `extract_pdf` - PDF text/table extraction
- `run_r_analysis` - R execution in native sandbox
- `validate_extraction` - JSON schema validation

### Subagents
Five specialists invoked via Task tool:
- `literature-searcher` - PubMed queries, MeSH terms
- `data-extractor` - PDF to structured data
- `statistician` - R-based meta-analysis (Opus model)
- `quality-assessor` - RoB 2, NOS, ROBINS-I
- `manuscript-writer` - PRISMA 2020 sections

### Native Sandbox (No Docker)
R code executes in OS-native sandbox:
- **macOS**: `sandbox-exec` with Seatbelt profile
- **Linux**: `firejail` or `bubblewrap`
- **Fallback**: `resource` limits (CPU, memory, files)

## Project Structure (after `meta init`)

```
project/
├── .meta/
│   ├── config.yaml       # Project settings
│   ├── state.json        # Progress tracking
│   └── memory.json       # Conversation history
├── protocol/
│   └── protocol.md       # PROSPERO template
├── searches/
├── screening/
├── extractions/
│   └── template.yaml     # Extraction schema
├── quality/
├── analysis/
├── figures/
├── tables/
├── manuscript/
└── README.md
```

## Development

```bash
# Install in development mode
pip install -e ".[dev]"

# Run tests
pytest

# Type checking
mypy src/

# Format
black src/
ruff check src/
```

## Dependencies

- `claude-agent-sdk>=1.0.0` - Core SDK
- `click>=8.0.0` - CLI framework
- `rich>=13.0.0` - Terminal formatting
- `pdfplumber>=0.10.0` - PDF extraction
- `aiohttp>=3.9.0` - Async HTTP
- `pyyaml>=6.0.0` - Configuration
- `jsonschema>=4.0.0` - Validation

## R Requirements

Install R and required packages:
```bash
# macOS
brew install r

# R packages (one-time)
Rscript -e "install.packages(c('meta', 'metafor', 'dmetar', 'robvis', 'forestplot'))"
```

## Key Patterns

### Streaming Chat
```python
async for chunk in agent.stream_chat(message):
    print(chunk, end="", flush=True)
```

### Structured Extraction
```python
data = await agent.extract_with_schema(pdf_path, schema=EXTRACTION_SCHEMA)
```

### Meta-Analysis
```python
results = await agent.run_meta_analysis(data_path, outcome="mortality")
```

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `META_API_KEY` | Anthropic API key |
| `ANTHROPIC_API_KEY` | Alternative API key |
| `NCBI_API_KEY` | PubMed API key (optional, increases rate limit) |

## Workflow Phases

1. **Protocol** - Define PICO, eligibility, search strategy
2. **Search** - Execute PubMed queries
3. **Screening** - Title/abstract, full-text review
4. **Extraction** - Structured data from PDFs
5. **Quality** - Risk of bias assessment
6. **Analysis** - Meta-analysis, plots
7. **Writing** - PRISMA-compliant manuscript
