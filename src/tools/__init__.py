"""Custom MCP tools for NeuroResearch Agent using Claude Agent SDK."""

from claude_agent_sdk import tool, create_sdk_mcp_server
from typing import Any
import json
import os
import subprocess
import tempfile
from pathlib import Path


@tool(
    "search_pubmed",
    "Search PubMed database for medical literature using NCBI E-utilities",
    {
        "query": str,
        "max_results": int,
        "date_range": str  # Format: "2020:2024"
    }
)
async def search_pubmed(args: dict[str, Any]) -> dict[str, Any]:
    """Search PubMed using NCBI E-utilities API."""
    import aiohttp

    api_key = os.environ.get("NCBI_API_KEY", "")
    base_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"

    query = args["query"]
    max_results = args.get("max_results", 100)
    date_range = args.get("date_range", "")

    # Build search parameters
    search_params = {
        "db": "pubmed",
        "term": query,
        "retmax": min(max_results, 500),
        "retmode": "json",
        "usehistory": "y"
    }

    if api_key:
        search_params["api_key"] = api_key

    if date_range and ":" in date_range:
        start_year, end_year = date_range.split(":")
        search_params["mindate"] = f"{start_year}/01/01"
        search_params["maxdate"] = f"{end_year}/12/31"
        search_params["datetype"] = "pdat"

    try:
        async with aiohttp.ClientSession() as session:
            # Search for PMIDs
            async with session.get(
                f"{base_url}/esearch.fcgi",
                params=search_params
            ) as resp:
                if resp.status != 200:
                    return {
                        "content": [{
                            "type": "text",
                            "text": f"PubMed search failed: HTTP {resp.status}"
                        }],
                        "is_error": True
                    }
                search_data = await resp.json()

            result = search_data.get("esearchresult", {})
            ids = result.get("idlist", [])
            total_count = result.get("count", "0")

            if not ids:
                return {
                    "content": [{
                        "type": "text",
                        "text": f"No results found for query: {query}"
                    }]
                }

            # Fetch article summaries
            fetch_params = {
                "db": "pubmed",
                "id": ",".join(ids[:50]),  # Limit summaries
                "retmode": "json"
            }
            if api_key:
                fetch_params["api_key"] = api_key

            async with session.get(
                f"{base_url}/esummary.fcgi",
                params=fetch_params
            ) as resp:
                summary_data = await resp.json()

            # Format results
            articles = []
            for pmid in ids[:50]:
                article = summary_data.get("result", {}).get(pmid, {})
                if article and isinstance(article, dict):
                    # Extract DOI from articleids
                    doi = ""
                    for aid in article.get("articleids", []):
                        if aid.get("idtype") == "doi":
                            doi = aid.get("value", "")
                            break

                    articles.append({
                        "pmid": pmid,
                        "title": article.get("title", ""),
                        "authors": ", ".join([
                            a.get("name", "")
                            for a in article.get("authors", [])[:3]
                        ]) + ("..." if len(article.get("authors", [])) > 3 else ""),
                        "journal": article.get("source", ""),
                        "year": article.get("pubdate", "")[:4],
                        "doi": doi
                    })

            # Build response
            response_text = f"## PubMed Search Results\n\n"
            response_text += f"**Query**: {query}\n"
            response_text += f"**Total found**: {total_count}\n"
            response_text += f"**Showing**: {len(articles)}\n\n"

            for i, art in enumerate(articles, 1):
                response_text += f"### {i}. PMID: {art['pmid']}\n"
                response_text += f"**{art['title']}**\n"
                response_text += f"*{art['authors']}*\n"
                response_text += f"{art['journal']} ({art['year']})\n"
                if art['doi']:
                    response_text += f"DOI: {art['doi']}\n"
                response_text += "\n"

            return {
                "content": [{
                    "type": "text",
                    "text": response_text
                }]
            }

    except Exception as e:
        return {
            "content": [{
                "type": "text",
                "text": f"Error searching PubMed: {str(e)}"
            }],
            "is_error": True
        }


