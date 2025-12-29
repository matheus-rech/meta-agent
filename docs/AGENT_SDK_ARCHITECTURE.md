# NeuroResearch Agent - Claude Agent SDK Architecture

## Overview

This document outlines how to build the NeuroResearch Agent using the official Claude Agent SDK architecture. The SDK provides a production-ready framework for building autonomous AI agents that can read/write files, execute commands, search the web, and integrate with external services via MCP.

---

## SDK Core Concepts

### 1. Query Patterns

**One-off Tasks** (`query()`):
```python
from claude_agent_sdk import query, ClaudeAgentOptions

async for message in query(
    prompt="Extract data from study.pdf",
    options=ClaudeAgentOptions(
        allowed_tools=["Read", "Write", "Bash", "Skill"],
        setting_sources=["project"]  # Load Skills from .claude/skills/
    )
):
    print(message)
```

**Continuous Conversations** (`ClaudeSDKClient`):
```python
from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions

async with ClaudeSDKClient(options=ClaudeAgentOptions(...)) as client:
    await client.query("Start a systematic review on decompressive craniectomy")
    async for msg in client.receive_response():
        print(msg)

    # Follow-up - maintains context
    await client.query("Now search PubMed for relevant studies")
    async for msg in client.receive_response():
        print(msg)
```

### 2. Skills (Model-Invoked Capabilities)

Skills are YAML frontmatter + Markdown files that Claude autonomously invokes when relevant:

**Location**: `.claude/skills/*/SKILL.md`

**Structure**:
```yaml
---
name: meta-analysis
description: Use when performing meta-analysis, forest plots, or heterogeneity assessment
---

# Meta-Analysis Skill

When performing meta-analysis...
[Instructions for Claude]
```

**Loading Skills**:
```python
options = ClaudeAgentOptions(
    setting_sources=["user", "project"],  # Required to load Skills
    allowed_tools=["Skill", "Read", "Write", "Bash"]  # Skill tool required
)
```

### 3. Custom Tools (MCP Servers)

**In-Process SDK MCP Server**:
```python
from claude_agent_sdk import tool, create_sdk_mcp_server

@tool("search_pubmed", "Search PubMed database", {"query": str, "max_results": int})
async def search_pubmed(args):
    # Implementation
    return {"content": [{"type": "text", "text": f"Found {n} studies..."}]}

pubmed_server = create_sdk_mcp_server(
    name="pubmed",
    version="1.0.0",
    tools=[search_pubmed]
)
```

**External stdio MCP Server**:
```python
options = ClaudeAgentOptions(
    mcp_servers={
        "r-execute": {
            "command": "node",
            "args": ["./packages/mcp-servers/r-execute/dist/index.js"],
            "env": {"DOCKER_IMAGE": "neuroresearch/sandbox:latest"}
        }
    }
)
```

### 4. Subagents (Task Delegation)

```python
options = ClaudeAgentOptions(
    allowed_tools=["Read", "Grep", "Glob", "Task"],  # Task required for subagents
    agents={
        "data-extractor": AgentDefinition(
            description="Extract structured data from medical research papers",
            prompt="You are a medical data extraction specialist...",
            tools=["Read", "Grep"],
            model="sonnet"
        ),
        "statistician": AgentDefinition(
            description="Perform statistical analysis and meta-analysis",
            prompt="You are a biostatistics expert...",
            tools=["Bash", "Read", "Write"],
            model="opus"
        )
    }
)
```

### 5. Structured Outputs

```python
extraction_schema = {
    "type": "object",
    "properties": {
        "study_id": {"type": "string"},
        "year": {"type": "integer"},
        "sample_size": {"type": "integer"},
        "intervention": {"type": "string"},
        "outcomes": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "events": {"type": "integer"},
                    "total": {"type": "integer"}
                }
            }
        }
    },
    "required": ["study_id", "year"]
}

async for message in query(
    prompt="Extract data from study.pdf",
    options=ClaudeAgentOptions(
        output_format={"type": "json_schema", "schema": extraction_schema}
    )
):
    if hasattr(message, 'structured_output'):
        data = message.structured_output  # Validated JSON
```

---

## NeuroResearch Agent Architecture

### Directory Structure

