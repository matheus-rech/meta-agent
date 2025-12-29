"""CLI entry point for Meta - AI Research Partner for Systematic Reviews."""

import asyncio
import sys
from pathlib import Path

import click
from rich.console import Console
from rich.markdown import Markdown
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.prompt import Prompt

from ..agent import NeuroResearchAgent, run_task
from .banner import (
    __version__,
    print_banner,
    print_welcome,
    print_success,
    print_error,
    print_info,
    print_warning,
)
from .config import (
    get_api_key,
    set_api_key,
    get_user_info,
    set_user_info,
    init_global_config,
    validate_config,
    load_global_config,
    save_global_config,
)
from .project import (
    init_project,
    is_meta_project,
    get_project_title,
    get_project_phase,
)
from .repl import run_repl

console = Console()


@click.group(invoke_without_command=True)
@click.version_option(version=__version__, prog_name="Meta")
@click.pass_context
def cli(ctx: click.Context) -> None:
    """
    Meta - Your AI Research Partner for Systematic Reviews

    Start an interactive session by running 'meta' without arguments,
    or use commands like 'meta search', 'meta extract', 'meta analyze'.

    \b
    Examples:
        meta                          # Start interactive session
        meta init "My Review Title"   # Create new project
        meta search "query"           # Search PubMed
        meta extract paper.pdf        # Extract data from PDF
        meta analyze data.csv -o mortality  # Run meta-analysis
    """
    # If no command provided, start interactive mode
    if ctx.invoked_subcommand is None:
        asyncio.run(run_repl())


@cli.command()
@click.argument("title")
@click.option("--dir", "-d", "parent_dir", type=click.Path(path_type=Path),
              default=".", help="Directory to create project in")
def init(title: str, parent_dir: Path) -> None:
    """Create a new systematic review project.

    TITLE is the name of your systematic review (e.g., "DBS for Parkinson's").

    This creates a complete project structure with:
    - Protocol template
    - Search documentation
    - Extraction templates
    - Analysis directories
    - Manuscript sections
    """
    try:
        init_project(title, parent_dir=parent_dir, console=console)
    except FileExistsError:
        sys.exit(1)


@cli.command()
@click.option("--api-key", help="Set Anthropic API key")
@click.option("--email", help="Set email (for PubMed API)")
@click.option("--name", help="Set your name (for manuscripts)")
@click.option("--affiliation", help="Set your affiliation")
@click.option("--show", is_flag=True, help="Show current configuration")
def config(api_key: str | None, email: str | None, name: str | None,
           affiliation: str | None, show: bool) -> None:
    """Configure Meta settings.

    Settings are stored in ~/.meta/config.yaml
    """
    # Initialize config if needed
    if init_global_config():
        print_success("Created configuration file at ~/.meta/config.yaml", console)

    if show:
        cfg = load_global_config()
        console.print_json(data=cfg)
        return

    if api_key:
        set_api_key(api_key)
        print_success("API key saved", console)

    if email or name or affiliation:
        user_info = get_user_info()
        set_user_info(
            name=name or user_info.get("name", ""),
            email=email or user_info.get("email", ""),
            affiliation=affiliation or user_info.get("affiliation", ""),
            orcid=user_info.get("orcid", ""),
        )
        print_success("User info saved", console)

    if not any([api_key, email, name, affiliation, show]):
        # Interactive configuration
        console.print("\n[bold]Meta Configuration[/]\n")

        current_key = get_api_key()
        if current_key:
            console.print(f"API Key: [green]configured[/] ({current_key[:8]}...)")
        else:
            new_key = Prompt.ask("API Key", password=True)
            if new_key:
                set_api_key(new_key)
                print_success("API key saved", console)

        user_info = get_user_info()
        console.print(f"\nName: {user_info.get('name') or '[dim]not set[/]'}")
        console.print(f"Email: {user_info.get('email') or '[dim]not set[/]'}")
        console.print(f"Affiliation: {user_info.get('affiliation') or '[dim]not set[/]'}")

        # Validate
        issues = validate_config()
        if issues:
            console.print()
            for issue in issues:
                print_warning(issue, console)


@cli.command()
@click.option("--project", "-p", type=click.Path(exists=True, path_type=Path), default=".",
              help="Project directory")
