"""ASCII banner and welcome message for Meta CLI."""

from rich.console import Console
from rich.panel import Panel
from rich.text import Text
from rich.table import Table
from rich import box

__version__ = "1.0.0"

BANNER = r"""
███╗   ███╗███████╗████████╗ █████╗
████╗ ████║██╔════╝╚══██╔══╝██╔══██╗
██╔████╔██║█████╗     ██║   ███████║
██║╚██╔╝██║██╔══╝     ██║   ██╔══██║
██║ ╚═╝ ██║███████╗   ██║   ██║  ██║
╚═╝     ╚═╝╚══════╝   ╚═╝   ╚═╝  ╚═╝
"""

TAGLINE = "Your AI Research Partner for Systematic Reviews"


def print_banner(console: Console | None = None) -> None:
    """Print the Meta CLI banner."""
    if console is None:
        console = Console()

    # Create banner text with gradient colors
    banner_text = Text()
    lines = BANNER.strip().split('\n')
    colors = ["bright_cyan", "cyan", "blue", "bright_blue", "blue", "cyan"]

    for i, line in enumerate(lines):
        color = colors[i % len(colors)]
        banner_text.append(line + "\n", style=color)

    # Add tagline and version
    banner_text.append(f"\n{TAGLINE}\n", style="italic white")
    banner_text.append(f"v{__version__}", style="dim")

    console.print(Panel(
        banner_text,
        box=box.DOUBLE,
        border_style="bright_blue",
        padding=(1, 2)
    ))


def print_welcome(console: Console | None = None) -> None:
    """Print welcome message with capabilities."""
    if console is None:
        console = Console()

    console.print()
    console.print("Hello! I'm [bold cyan]Meta[/], your research partner for systematic reviews and meta-analyses.")
    console.print()

    # Capabilities table
    table = Table(
        show_header=False,
        box=box.SIMPLE,
        padding=(0, 2),
        collapse_padding=True
    )
    table.add_column("Icon", style="cyan", width=3)
    table.add_column("Capability", style="white")

    capabilities = [
        ("🔍", "Literature search and screening"),
        ("📊", "Meta-analysis and visualization"),
        ("📋", "Data extraction from studies"),
        ("⚖️", "Risk of bias assessment"),
        ("✍️", "Manuscript writing (PRISMA-compliant)"),
    ]

    for icon, cap in capabilities:
        table.add_row(icon, cap)

    console.print("I can help you with:")
    console.print(table)
    console.print()


def print_help_hint(console: Console | None = None) -> None:
    """Print help hint for new users."""
    if console is None:
        console = Console()

    console.print(
        "[dim]Type [bold]/help[/bold] for commands or just describe what you need.[/]",
        style="dim"
    )
    console.print()


def print_project_status(
    project_name: str,
    phase: str,
    studies_found: int = 0,
    studies_included: int = 0,
    console: Console | None = None
) -> None:
    """Print current project status."""
    if console is None:
        console = Console()

    status_table = Table(
        title=f"📁 {project_name}",
        box=box.ROUNDED,
        title_style="bold cyan"
    )
    status_table.add_column("Phase", style="yellow")
    status_table.add_column("Status", style="green")

    phases = [
        ("Protocol", "✓" if phase != "protocol" else "→"),
        ("Search", "✓" if phase not in ["protocol", "search"] else ("→" if phase == "search" else "○")),
        ("Screening", "✓" if phase not in ["protocol", "search", "screening"] else ("→" if phase == "screening" else "○")),
        ("Extraction", "✓" if phase not in ["protocol", "search", "screening", "extraction"] else ("→" if phase == "extraction" else "○")),
        ("Analysis", "✓" if phase == "complete" else ("→" if phase == "analysis" else "○")),
        ("Writing", "✓" if phase == "complete" else "○"),
    ]

    for p, status in phases:
        style = "green" if status == "✓" else ("yellow bold" if status == "→" else "dim")
        status_table.add_row(p, Text(status, style=style))

    console.print(status_table)

    if studies_found > 0:
        console.print(f"\n[dim]Studies: {studies_included}/{studies_found} included[/]")


def print_analysis_result(
    outcome: str,
    effect: float,
    ci_lower: float,
    ci_upper: float,
    p_value: float,
    i_squared: float,
    studies: int,
    participants: int,
    favors: str,
    console: Console | None = None
) -> None:
    """Print formatted meta-analysis result."""
    if console is None:
        console = Console()

    # Determine significance styling
    sig_style = "green bold" if p_value < 0.05 else "yellow"

    result_panel = f"""[bold]Outcome:[/] {outcome}
[bold]Studies:[/] {studies} | [bold]Participants:[/] {participants:,}

[bold cyan]Pooled Effect[/]
  OR: [bold]{effect:.2f}[/] [95% CI: {ci_lower:.2f}, {ci_upper:.2f}]
  p-value: [{sig_style}]{p_value:.4f}[/]
  Favors: [bold]{favors}[/]

[bold cyan]Heterogeneity[/]
  I² = {i_squared:.0f}% [{_interpret_i2(i_squared)}]
"""

    console.print(Panel(
        result_panel,
        title="📊 Meta-Analysis Results",
        border_style="cyan",
        box=box.ROUNDED
    ))


def _interpret_i2(i2: float) -> str:
    """Interpret I-squared value."""
    if i2 < 25:
        return "Low"
    elif i2 < 50:
        return "Low to moderate"
    elif i2 < 75:
        return "Moderate to substantial"
    else:
        return "Considerable"


def print_search_results(
    query: str,
    total: int,
    showing: int,
    console: Console | None = None
) -> None:
    """Print search results header."""
    if console is None:
        console = Console()

    console.print(Panel(
        f"[bold]Query:[/] {query}\n"
        f"[bold]Total found:[/] {total:,}\n"
        f"[bold]Showing:[/] {showing}",
        title="🔍 PubMed Search Results",
        border_style="green",
        box=box.ROUNDED
    ))


def print_error(message: str, console: Console | None = None) -> None:
    """Print error message."""
    if console is None:
        console = Console()

    console.print(f"[bold red]Error:[/] {message}")


def print_success(message: str, console: Console | None = None) -> None:
    """Print success message."""
    if console is None:
        console = Console()

    console.print(f"[bold green]✓[/] {message}")


def print_info(message: str, console: Console | None = None) -> None:
    """Print info message."""
    if console is None:
        console = Console()

    console.print(f"[cyan]ℹ[/] {message}")


def print_warning(message: str, console: Console | None = None) -> None:
    """Print warning message."""
    if console is None:
        console = Console()

    console.print(f"[yellow]⚠[/] {message}")