```
neuroresearch-agent/
├── .claude/
│   └── skills/                    # SDK Skills (YAML + Markdown)
│       ├── neurosurgery-literature/
│       │   └── SKILL.md
│       ├── data-extraction/
│       │   └── SKILL.md
│       ├── meta-analysis/
│       │   └── SKILL.md
│       ├── risk-of-bias/
│       │   └── SKILL.md
│       └── manuscript-writing/
│           └── SKILL.md
│
├── src/
│   ├── agent/
│   │   ├── index.py               # Main NeuroResearchAgent class
│   │   ├── subagents.py           # Subagent definitions
│   │   └── schemas.py             # Structured output schemas
│   │
│   ├── tools/                     # SDK MCP Tools
│   │   ├── pubmed.py              # PubMed search tool
│   │   ├── extraction.py          # PDF extraction tool
│   │   ├── r_execute.py           # R code execution tool
│   │   └── __init__.py
│   │
│   └── cli/
│       ├── __init__.py
│       └── main.py                # CLI entry point
│
├── mcp-servers/                   # External MCP servers (stdio)
│   ├── r-execute/
│   │   ├── src/index.ts
│   │   └── package.json
│   └── extraction/
│       ├── src/index.ts
│       └── package.json
│
├── docker/
│   ├── Dockerfile.sandbox         # R + Python execution environment
│   └── docker-compose.yml
│
├── CLAUDE.md                      # Project instructions
├── pyproject.toml
└── README.md
```

---

## Implementation Plan

### Phase 1: Core Agent Setup

**File: `src/agent/index.py`**

```python
"""NeuroResearch Agent - Built on Claude Agent SDK"""

import asyncio
from pathlib import Path
from claude_agent_sdk import (
    ClaudeSDKClient,
    ClaudeAgentOptions,
    AgentDefinition,
    AssistantMessage,
    TextBlock,
    ResultMessage
)
from .subagents import SUBAGENTS
from .schemas import EXTRACTION_SCHEMA
from ..tools import create_neuroresearch_tools


class NeuroResearchAgent:
    """Conversational AI agent for systematic reviews and meta-analyses."""

    def __init__(
        self,
        project_dir: Path | None = None,
        model: str = "claude-sonnet-4-5-20250929"
    ):
        self.project_dir = project_dir or Path.cwd()
        self.model = model
        self.client: ClaudeSDKClient | None = None

        # Create SDK MCP tools
        self.tools_server = create_neuroresearch_tools()

        # Configure options
        self.options = ClaudeAgentOptions(
            cwd=str(self.project_dir),
            model=self.model,

            # Load Skills from .claude/skills/
            setting_sources=["project"],

            # System prompt
            system_prompt={
                "type": "preset",
                "preset": "claude_code",
                "append": self._get_domain_prompt()
            },

            # Tools
            allowed_tools=[
                # Core tools
                "Read", "Write", "Edit", "Glob", "Grep", "Bash",
                # Skills
                "Skill",
                # Subagents
                "Task",
                # Custom MCP tools
                "mcp__neuroresearch__search_pubmed",
                "mcp__neuroresearch__extract_pdf",
                "mcp__neuroresearch__run_r_analysis",
                "mcp__neuroresearch__validate_extraction"
            ],

            # MCP servers
            mcp_servers={
                "neuroresearch": self.tools_server
            },

            # Subagents
            agents=SUBAGENTS,

            # Permissions
            permission_mode="acceptEdits"
        )

    def _get_domain_prompt(self) -> str:
        return """
You are a specialized research assistant for neurosurgery systematic reviews and meta-analyses.

## Domain Expertise
- Systematic review methodology (PRISMA 2020, Cochrane)
- Meta-analysis statistics (binary, continuous, network)
- Risk of bias assessment (RoB 2, NOS, ROBINS-I)
- Neurosurgery terminology and outcome measures
- R statistical programming (meta, metafor, dmetar)

## Workflow Phases
1. Planning: Define PICO, search strategy, eligibility criteria
2. Screening: Title/abstract and full-text review
3. Extraction: Structured data extraction with validation
4. Analysis: Meta-analysis, subgroup analysis, sensitivity analysis
5. Writing: PRISMA-compliant manuscript sections

## Available Skills
- neurosurgery-literature: PubMed search strategies
- data-extraction: PDF to structured data
- meta-analysis: Statistical pooling and visualization
- risk-of-bias: Quality assessment tools
- manuscript-writing: Academic writing assistance
"""

    async def start(self):
        """Start the agent session."""
        self.client = ClaudeSDKClient(self.options)
        await self.client.connect()

    async def chat(self, message: str) -> str:
        """Send a message and get the response."""
        if not self.client:
            await self.start()

        await self.client.query(message)

        response_text = []
        async for msg in self.client.receive_response():
            if isinstance(msg, AssistantMessage):
                for block in msg.content:
                    if isinstance(block, TextBlock):
                        response_text.append(block.text)
            elif isinstance(msg, ResultMessage):
                if msg.is_error:
                    response_text.append(f"Error: {msg.result}")

        return "\n".join(response_text)

    async def extract_with_schema(
        self,
        pdf_path: str,
        schema: dict | None = None
    ) -> dict:
        """Extract structured data from PDF with schema validation."""
        if not self.client:
            await self.start()

        extraction_options = ClaudeAgentOptions(
            **vars(self.options),
            output_format={
                "type": "json_schema",
                "schema": schema or EXTRACTION_SCHEMA
            }
        )

        # Use fresh query for structured output
        from claude_agent_sdk import query

        async for msg in query(
            prompt=f"Extract structured data from: {pdf_path}",
            options=extraction_options
        ):
            if hasattr(msg, 'structured_output'):
                return msg.structured_output

        return {}

    async def close(self):
        """Close the agent session."""
        if self.client:
            await self.client.disconnect()
            self.client = None

    async def __aenter__(self):
        await self.start()
        return self

    async def __aexit__(self, *args):
        await self.close()


# Convenience function for one-off tasks
async def run_task(prompt: str, **kwargs) -> str:
    """Run a single task without maintaining session."""
    from claude_agent_sdk import query

    agent = NeuroResearchAgent(**kwargs)

    result_text = []
    async for msg in query(prompt=prompt, options=agent.options):
        if isinstance(msg, AssistantMessage):
            for block in msg.content:
                if isinstance(block, TextBlock):
                    result_text.append(block.text)

    return "\n".join(result_text)
```