@click.option("--model", "-m", default=None,
              help="Claude model to use")
def chat(project: Path, model: str | None) -> None:
    """Start an interactive chat session."""
    asyncio.run(run_repl(project_dir=project, model=model))


@cli.command()
@click.argument("query")
@click.option("--max-results", "-n", default=50, help="Maximum number of results")
@click.option("--date-range", "-d", default="", help="Date range (e.g., '2020:2024')")
@click.option("--project", "-p", type=click.Path(exists=True, path_type=Path), default=".")
def search(query: str, max_results: int, date_range: str, project: Path) -> None:
    """Search PubMed for studies.

    QUERY is your search string (can include MeSH terms, boolean operators).

    Examples:
        meta search "decompressive craniectomy"
        meta search "deep brain stimulation AND Parkinson" -n 100
        meta search "stroke treatment" -d 2020:2024
    """
    async def run_search() -> None:
        prompt = f"Search PubMed for: {query}"
        if max_results != 50:
            prompt += f" (limit to {max_results} results)"
        if date_range:
            prompt += f" (published {date_range})"

        with Progress(
            SpinnerColumn(),
            TextColumn("[dim]Searching PubMed...[/]"),
            console=console,
            transient=True
        ) as progress:
            progress.add_task("search")
            result = await run_task(prompt, project_dir=project)

        console.print(Markdown(result))

    asyncio.run(run_search())


@cli.command()
@click.argument("pdf_path", type=click.Path(exists=True, path_type=Path))
@click.option("--output", "-o", type=click.Path(path_type=Path),
              help="Output YAML file for extracted data")
@click.option("--project", "-p", type=click.Path(exists=True, path_type=Path), default=".")
def extract(pdf_path: Path, output: Path | None, project: Path) -> None:
    """Extract structured data from a research paper PDF.

    Extracts study characteristics, demographics, interventions,
    and outcomes into a structured format.
    """
    async def run_extract() -> None:
        with Progress(
            SpinnerColumn(),
            TextColumn(f"[dim]Extracting from {pdf_path.name}...[/]"),
            console=console,
            transient=True
        ) as progress:
            progress.add_task("extract")

            async with NeuroResearchAgent(project_dir=project) as agent:
                data = await agent.extract_with_schema(pdf_path)

        if output:
            import yaml
            output.write_text(yaml.dump(data, default_flow_style=False, allow_unicode=True))
            print_success(f"Saved to {output}", console)
        else:
            import json
            console.print_json(json.dumps(data, indent=2))

    asyncio.run(run_extract())


@cli.command()
@click.argument("data_file", type=click.Path(exists=True, path_type=Path))
@click.option("--outcome", "-o", required=True, help="Outcome to analyze")
@click.option("--type", "analysis_type", default="binary",
              type=click.Choice(["binary", "continuous", "proportion", "survival"]),
              help="Type of meta-analysis")
@click.option("--output-dir", "-d", type=click.Path(path_type=Path), default=".",
              help="Directory for output files")
@click.option("--project", "-p", type=click.Path(exists=True, path_type=Path), default=".")
def analyze(
    data_file: Path,
    outcome: str,
    analysis_type: str,
    output_dir: Path,
    project: Path
) -> None:
    """Run meta-analysis on extracted study data.

    Performs random-effects meta-analysis with:
    - Forest plot generation
    - Funnel plot for publication bias
    - Heterogeneity assessment (I², τ²)
    - Egger's test for asymmetry
    """
    async def run_analysis() -> None:
        prompt = f"""
        Perform a {analysis_type} meta-analysis on {data_file} for the outcome: {outcome}

        Steps:
        1. Load the data from {data_file}
        2. Validate the data structure
        3. Run random-effects meta-analysis using the meta package
        4. Generate a forest plot (save to {output_dir}/forest_{outcome}.png)
        5. Generate a funnel plot (save to {output_dir}/funnel_{outcome}.png)
        6. Assess heterogeneity (I², Q, tau²)
        7. Test for publication bias (Egger's test)
        8. Provide a summary of the results
        """

        with Progress(
            SpinnerColumn(),
            TextColumn(f"[dim]Running {analysis_type} meta-analysis for {outcome}...[/]"),
            console=console,
            transient=True
        ) as progress:
            progress.add_task("analyze")
            result = await run_task(prompt, project_dir=project)

        console.print(Markdown(result))

        # Check for generated plots
        forest = output_dir / f"forest_{outcome}.png"
        funnel = output_dir / f"funnel_{outcome}.png"
        if forest.exists():
            print_success(f"Forest plot saved: {forest}", console)
        if funnel.exists():
            print_success(f"Funnel plot saved: {funnel}", console)

    asyncio.run(run_analysis())