@tool(
    "extract_pdf",
    "Extract text content from a PDF file for data extraction",
    {
        "file_path": str,
        "extract_tables": bool
    }
)
async def extract_pdf(args: dict[str, Any]) -> dict[str, Any]:
    """Extract text and tables from PDF using pdfplumber."""
    import pdfplumber

    file_path = Path(args["file_path"])
    extract_tables = args.get("extract_tables", False)

    if not file_path.exists():
        return {
            "content": [{
                "type": "text",
                "text": f"File not found: {file_path}"
            }],
            "is_error": True
        }

    try:
        text_content = []
        tables = []

        with pdfplumber.open(file_path) as pdf:
            for i, page in enumerate(pdf.pages, 1):
                # Extract text
                page_text = page.extract_text()
                if page_text:
                    text_content.append(f"--- Page {i} ---\n{page_text}")

                # Extract tables if requested
                if extract_tables:
                    page_tables = page.extract_tables()
                    for j, table in enumerate(page_tables, 1):
                        if table:
                            tables.append({
                                "page": i,
                                "table_num": j,
                                "data": table
                            })

        full_text = "\n\n".join(text_content)

        response = f"## PDF Extraction: {file_path.name}\n\n"
        response += f"**Pages**: {len(text_content)}\n"
        response += f"**Characters**: {len(full_text):,}\n"

        if tables:
            response += f"**Tables found**: {len(tables)}\n"

        response += f"\n---\n\n{full_text[:20000]}"

        if len(full_text) > 20000:
            response += f"\n\n... [Truncated. Full text: {len(full_text):,} characters]"

        if tables:
            response += f"\n\n## Tables\n\n"
            for table in tables[:5]:  # Limit to first 5 tables
                response += f"### Page {table['page']}, Table {table['table_num']}\n"
                for row in table['data'][:10]:
                    response += " | ".join(str(cell or "") for cell in row) + "\n"
                response += "\n"

        return {
            "content": [{
                "type": "text",
                "text": response
            }]
        }

    except Exception as e:
        return {
            "content": [{
                "type": "text",
                "text": f"Error extracting PDF: {str(e)}"
            }],
            "is_error": True
        }


def _get_sandbox_profile() -> str:
    """Generate macOS sandbox-exec profile for R execution."""
    return """
(version 1)
(deny default)

; Allow read access to system libraries and R installation
(allow file-read*
    (subpath "/usr")
    (subpath "/Library/Frameworks/R.framework")
    (subpath "/opt/homebrew")
    (subpath "/opt/local")
    (subpath "/private/var")
    (literal "/dev/null")
    (literal "/dev/urandom")
    (literal "/dev/random"))

; Allow write to temp and output directories (set dynamically)
(allow file-write* file-read*
    (subpath "/private/tmp")
    (subpath "/tmp")
    (subpath (param "OUTPUT_DIR")))

; Allow process execution
(allow process-exec*
    (subpath "/usr")
    (subpath "/Library/Frameworks/R.framework")
    (subpath "/opt/homebrew"))

; Allow basic process operations
(allow process-fork)
(allow signal (target self))
(allow sysctl-read)

; Deny network access
(deny network*)
"""


def _run_sandboxed_macos(script_path: str, output_dir: str, timeout: int) -> subprocess.CompletedProcess:
    """Run R script in macOS sandbox-exec."""
    profile = _get_sandbox_profile()

    with tempfile.NamedTemporaryFile(mode="w", suffix=".sb", delete=False) as pf:
        pf.write(profile)
        profile_path = pf.name

    try:
        result = subprocess.run(
            [
                "sandbox-exec", "-f", profile_path,
                "-D", f"OUTPUT_DIR={output_dir}",
                "Rscript", "--vanilla", script_path
            ],
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=output_dir
        )
        return result
    finally:
        Path(profile_path).unlink(missing_ok=True)