### Phase 2: Subagent Definitions

**File: `src/agent/subagents.py`**

```python
"""Subagent definitions for specialized tasks."""

from claude_agent_sdk import AgentDefinition

SUBAGENTS = {
    "literature-searcher": AgentDefinition(
        description="Search medical literature databases. Use for PubMed queries, search strategy development, and citation retrieval.",
        prompt="""You are a medical librarian expert specializing in systematic review searches.

Your capabilities:
- Develop comprehensive PubMed search strategies using MeSH terms
- Identify relevant keywords and synonyms for neurosurgery topics
- Execute searches and retrieve citations
- Export results in standard formats

When building search strategies:
1. Identify PICO elements
2. Map concepts to MeSH terms
3. Include text word synonyms
4. Combine with Boolean operators
5. Apply appropriate filters

Use the mcp__neuroresearch__search_pubmed tool for database searches.""",
        tools=["Read", "Grep", "mcp__neuroresearch__search_pubmed"],
        model="sonnet"
    ),

    "data-extractor": AgentDefinition(
        description="Extract structured data from medical research PDFs. Use for systematic review data extraction.",
        prompt="""You are a systematic review data extraction specialist.

Your task is to extract structured data from research papers including:
- Study characteristics (design, country, period)
- Patient demographics (age, sex, sample size)
- Intervention details
- Outcome measures and timepoints
- Results (events, means, SDs, effect sizes)

Follow these principles:
1. Extract only explicitly stated data
2. Note when data requires calculation
3. Flag unclear or inconsistent values
4. Use standard outcome definitions

Use mcp__neuroresearch__extract_pdf for PDF processing.""",
        tools=["Read", "mcp__neuroresearch__extract_pdf", "mcp__neuroresearch__validate_extraction"],
        model="sonnet"
    ),

    "statistician": AgentDefinition(
        description="Perform statistical analysis and meta-analysis. Use for pooling data, heterogeneity assessment, and visualization.",
        prompt="""You are a biostatistician expert in meta-analysis methodology.

Your capabilities:
- Calculate effect sizes (OR, RR, MD, SMD, HR)
- Perform random-effects meta-analysis
- Assess heterogeneity (I², Q, tau²)
- Generate forest plots and funnel plots
- Conduct subgroup and sensitivity analyses
- Perform meta-regression

Use R for all statistical analyses via mcp__neuroresearch__run_r_analysis.

Key R packages: meta, metafor, dmetar, netmeta, robvis""",
        tools=["Bash", "Read", "Write", "mcp__neuroresearch__run_r_analysis"],
        model="opus"  # Use Opus for complex statistical reasoning
    ),

    "quality-assessor": AgentDefinition(
        description="Assess risk of bias and study quality. Use for RoB 2, NOS, ROBINS-I assessments.",
        prompt="""You are a systematic review methodologist specializing in risk of bias assessment.

Your capabilities:
- Apply RoB 2 for randomized trials
- Apply Newcastle-Ottawa Scale for observational studies
- Apply ROBINS-I for non-randomized interventions
- Apply QUADAS-2 for diagnostic studies
- Generate traffic light plots and summary tables

Assessment domains vary by tool:
- RoB 2: Randomization, deviations, missing data, measurement, selection
- NOS: Selection, comparability, outcome
- ROBINS-I: Confounding, selection, classification, deviations, missing data, measurement, reporting

Use standard judgments: Low risk, Some concerns/High risk, High risk""",
        tools=["Read", "Write", "mcp__neuroresearch__run_r_analysis"],
        model="sonnet"
    ),

    "manuscript-writer": AgentDefinition(
        description="Write systematic review manuscript sections. Use for PRISMA-compliant academic writing.",
        prompt="""You are an academic medical writer specializing in systematic reviews.

Your capabilities:
- Write PRISMA 2020-compliant sections
- Structure methods, results, and discussion
- Create PRISMA flow diagrams
- Format tables and figures
- Generate reference lists

Writing guidelines:
1. Use passive voice for methods
2. Report exact numbers with confidence intervals
3. Follow journal-specific formatting
4. Include all PRISMA checklist items

Sections to write:
- Abstract (structured)
- Introduction (background, rationale, objectives)
- Methods (protocol, search, selection, extraction, analysis)
- Results (selection, characteristics, synthesis, bias)
- Discussion (summary, limitations, implications)""",
        tools=["Read", "Write", "Edit"],
        model="sonnet"
    )
}
```