@cli.command()
@click.argument("data_file", type=click.Path(exists=True, path_type=Path))
@click.option("--type", "plot_type", default="forest",
              type=click.Choice(["forest", "funnel", "rob", "prisma"]),
              help="Type of plot to generate")
@click.option("--output", "-o", type=click.Path(path_type=Path),
              help="Output file path")
@click.option("--project", "-p", type=click.Path(exists=True, path_type=Path), default=".")
def plot(data_file: Path, plot_type: str, output: Path | None, project: Path) -> None:
    """Generate publication-ready plots.

    Types:
    - forest: Forest plot showing effect sizes
    - funnel: Funnel plot for publication bias
    - rob: Risk of bias traffic light plot
    - prisma: PRISMA flow diagram
    """
    async def run_plot() -> None:
        output_path = output or Path(f"{plot_type}_plot.png")

        prompts = {
            "forest": f"Generate a forest plot from {data_file} and save to {output_path}",
            "funnel": f"Generate a funnel plot from {data_file} and save to {output_path}",
            "rob": f"Generate a risk of bias traffic light plot from {data_file} and save to {output_path}",
            "prisma": f"Generate a PRISMA flow diagram from {data_file} and save to {output_path}"
        }

        with Progress(
            SpinnerColumn(),
            TextColumn(f"[dim]Generating {plot_type} plot...[/]"),
            console=console,
            transient=True
        ) as progress:
            progress.add_task("plot")
            result = await run_task(prompts[plot_type], project_dir=project)

        console.print(Markdown(result))

        if output_path.exists():
            print_success(f"Plot saved: {output_path}", console)

    asyncio.run(run_plot())


@cli.command()
@click.option("--section", "-s", type=click.Choice([
    "abstract", "introduction", "methods", "results", "discussion", "all"
]), default="all", help="Section to write")
@click.option("--output", "-o", type=click.Path(path_type=Path),
              help="Output file path")
@click.option("--project", "-p", type=click.Path(exists=True, path_type=Path), default=".")
def write(section: str, output: Path | None, project: Path) -> None:
    """Write manuscript sections following PRISMA 2020.

    Uses your extracted data and analysis results to draft
    publication-ready manuscript sections.
    """
    async def run_write() -> None:
        prompt = f"""
        Write the {section} section(s) for a systematic review manuscript.

        Follow PRISMA 2020 guidelines and use the data available in:
        - extractions/ (study data)
        - analysis/ (meta-analysis results)
        - figures/ (generated plots)

        Output format: Academic manuscript style suitable for medical journals.
        """

        if section == "all":
            prompt += "\nWrite all major sections: Abstract, Introduction, Methods, Results, Discussion."

        with Progress(
            SpinnerColumn(),
            TextColumn(f"[dim]Writing {section} section(s)...[/]"),
            console=console,
            transient=True
        ) as progress:
            progress.add_task("write")
            result = await run_task(prompt, project_dir=project)

        if output:
            output.write_text(result)
            print_success(f"Saved to {output}", console)
        else:
            console.print(Markdown(result))

    asyncio.run(run_write())


@cli.command()
@click.option("--project", "-p", type=click.Path(exists=True, path_type=Path), default=".")
def status(project: Path) -> None:
    """Show project status and progress."""
    if not is_meta_project(project):
        print_warning("Not in a Meta project. Use 'meta init' to create one.", console)
        return

    from .project import get_project_state
    from .banner import print_project_status

    title = get_project_title(project)
    phase = get_project_phase(project)
    state = get_project_state(project)

    screening = state.get("screening", {})
    print_project_status(
        project_name=title,
        phase=phase,
        studies_found=screening.get("total", 0),
        studies_included=screening.get("included", 0),
        console=console
    )


def main() -> None:
    """Main entry point."""
    cli()


if __name__ == "__main__":
    main()
