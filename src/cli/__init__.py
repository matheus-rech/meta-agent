"""CLI package for Meta - AI Research Partner for Systematic Reviews."""

from .main import cli, main
from .banner import __version__, print_banner, print_welcome
from .config import load_global_config, load_project_config, get_api_key
from .project import init_project, is_meta_project
from .state import ProjectState, ConversationMemory
from .repl import run_repl, MetaREPL

__all__ = [
    "cli",
    "main",
    "__version__",
    "print_banner",
    "print_welcome",
    "load_global_config",
    "load_project_config",
    "get_api_key",
    "init_project",
    "is_meta_project",
    "ProjectState",
    "ConversationMemory",
    "run_repl",
    "MetaREPL",
]