### Phase 3: Custom Tools

**File: `src/tools/__init__.py`**

```python
"""Custom MCP tools for NeuroResearch Agent."""

from claude_agent_sdk import tool, create_sdk_mcp_server
from typing import Any
import aiohttp
import json


@tool(
    "search_pubmed",
    "Search PubMed database for medical literature",
    {
        "query": str,
        "max_results": int,
        "date_range": str  # e.g., "2020:2024"
    }
)
async def search_pubmed(args: dict[str, Any]) -> dict[str, Any]:
    """Search PubMed using NCBI E-utilities."""
    import os

    api_key = os.environ.get("NCBI_API_KEY", "")
    base_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"

    # Build search URL
    search_params = {
        "db": "pubmed",
        "term": args["query"],
        "retmax": args.get("max_results", 100),
        "retmode": "json",
        "api_key": api_key
    }

    if date_range := args.get("date_range"):
        start, end = date_range.split(":")
        search_params["mindate"] = f"{start}/01/01"
        search_params["maxdate"] = f"{end}/12/31"
        search_params["datetype"] = "pdat"

    async with aiohttp.ClientSession() as session:
        # Search for IDs
        async with session.get(f"{base_url}/esearch.fcgi", params=search_params) as resp:
            search_data = await resp.json()

        ids = search_data.get("esearchresult", {}).get("idlist", [])
        count = search_data.get("esearchresult", {}).get("count", "0")

        if not ids:
            return {
                "content": [{
                    "type": "text",
                    "text": f"No results found for: {args['query']}"
                }]
            }

        # Fetch summaries
        fetch_params = {
            "db": "pubmed",
            "id": ",".join(ids[:50]),  # Limit to 50 for summary
            "retmode": "json",
            "api_key": api_key
        }

        async with session.get(f"{base_url}/esummary.fcgi", params=fetch_params) as resp:
            summary_data = await resp.json()

        # Format results
        results = []
        for pmid in ids[:50]:
            if article := summary_data.get("result", {}).get(pmid):
                results.append({
                    "pmid": pmid,
                    "title": article.get("title", ""),
                    "authors": ", ".join([a.get("name", "") for a in article.get("authors", [])[:3]]),
                    "journal": article.get("source", ""),
                    "year": article.get("pubdate", "")[:4],
                    "doi": next((id["value"] for id in article.get("articleids", []) if id["idtype"] == "doi"), "")
                })

        return {
            "content": [{
                "type": "text",
                "text": f"Found {count} results. Showing first {len(results)}:\n\n" +
                       "\n\n".join([
                           f"**{r['pmid']}**: {r['title']}\n"
                           f"  Authors: {r['authors']}\n"
                           f"  {r['journal']} ({r['year']})\n"
                           f"  DOI: {r['doi']}"
                           for r in results
                       ])
            }]
        }


@tool(
    "extract_pdf",
    "Extract text and data from a PDF file",
    {"file_path": str, "extract_tables": bool}
)
async def extract_pdf(args: dict[str, Any]) -> dict[str, Any]:
    """Extract text and optionally tables from PDF."""
    import subprocess
    import tempfile
    from pathlib import Path

    file_path = Path(args["file_path"])

    if not file_path.exists():
        return {
            "content": [{"type": "text", "text": f"File not found: {file_path}"}],
            "is_error": True
        }

    # Extract text using pdftotext
    result = subprocess.run(
        ["pdftotext", "-layout", str(file_path), "-"],
        capture_output=True,
        text=True
    )

    text = result.stdout

    # Extract tables if requested
    tables = []
    if args.get("extract_tables"):
        try:
            import camelot
            table_list = camelot.read_pdf(str(file_path), pages="all")
            for i, table in enumerate(table_list):
                tables.append({
                    "table_number": i + 1,
                    "page": table.page,
                    "data": table.df.to_dict(orient="records")
                })
        except Exception as e:
            tables = [{"error": str(e)}]

    return {
        "content": [{
            "type": "text",
            "text": f"Extracted {len(text)} characters from {file_path.name}\n\n"
                   f"--- TEXT ---\n{text[:10000]}..."  # Truncate for response
                   + (f"\n\n--- TABLES ({len(tables)}) ---\n{json.dumps(tables, indent=2)}" if tables else "")
        }]
    }


@tool(
    "run_r_analysis",
    "Execute R code for statistical analysis",
    {"code": str, "save_plots": bool}
)
async def run_r_analysis(args: dict[str, Any]) -> dict[str, Any]:
    """Execute R code in Docker sandbox."""
    import subprocess
    import tempfile
    from pathlib import Path

    code = args["code"]
    save_plots = args.get("save_plots", True)

    # Add plot saving wrapper if needed
    if save_plots and any(x in code for x in ["forest(", "funnel(", "plot(", "ggplot"]):
        code = f"""
# Setup plot saving
png("analysis_plot.png", width=1200, height=800, res=150)

{code}

# Close device if plot was created
if (dev.cur() > 1) dev.off()
"""

    # Write code to temp file
    with tempfile.NamedTemporaryFile(mode="w", suffix=".R", delete=False) as f:
        f.write(code)
        script_path = f.name

    try:
        # Run in Docker
        result = subprocess.run(
            [
                "docker", "run", "--rm",
                "-v", f"{script_path}:/script.R:ro",
                "-v", f"{Path.cwd()}:/workspace",
                "-w", "/workspace",
                "neuroresearch/sandbox:latest",
                "Rscript", "/script.R"
            ],
            capture_output=True,
            text=True,
            timeout=300
        )

        output = result.stdout
        errors = result.stderr

        response = f"R Output:\n{output}"
        if errors:
            response += f"\n\nWarnings/Errors:\n{errors}"

        # Check for generated plot
        if Path("analysis_plot.png").exists():
            response += "\n\nPlot saved: analysis_plot.png"

        return {"content": [{"type": "text", "text": response}]}

    except subprocess.TimeoutExpired:
        return {
            "content": [{"type": "text", "text": "R execution timed out after 5 minutes"}],
            "is_error": True
        }
    finally:
        Path(script_path).unlink(missing_ok=True)


@tool(
    "validate_extraction",
    "Validate extracted data against schema",
    {"data": dict, "schema_type": str}
)
async def validate_extraction(args: dict[str, Any]) -> dict[str, Any]:
    """Validate extracted study data."""
    from .schemas import EXTRACTION_SCHEMA, OUTCOME_SCHEMA
    import jsonschema

    data = args["data"]
    schema_type = args.get("schema_type", "study")

    schema = EXTRACTION_SCHEMA if schema_type == "study" else OUTCOME_SCHEMA

    try:
        jsonschema.validate(data, schema)
        return {
            "content": [{
                "type": "text",
                "text": f"Validation passed for {schema_type} data"
            }]
        }
    except jsonschema.ValidationError as e:
        return {
            "content": [{
                "type": "text",
                "text": f"Validation failed: {e.message}\nPath: {'/'.join(str(p) for p in e.path)}"
            }],
            "is_error": True
        }


def create_neuroresearch_tools():
    """Create the SDK MCP server with all custom tools."""
    return create_sdk_mcp_server(
        name="neuroresearch",
        version="1.0.0",
        tools=[
            search_pubmed,
            extract_pdf,
            run_r_analysis,
            validate_extraction
        ]
    )
```