def _run_sandboxed_linux(script_path: str, output_dir: str, timeout: int) -> subprocess.CompletedProcess:
    """Run R script with Linux process isolation (firejail or bubblewrap if available)."""
    import shutil

    # Try firejail first
    if shutil.which("firejail"):
        return subprocess.run(
            [
                "firejail", "--quiet",
                "--net=none",           # No network
                "--private-tmp",        # Isolated /tmp
                "--nogroups",           # No supplementary groups
                f"--whitelist={output_dir}",
                "Rscript", "--vanilla", script_path
            ],
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=output_dir
        )

    # Try bubblewrap
    if shutil.which("bwrap"):
        return subprocess.run(
            [
                "bwrap",
                "--ro-bind", "/usr", "/usr",
                "--ro-bind", "/lib", "/lib",
                "--ro-bind", "/lib64", "/lib64",
                "--symlink", "usr/bin", "/bin",
                "--proc", "/proc",
                "--dev", "/dev",
                "--tmpfs", "/tmp",
                "--bind", output_dir, output_dir,
                "--ro-bind", script_path, script_path,
                "--unshare-net",        # No network
                "--die-with-parent",
                "Rscript", "--vanilla", script_path
            ],
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=output_dir
        )

    # Fallback: run with resource limits only
    return _run_with_limits(script_path, output_dir, timeout)


def _run_with_limits(script_path: str, output_dir: str, timeout: int) -> subprocess.CompletedProcess:
    """Run R with resource limits (fallback for systems without sandbox tools)."""
    import resource

    def set_limits():
        # Limit CPU time to timeout seconds
        resource.setrlimit(resource.RLIMIT_CPU, (timeout, timeout))
        # Limit memory to 4GB
        resource.setrlimit(resource.RLIMIT_AS, (4 * 1024**3, 4 * 1024**3))
        # Limit file size to 100MB
        resource.setrlimit(resource.RLIMIT_FSIZE, (100 * 1024**2, 100 * 1024**2))
        # Limit number of open files
        resource.setrlimit(resource.RLIMIT_NOFILE, (256, 256))

    return subprocess.run(
        ["Rscript", "--vanilla", script_path],
        capture_output=True,
        text=True,
        timeout=timeout,
        cwd=output_dir,
        preexec_fn=set_limits,
        env={
            **os.environ,
            "R_LIBS_USER": os.path.expanduser("~/.R/libs"),
            "HOME": output_dir  # Isolate home directory
        }
    )


@tool(
    "run_r_analysis",
    "Execute R code for meta-analysis in native sandbox (no Docker required)",
    {
        "code": str,
        "save_plots": bool,
        "output_dir": str
    }
)
async def run_r_analysis(args: dict[str, Any]) -> dict[str, Any]:
    """Execute R code in native sandbox with meta-analysis packages."""
    import platform
    import shutil

    code = args["code"]
    save_plots = args.get("save_plots", True)
    output_dir = args.get("output_dir", ".")
    timeout = 300  # 5 minute timeout

    # Check R is installed
    if not shutil.which("Rscript"):
        return {
            "content": [{
                "type": "text",
                "text": "R not found. Install R from https://cran.r-project.org/"
            }],
            "is_error": True
        }

    # Ensure output directory exists
    output_path = Path(output_dir).absolute()
    output_path.mkdir(parents=True, exist_ok=True)

    # Wrap code with plot-saving logic if needed
    if save_plots:
        plot_functions = ["forest", "funnel", "plot", "ggplot", "rob_summary", "rob_traffic"]
        if any(func in code for func in plot_functions):
            code = f"""
# Auto-save plots
options(device = function() png("{output_path}/r_plot_%03d.png", width=1200, height=800, res=150))

{code}

# Close any open devices
graphics.off()
"""

    # Write code to temporary file
    with tempfile.NamedTemporaryFile(
        mode="w",
        suffix=".R",
        delete=False,
        dir=str(output_path)  # Keep in output dir for sandbox access
    ) as f:
        f.write(code)
        script_path = f.name

    try:
        # Select sandbox method based on OS
        system = platform.system()

        if system == "Darwin":
            result = _run_sandboxed_macos(script_path, str(output_path), timeout)
            sandbox_type = "macOS sandbox-exec"
        elif system == "Linux":
            result = _run_sandboxed_linux(script_path, str(output_path), timeout)
            sandbox_type = "Linux isolation"
        else:
            result = _run_with_limits(script_path, str(output_path), timeout)
            sandbox_type = "resource limits"

        stdout = result.stdout
        stderr = result.stderr

        # Build response
        response = f"## R Analysis Output\n\n"
        response += f"**Sandbox**: {sandbox_type}\n\n"

        if stdout:
            response += "### Results\n```\n"
            response += stdout[:10000]
            if len(stdout) > 10000:
                response += "\n... [Output truncated]"
            response += "\n```\n\n"

        if stderr:
            # Filter out common R startup messages
            stderr_lines = [
                line for line in stderr.split("\n")
                if not any(x in line.lower() for x in [
                    "loading required package",
                    "attaching package",
                    "the following objects are masked"
                ])
            ]
            if stderr_lines:
                response += "### Warnings/Messages\n```\n"
                response += "\n".join(stderr_lines[:50])
                response += "\n```\n\n"

        if result.returncode != 0:
            response += f"### Exit Code: {result.returncode}\n"

        # Check for generated plots
        plots = list(output_path.glob("r_plot_*.png"))
        if plots:
            response += f"### Generated Plots\n"
            for plot in sorted(plots):
                response += f"- {plot.name}\n"

        return {
            "content": [{
                "type": "text",
                "text": response
            }]
        }

    except subprocess.TimeoutExpired:
        return {
            "content": [{
                "type": "text",
                "text": f"R execution timed out after {timeout // 60} minutes"
            }],
            "is_error": True
        }
    except Exception as e:
        return {
            "content": [{
                "type": "text",
                "text": f"Error running R: {str(e)}"
            }],
            "is_error": True
        }
    finally:
        # Cleanup temp file
        Path(script_path).unlink(missing_ok=True)


