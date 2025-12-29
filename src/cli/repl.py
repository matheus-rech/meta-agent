"""Enhanced interactive REPL for Meta CLI."""

import asyncio
import sys
from pathlib import Path
from typing import AsyncIterator

from rich.console import Console
from rich.live import Live
from rich.markdown import Markdown
from rich.panel import Panel
from rich.prompt import Prompt
from rich.spinner import Spinner
from rich.text import Text

from ..agent import NeuroResearchAgent
from .banner import print_banner, print_welcome, print_help_hint, print_project_status
from .config import get_api_key, validate_config
from .project import is_meta_project, get_project_title, get_project_phase
from .state import ProjectState, ConversationMemory


COMMANDS = {
    "/help": "Show available commands",
    "/status": "Show project status",
    "/search": "Search PubMed (e.g., /search decompressive craniectomy)",
    "/extract": "Extract data from PDF (e.g., /extract paper.pdf)",
    "/analyze": "Run meta-analysis (e.g., /analyze mortality)",
    "/write": "Draft manuscript section (e.g., /write methods)",
    "/exit": "Exit Meta",
    "/quit": "Exit Meta",
    "/clear": "Clear conversation history",
}


class MetaREPL:
    """Interactive REPL for Meta CLI."""

    def __init__(
        self,
        project_dir: Path | None = None,
        model: str | None = None,
    ):
        self.project_dir = project_dir or Path.cwd()
        self.model = model
        self.console = Console()
        self.agent: NeuroResearchAgent | None = None
        self.state: ProjectState | None = None
        self.memory: ConversationMemory | None = None
        self.running = False

    async def start(self) -> None:
        """Start the interactive REPL."""
        # Print banner
        print_banner(self.console)

        # Check configuration
        issues = validate_config()
        if issues:
            for issue in issues:
                self.console.print(f"[yellow]⚠[/] {issue}")
            self.console.print()

        # Check if in a project
        if is_meta_project(self.project_dir):
            title = get_project_title(self.project_dir)
            phase = get_project_phase(self.project_dir)
            self.state = ProjectState(self.project_dir)
            self.memory = ConversationMemory(self.project_dir)

            self.console.print(f"[dim]Project:[/] [bold cyan]{title}[/]")
            self.console.print(f"[dim]Phase:[/] {phase}")
            self.console.print()
        else:
            print_welcome(self.console)

        print_help_hint(self.console)

        # Initialize agent
        try:
            self.agent = NeuroResearchAgent(
                project_dir=self.project_dir,
                model=self.model or "claude-sonnet-4-5-20250929",
            )
            await self.agent.start()
        except Exception as e:
            self.console.print(f"[red]Failed to initialize agent: {e}[/]")
            return

        # Start REPL loop
        self.running = True
        await self._repl_loop()

    async def _repl_loop(self) -> None:
        """Main REPL loop."""
        while self.running:
            try:
                # Get user input
                user_input = Prompt.ask("\n[bold cyan]You[/]")

                if not user_input.strip():
                    continue

                # Handle commands
                if user_input.startswith("/"):
                    await self._handle_command(user_input)
                    continue

                # Regular message - send to agent
                await self._process_message(user_input)

            except KeyboardInterrupt:
                self.console.print("\n[dim]Use /exit to quit[/]")
            except EOFError:
                break

        # Cleanup
        if self.agent:
            await self.agent.close()

        self.console.print("\n[dim]Goodbye![/]")

    async def _handle_command(self, command: str) -> None:
        """Handle slash commands."""
        parts = command.split(maxsplit=1)
        cmd = parts[0].lower()
        args = parts[1] if len(parts) > 1 else ""

        if cmd in ("/exit", "/quit"):
            self.running = False
            return

        if cmd == "/help":
            self._show_help()
            return

        if cmd == "/status":
            self._show_status()
            return

        if cmd == "/clear":
            if self.memory:
                self.memory.clear_context()
            self.console.print("[dim]Conversation cleared[/]")
            return

        if cmd == "/search":
            if args:
                await self._process_message(f"Search PubMed for: {args}")
            else:
                self.console.print("[yellow]Usage: /search <query>[/]")
            return

        if cmd == "/extract":
            if args:
                await self._process_message(f"Extract data from: {args}")
            else:
                self.console.print("[yellow]Usage: /extract <pdf_path>[/]")
            return

        if cmd == "/analyze":
            if args:
                await self._process_message(f"Run meta-analysis for outcome: {args}")
            else:
                self.console.print("[yellow]Usage: /analyze <outcome>[/]")
            return

        if cmd == "/write":
            if args:
                await self._process_message(f"Write manuscript section: {args}")
            else:
                self.console.print("[yellow]Usage: /write <section>[/]")
            return

        self.console.print(f"[yellow]Unknown command: {cmd}. Use /help for available commands.[/]")

    def _show_help(self) -> None:
        """Show help message."""
        self.console.print("\n[bold]Available Commands[/]\n")
        for cmd, desc in COMMANDS.items():
            self.console.print(f"  [cyan]{cmd:12}[/] {desc}")
        self.console.print("\n[dim]Or just type your question/request naturally.[/]")

    def _show_status(self) -> None:
        """Show project status."""
        if self.state:
            stats = self.state.stats
            title = get_project_title(self.project_dir)
            print_project_status(
                project_name=title,
                phase=stats["phase"],
                studies_found=stats.get("total_results", 0),
                studies_included=stats.get("screening", {}).get("included", 0),
                console=self.console
            )
        else:
            self.console.print("[yellow]Not in a Meta project. Use 'meta init' to create one.[/]")

    async def _process_message(self, message: str) -> None:
        """Process a message and stream response."""
        if not self.agent:
            self.console.print("[red]Agent not initialized[/]")
            return

        # Save to memory
        if self.memory:
            self.memory.add_turn("user", message)

        # Show thinking indicator
        self.console.print()

        response_text = ""

        try:
            # Stream response with live display
            with Live(
                Spinner("dots", text="[dim]Thinking...[/]"),
                console=self.console,
                refresh_per_second=10,
                transient=True
            ) as live:
                async for chunk in self.agent.stream_chat(message):
                    response_text += chunk
                    # Update live display with streamed content
                    live.update(Text(response_text[-500:], style="dim"))  # Show last 500 chars

            # Print final response as markdown
            self.console.print("[bold green]Meta[/]")
            self.console.print(Markdown(response_text))

            # Save to memory
            if self.memory:
                self.memory.add_turn("assistant", response_text)

        except Exception as e:
            self.console.print(f"[red]Error: {e}[/]")


async def run_repl(project_dir: Path | None = None, model: str | None = None) -> None:
    """Run the interactive REPL."""
    repl = MetaREPL(project_dir=project_dir, model=model)
    await repl.start()


def main():
    """Entry point for REPL."""
    asyncio.run(run_repl())


if __name__ == "__main__":
    main()