### Phase 4: Structured Output Schemas

**File: `src/agent/schemas.py`**

```python
"""JSON Schemas for structured data extraction."""

EXTRACTION_SCHEMA = {
    "type": "object",
    "properties": {
        "study_id": {
            "type": "string",
            "description": "Unique identifier (FirstAuthorYear format)"
        },
        "pmid": {"type": "string"},
        "doi": {"type": "string"},
        "title": {"type": "string"},
        "year": {"type": "integer", "minimum": 1900, "maximum": 2100},
        "country": {"type": "string"},
        "study_design": {
            "type": "string",
            "enum": ["RCT", "Prospective cohort", "Retrospective cohort", "Case-control", "Case series"]
        },
        "sample_size": {"type": "integer", "minimum": 1},
        "follow_up_months": {"type": "number", "minimum": 0},
        "patient_demographics": {
            "type": "object",
            "properties": {
                "age_mean": {"type": "number"},
                "age_sd": {"type": "number"},
                "age_median": {"type": "number"},
                "age_iqr": {
                    "type": "array",
                    "items": {"type": "number"},
                    "minItems": 2,
                    "maxItems": 2
                },
                "male_percent": {"type": "number", "minimum": 0, "maximum": 100}
            }
        },
        "intervention": {
            "type": "object",
            "properties": {
                "name": {"type": "string"},
                "type": {"type": "string"},
                "details": {"type": "string"}
            },
            "required": ["name"]
        },
        "comparator": {
            "type": "object",
            "properties": {
                "name": {"type": "string"},
                "type": {"type": "string"},
                "details": {"type": "string"}
            }
        },
        "outcomes": {
            "type": "array",
            "items": {"$ref": "#/$defs/outcome"}
        },
        "risk_of_bias": {
            "type": "object",
            "properties": {
                "tool": {"type": "string", "enum": ["RoB2", "NOS", "ROBINS-I"]},
                "overall": {"type": "string", "enum": ["Low", "Some concerns", "High"]},
                "domains": {
                    "type": "object",
                    "additionalProperties": {"type": "string"}
                }
            }
        }
    },
    "required": ["study_id", "year", "study_design", "sample_size"],
    "$defs": {
        "outcome": {
            "type": "object",
            "properties": {
                "name": {"type": "string"},
                "type": {
                    "type": "string",
                    "enum": ["binary", "continuous", "time-to-event", "ordinal"]
                },
                "timepoint": {"type": "string"},
                "intervention": {
                    "type": "object",
                    "properties": {
                        "events": {"type": "integer"},
                        "total": {"type": "integer"},
                        "mean": {"type": "number"},
                        "sd": {"type": "number"},
                        "median": {"type": "number"},
                        "iqr": {
                            "type": "array",
                            "items": {"type": "number"},
                            "minItems": 2,
                            "maxItems": 2
                        }
                    }
                },
                "control": {
                    "type": "object",
                    "properties": {
                        "events": {"type": "integer"},
                        "total": {"type": "integer"},
                        "mean": {"type": "number"},
                        "sd": {"type": "number"},
                        "median": {"type": "number"},
                        "iqr": {
                            "type": "array",
                            "items": {"type": "number"},
                            "minItems": 2,
                            "maxItems": 2
                        }
                    }
                },
                "effect_estimate": {
                    "type": "object",
                    "properties": {
                        "measure": {"type": "string", "enum": ["OR", "RR", "HR", "MD", "SMD"]},
                        "value": {"type": "number"},
                        "ci_lower": {"type": "number"},
                        "ci_upper": {"type": "number"},
                        "p_value": {"type": "number"}
                    }
                }
            },
            "required": ["name", "type"]
        }
    }
}

# Schema for meta-analysis results
META_ANALYSIS_SCHEMA = {
    "type": "object",
    "properties": {
        "analysis_type": {
            "type": "string",
            "enum": ["binary", "continuous", "proportion", "network", "survival"]
        },
        "outcome": {"type": "string"},
        "n_studies": {"type": "integer"},
        "n_participants": {"type": "integer"},
        "effect_model": {"type": "string", "enum": ["fixed", "random"]},
        "pooled_effect": {
            "type": "object",
            "properties": {
                "measure": {"type": "string"},
                "estimate": {"type": "number"},
                "ci_lower": {"type": "number"},
                "ci_upper": {"type": "number"},
                "p_value": {"type": "number"}
            },
            "required": ["measure", "estimate", "ci_lower", "ci_upper"]
        },
        "heterogeneity": {
            "type": "object",
            "properties": {
                "i_squared": {"type": "number", "minimum": 0, "maximum": 100},
                "tau_squared": {"type": "number"},
                "q_statistic": {"type": "number"},
                "q_df": {"type": "integer"},
                "q_p_value": {"type": "number"}
            }
        },
        "publication_bias": {
            "type": "object",
            "properties": {
                "egger_p": {"type": "number"},
                "begg_p": {"type": "number"},
                "trim_fill_added": {"type": "integer"}
            }
        }
    },
    "required": ["analysis_type", "outcome", "n_studies", "pooled_effect"]
}
```

