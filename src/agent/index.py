"""NeuroResearch Agent - Main agent class built on Claude Agent SDK."""

import asyncio
from pathlib import Path
from typing import Any, AsyncIterator

from claude_agent_sdk import (
    ClaudeSDKClient,
    ClaudeAgentOptions,
    query,
    AssistantMessage,
    TextBlock,
    ToolUseBlock,
    ResultMessage,
)

from .subagents import SUBAGENTS
from .schemas import EXTRACTION_SCHEMA, META_ANALYSIS_SCHEMA
from ..tools import create_neuroresearch_tools


class NeuroResearchAgent:
    """
    AI-powered agent for systematic reviews and meta-analyses in neurosurgery.

    Built on the Claude Agent SDK, this agent provides:
    - PubMed literature searching with MeSH optimization
    - Structured data extraction from PDFs
    - R-based meta-analysis in native sandbox (no Docker required)
    - Risk of bias assessment
    - PRISMA-compliant manuscript drafting

    Sandboxing:
    - macOS: Uses sandbox-exec (built-in, zero overhead)
    - Linux: Uses firejail/bubblewrap if available, else resource limits
    - Windows: Uses resource limits

    Usage:
        async with NeuroResearchAgent() as agent:
            response = await agent.chat("Search for RCTs on decompressive craniectomy")
            print(response)
    """

    def __init__(
        self,
        project_dir: Path | str | None = None,
        model: str = "claude-sonnet-4-5-20250929",
    ):
        """
        Initialize the NeuroResearch Agent.

        Args:
            project_dir: Working directory for the project. Defaults to current directory.
            model: Claude model to use. Defaults to claude-sonnet-4-5-20250929.
        """
        self.project_dir = Path(project_dir) if project_dir else Path.cwd()
        self.model = model
        self.client: ClaudeSDKClient | None = None

        # Create SDK MCP server with custom tools
        self.tools_server = create_neuroresearch_tools()

        # Build configuration
        self.options = self._build_options()

    def _build_options(self) -> ClaudeAgentOptions:
        """Build ClaudeAgentOptions with all configurations."""
        return ClaudeAgentOptions(
            # Working directory
            cwd=str(self.project_dir),

            # Model selection
            model=self.model,

            # Load Skills from .claude/skills/
            setting_sources=["project"],

            # System prompt with domain expertise
            system_prompt={
                "type": "preset",
                "preset": "claude_code",
                "append": self._get_domain_prompt()
            },

            # Available tools
            allowed_tools=[
                # Core file operations
                "Read", "Write", "Edit", "Glob", "Grep",
                # Shell execution
                "Bash",
                # Skills (loaded from .claude/skills/)
                "Skill",
                # Subagent delegation
                "Task",
                # Custom MCP tools
                "mcp__neuroresearch__search_pubmed",
                "mcp__neuroresearch__extract_pdf",
                "mcp__neuroresearch__run_r_analysis",
                "mcp__neuroresearch__validate_extraction",
            ],

            # MCP servers
            mcp_servers={
                "neuroresearch": self.tools_server
            },

            # Subagents for specialized tasks
            agents=SUBAGENTS,

            # Permission mode - auto-accept file edits
            permission_mode="acceptEdits",

            # Sandbox configuration for R execution
            sandbox={
                "enabled": True,
                "autoAllowBashIfSandboxed": True,
            },
        )

    def _get_domain_prompt(self) -> str:
        """Get the domain-specific system prompt addition."""
        return """
## NeuroResearch Agent

You are a specialized AI research assistant for neurosurgery systematic reviews and meta-analyses.

### Domain Expertise
- **Systematic review methodology**: PRISMA 2020, Cochrane Handbook
- **Meta-analysis statistics**: Binary (OR, RR), continuous (MD, SMD), proportions, network, survival (HR)
- **Risk of bias assessment**: RoB 2, Newcastle-Ottawa Scale, ROBINS-I, QUADAS-2
- **Neurosurgery subspecialties**: Neuro-oncology, vascular, spine, trauma, functional
- **R programming**: meta, metafor, dmetar, netmeta, robvis, forestplot

### Workflow Phases
1. **Planning**: Define PICO, eligibility criteria, search strategy
2. **Searching**: PubMed queries, citation management
3. **Screening**: Title/abstract review, full-text assessment
4. **Extraction**: Structured data extraction with schema validation
5. **Analysis**: Meta-analysis, subgroup analysis, publication bias
6. **Writing**: PRISMA-compliant manuscript sections

### Available Subagents
- **literature-searcher**: PubMed search strategy development
- **data-extractor**: PDF to structured data extraction
- **statistician**: R-based meta-analysis and visualization
- **quality-assessor**: Risk of bias evaluation
- **manuscript-writer**: Academic writing assistance

### Key Outcome Scales in Neurosurgery
- **mRS (modified Rankin Scale)**: 0-6, functional disability
- **GOS (Glasgow Outcome Scale)**: 1-5, overall outcome
- **GCS (Glasgow Coma Scale)**: 3-15, consciousness level
- **NIHSS (NIH Stroke Scale)**: 0-42, stroke severity
- **Karnofsky Performance Status**: 0-100, functional status

### Output Requirements
- Always cite sources with PMID or DOI
- Report statistics with 95% confidence intervals
- Use GRADE for certainty of evidence
- Follow PRISMA 2020 for reporting
"""

    async def start(self) -> None:
        """Start the agent session."""
        self.client = ClaudeSDKClient(self.options)
        await self.client.connect()

    async def chat(self, message: str) -> str:
        """
        Send a message and get the response.

        Args:
            message: User's message/request

        Returns:
            Claude's response as a string
        """
        if not self.client:
            await self.start()

        assert self.client is not None

        await self.client.query(message)

        response_parts: list[str] = []

        async for msg in self.client.receive_response():
            if isinstance(msg, AssistantMessage):
                for block in msg.content:
                    if isinstance(block, TextBlock):
                        response_parts.append(block.text)
                    elif isinstance(block, ToolUseBlock):
                        # Log tool usage for visibility
                        response_parts.append(f"\n[Using tool: {block.name}]\n")

            elif isinstance(msg, ResultMessage):
                if msg.is_error:
                    response_parts.append(f"\n[Error: {msg.result}]\n")

        return "".join(response_parts)

    async def stream_chat(self, message: str) -> AsyncIterator[str]:
        """
        Send a message and stream the response.

        Args:
            message: User's message/request

        Yields:
            Response chunks as they arrive
        """
        if not self.client:
            await self.start()

        assert self.client is not None

        await self.client.query(message)

        async for msg in self.client.receive_response():
            if isinstance(msg, AssistantMessage):
                for block in msg.content:
                    if isinstance(block, TextBlock):
                        yield block.text

    async def extract_with_schema(
        self,
        pdf_path: str | Path,
        schema: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        """
        Extract structured data from PDF with schema validation.

        Args:
            pdf_path: Path to the PDF file
            schema: JSON schema for validation. Defaults to EXTRACTION_SCHEMA.

        Returns:
            Validated extraction data as dictionary
        """
        extraction_options = ClaudeAgentOptions(
            cwd=str(self.project_dir),
            model=self.model,
            setting_sources=["project"],
            mcp_servers={"neuroresearch": self.tools_server},
            allowed_tools=[
                "Read",
                "mcp__neuroresearch__extract_pdf",
                "mcp__neuroresearch__validate_extraction"
            ],
            output_format={
                "type": "json_schema",
                "schema": schema or EXTRACTION_SCHEMA
            },
            permission_mode="acceptEdits"
        )

        async for msg in query(
            prompt=f"Extract structured study data from: {pdf_path}",
            options=extraction_options
        ):
            if hasattr(msg, "structured_output") and msg.structured_output:
                return msg.structured_output

        return {}

    async def run_meta_analysis(
        self,
        data_path: str | Path,
        outcome: str,
        analysis_type: str = "binary"
    ) -> dict[str, Any]:
        """
        Run a meta-analysis and return structured results.

        Args:
            data_path: Path to the CSV/Excel data file
            outcome: Name of the outcome to analyze
            analysis_type: Type of analysis (binary, continuous, proportion)

        Returns:
            Meta-analysis results as dictionary
        """
        meta_options = ClaudeAgentOptions(
            cwd=str(self.project_dir),
            model="claude-opus-4-5-20250929",  # Use Opus for statistical analysis
            setting_sources=["project"],
            mcp_servers={"neuroresearch": self.tools_server},
            allowed_tools=[
                "Read", "Write",
                "mcp__neuroresearch__run_r_analysis"
            ],
            agents={"statistician": SUBAGENTS["statistician"]},
            output_format={
                "type": "json_schema",
                "schema": META_ANALYSIS_SCHEMA
            },
            permission_mode="acceptEdits"
        )

        prompt = f"""
        Perform a {analysis_type} meta-analysis on the data in {data_path}
        for the outcome: {outcome}

        Steps:
        1. Load and validate the data
        2. Perform random-effects meta-analysis
        3. Generate forest plot and funnel plot
        4. Assess heterogeneity (I², Q, tau²)
        5. Test for publication bias (Egger's test)
        6. Return structured results
        """

        async for msg in query(prompt=prompt, options=meta_options):
            if hasattr(msg, "structured_output") and msg.structured_output:
                return msg.structured_output

        return {}

    async def close(self) -> None:
        """Close the agent session."""
        if self.client:
            await self.client.disconnect()
            self.client = None

    async def __aenter__(self) -> "NeuroResearchAgent":
        """Async context manager entry."""
        await self.start()
        return self

    async def __aexit__(self, *args: Any) -> None:
        """Async context manager exit."""
        await self.close()


async def run_task(
    prompt: str,
    project_dir: Path | str | None = None,
    model: str = "claude-sonnet-4-5-20250929"
) -> str:
    """
    Run a one-off task without maintaining session.

    This is a convenience function for simple tasks that don't require
    multi-turn conversation.

    Args:
        prompt: The task description
        project_dir: Working directory
        model: Claude model to use

    Returns:
        Task result as string
    """
    agent = NeuroResearchAgent(project_dir=project_dir, model=model)

    response_parts: list[str] = []

    async for msg in query(prompt=prompt, options=agent.options):
        if isinstance(msg, AssistantMessage):
            for block in msg.content:
                if isinstance(block, TextBlock):
                    response_parts.append(block.text)

    return "".join(response_parts)


# Convenience exports
__all__ = ["NeuroResearchAgent", "run_task"]