@tool(
    "validate_extraction",
    "Validate extracted study data against the extraction schema",
    {
        "data": dict,
        "schema_type": str  # "study", "outcome", or "meta-analysis"
    }
)
async def validate_extraction(args: dict[str, Any]) -> dict[str, Any]:
    """Validate extracted data against JSON schema."""
    import jsonschema
    from ..agent.schemas import EXTRACTION_SCHEMA, OUTCOME_SCHEMA, META_ANALYSIS_SCHEMA

    data = args["data"]
    schema_type = args.get("schema_type", "study")

    # Select schema
    schemas = {
        "study": EXTRACTION_SCHEMA,
        "outcome": OUTCOME_SCHEMA,
        "meta-analysis": META_ANALYSIS_SCHEMA
    }

    schema = schemas.get(schema_type)
    if not schema:
        return {
            "content": [{
                "type": "text",
                "text": f"Unknown schema type: {schema_type}. Use: study, outcome, or meta-analysis"
            }],
            "is_error": True
        }

    try:
        jsonschema.validate(data, schema)

        response = f"## Validation Passed ✓\n\n"
        response += f"**Schema**: {schema_type}\n"
        response += f"**Fields validated**: {len(data)}\n\n"

        # Summarize key fields
        if schema_type == "study":
            response += "### Study Summary\n"
            response += f"- ID: {data.get('study_id', 'N/A')}\n"
            response += f"- Year: {data.get('year', 'N/A')}\n"
            response += f"- Design: {data.get('study_design', 'N/A')}\n"
            response += f"- Sample size: {data.get('sample_size', 'N/A')}\n"
            if outcomes := data.get("outcomes"):
                response += f"- Outcomes: {len(outcomes)}\n"

        return {
            "content": [{
                "type": "text",
                "text": response
            }]
        }

    except jsonschema.ValidationError as e:
        path = " → ".join(str(p) for p in e.path) if e.path else "root"

        response = f"## Validation Failed ✗\n\n"
        response += f"**Schema**: {schema_type}\n"
        response += f"**Error location**: {path}\n"
        response += f"**Error**: {e.message}\n\n"

        if e.validator == "required":
            response += f"**Missing required field**: {e.message}\n"
        elif e.validator == "enum":
            response += f"**Allowed values**: {', '.join(str(v) for v in e.validator_value)}\n"
        elif e.validator == "type":
            response += f"**Expected type**: {e.validator_value}\n"
            response += f"**Got**: {type(e.instance).__name__}\n"

        return {
            "content": [{
                "type": "text",
                "text": response
            }],
            "is_error": True
        }

    except Exception as e:
        return {
            "content": [{
                "type": "text",
                "text": f"Validation error: {str(e)}"
            }],
            "is_error": True
        }


def create_neuroresearch_tools():
    """Create the SDK MCP server with all custom tools for neuroresearch."""
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


# Export for convenience
__all__ = [
    "search_pubmed",
    "extract_pdf",
    "run_r_analysis",
    "validate_extraction",
    "create_neuroresearch_tools"
]