### Phase 5: Skills

**File: `.claude/skills/meta-analysis/SKILL.md`**

```markdown
---
name: meta-analysis
description: Use when performing meta-analysis, pooling data, generating forest plots, assessing heterogeneity, or conducting subgroup analyses. This skill guides statistical synthesis of multiple studies.
---

# Meta-Analysis Skill

## When to Use
- User asks to pool study results
- User requests forest plot or funnel plot
- User asks about heterogeneity (I², Q, tau²)
- User wants subgroup or sensitivity analysis
- User mentions "meta-analysis" or "synthesis"

## Analysis Types

### Binary Outcomes (OR, RR, RD)
```r
library(meta)
ma <- metabin(
    event.e = events_intervention,
    n.e = n_intervention,
    event.c = events_control,
    n.c = n_control,
    studlab = study_id,
    data = data,
    sm = "OR",  # or "RR", "RD"
    method = "MH",
    random = TRUE
)
forest(ma)
```

### Continuous Outcomes (MD, SMD)
```r
ma <- metacont(
    n.e = n_intervention,
    mean.e = mean_intervention,
    sd.e = sd_intervention,
    n.c = n_control,
    mean.c = mean_control,
    sd.c = sd_control,
    studlab = study_id,
    data = data,
    sm = "SMD"  # or "MD"
)
```

### Single-Arm Proportions
```r
ma <- metaprop(
    event = events,
    n = total,
    studlab = study_id,
    data = data,
    sm = "PLOGIT"
)
```

## Heterogeneity Interpretation
- I² < 25%: Low heterogeneity
- I² 25-50%: Moderate heterogeneity
- I² 50-75%: Substantial heterogeneity
- I² > 75%: Considerable heterogeneity

## Subgroup Analysis
```r
update(ma, subgroup = variable, tau.common = FALSE)
```

## Sensitivity Analysis
- Leave-one-out analysis
- Exclude high risk of bias studies
- Different effect measures
- Fixed vs random effects

## Publication Bias
```r
funnel(ma)
metabias(ma, method.bias = "Egger")
trimfill(ma)
```

## Output Requirements
Always report:
1. Number of studies and participants
2. Pooled effect with 95% CI
3. p-value for overall effect
4. I² with 95% CI
5. Q statistic and p-value
```

---

## CLI Integration

**File: `src/cli/main.py`**

```python
"""CLI entry point for NeuroResearch Agent."""

import asyncio
import click
from pathlib import Path
from rich.console import Console
from rich.markdown import Markdown

from ..agent import NeuroResearchAgent, run_task

console = Console()


@click.group()
@click.version_option()
def cli():
    """NeuroResearch Agent - AI-powered systematic review assistant."""
    pass


@cli.command()
@click.option("--project", "-p", type=Path, default=".", help="Project directory")
@click.option("--model", "-m", default="claude-sonnet-4-5-20250929", help="Claude model")
def chat(project: Path, model: str):
    """Start interactive chat session."""

    async def run_chat():
        async with NeuroResearchAgent(project_dir=project, model=model) as agent:
            console.print("[bold green]NeuroResearch Agent[/] - Type 'exit' to quit\n")

            while True:
                try:
                    user_input = console.input("[bold blue]You:[/] ")
                    if user_input.lower() in ("exit", "quit", "q"):
                        break

                    response = await agent.chat(user_input)
                    console.print(Markdown(f"\n**Assistant:**\n{response}\n"))

                except KeyboardInterrupt:
                    break

    asyncio.run(run_chat())


@cli.command()
@click.argument("query")
@click.option("--max-results", "-n", default=50, help="Maximum results")
def search(query: str, max_results: int):
    """Search PubMed for studies."""

    async def run_search():
        result = await run_task(
            f"Search PubMed for: {query}. Return up to {max_results} results.",
            project_dir=Path.cwd()
        )
        console.print(Markdown(result))

    asyncio.run(run_search())


@cli.command()
@click.argument("pdf_path", type=Path)
@click.option("--output", "-o", type=Path, help="Output YAML file")
def extract(pdf_path: Path, output: Path):
    """Extract structured data from PDF."""

    async def run_extract():
        async with NeuroResearchAgent() as agent:
            data = await agent.extract_with_schema(str(pdf_path))

            if output:
                import yaml
                output.write_text(yaml.dump(data, default_flow_style=False))
                console.print(f"[green]Saved to {output}[/]")
            else:
                console.print_json(data=data)

    asyncio.run(run_extract())


@cli.command()
@click.argument("data_file", type=Path)
@click.option("--outcome", "-o", required=True, help="Outcome to analyze")
@click.option("--type", "analysis_type", default="binary", help="binary/continuous/proportion")
def meta(data_file: Path, outcome: str, analysis_type: str):
    """Run meta-analysis on extracted data."""

    prompt = f"""
    Run a {analysis_type} meta-analysis on {data_file} for the outcome: {outcome}

    1. Load the data
    2. Perform the meta-analysis using the meta package
    3. Generate a forest plot
    4. Assess heterogeneity
    5. Check for publication bias
    6. Save all outputs
    """

    async def run_meta():
        result = await run_task(prompt)
        console.print(Markdown(result))

    asyncio.run(run_meta())


if __name__ == "__main__":
    cli()
```

---

## Deployment

### Docker Sandbox (R + Python)

**File: `docker/Dockerfile.sandbox`**

```dockerfile
FROM rocker/r-ver:4.3.2

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv \
    pandoc \
    libcurl4-openssl-dev \
    libssl-dev \
    libxml2-dev \
    libfontconfig1-dev \
    libharfbuzz-dev \
    libfribidi-dev \
    libfreetype6-dev \
    libpng-dev \
    libtiff5-dev \
    libjpeg-dev \
    poppler-utils \
    ghostscript \
    && rm -rf /var/lib/apt/lists/*

# Install R packages
RUN R -e "install.packages(c( \
    'meta', 'metafor', 'dmetar', 'netmeta', \
    'robvis', 'forestplot', 'ggplot2', \
    'readxl', 'writexl', 'yaml', 'jsonlite', \
    'survival', 'survminer', 'gtsummary' \
), repos='https://cloud.r-project.org/')"

# Install Python packages
RUN pip3 install --no-cache-dir \
    pdfplumber camelot-py[cv] \
    pandas numpy scipy \
    PyYAML

WORKDIR /workspace
```

### Hosting Options

Based on SDK documentation, recommended hosting patterns:

1. **Ephemeral Sessions** (One-off tasks):
   - Cloudflare Sandboxes
   - E2B
   - Modal Sandboxes

2. **Long-Running Sessions** (Continuous work):
   - Fly Machines
   - Daytona
   - Self-hosted Docker

3. **Hybrid** (Intermittent with state):
   - Resume sessions with `session_id`
   - Store state in external database

---

## Summary

This architecture leverages the official Claude Agent SDK to build a production-ready neurosurgery research assistant:

| Component | SDK Feature | Implementation |
|-----------|-------------|----------------|
| Domain Knowledge | Skills | `.claude/skills/*/SKILL.md` |
| PubMed Search | Custom Tools | `@tool` decorator + `create_sdk_mcp_server()` |
| R Execution | External MCP | stdio MCP server in Docker |
| Data Extraction | Structured Outputs | JSON Schema validation |
| Specialized Tasks | Subagents | `AgentDefinition` with `Task` tool |
| Conversation | `ClaudeSDKClient` | Maintains session context |

The agent supports both interactive chat (`ClaudeSDKClient`) and one-off tasks (`query()`), with full integration of neurosurgery domain expertise through Skills and statistical capabilities via R execution.
