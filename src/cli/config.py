"""Configuration management for Meta CLI."""

import os
from pathlib import Path
from typing import Any
import yaml

# Default configuration
DEFAULT_CONFIG = {
    "api": {
        "model": "claude-sonnet-4-5-20250929",
    },
    "user": {
        "name": "",
        "affiliation": "",
        "email": "",
        "orcid": "",
    },
    "defaults": {
        "effect_measure": "OR",  # OR, RR, MD, SMD
        "model": "random",  # random, fixed
        "ci_level": 0.95,
        "prediction_interval": True,
        "hakn_adjustment": True,
    },
    "figures": {
        "dpi": 300,
        "format": "png",  # png, pdf, svg
        "style": "publication",  # publication, presentation
    },
    "pubmed": {
        "email": "",
    },
    "sandbox": {
        "type": "native",  # native, docker
        "timeout": 300,
        "memory_limit": "4g",
    },
}


def get_global_config_path() -> Path:
    """Get path to global config file."""
    return Path.home() / ".meta" / "config.yaml"


def get_project_config_path(project_dir: Path | None = None) -> Path:
    """Get path to project config file."""
    if project_dir is None:
        project_dir = Path.cwd()
    return project_dir / ".meta" / "config.yaml"


def load_global_config() -> dict[str, Any]:
    """Load global configuration."""
    config_path = get_global_config_path()

    if config_path.exists():
        with open(config_path) as f:
            user_config = yaml.safe_load(f) or {}
        return _merge_configs(DEFAULT_CONFIG, user_config)

    return DEFAULT_CONFIG.copy()


def load_project_config(project_dir: Path | None = None) -> dict[str, Any]:
    """Load project configuration, merged with global."""
    global_config = load_global_config()
    project_path = get_project_config_path(project_dir)

    if project_path.exists():
        with open(project_path) as f:
            project_config = yaml.safe_load(f) or {}
        return _merge_configs(global_config, project_config)

    return global_config


def save_global_config(config: dict[str, Any]) -> None:
    """Save global configuration."""
    config_path = get_global_config_path()
    config_path.parent.mkdir(parents=True, exist_ok=True)

    with open(config_path, "w") as f:
        yaml.dump(config, f, default_flow_style=False, sort_keys=False)


def save_project_config(config: dict[str, Any], project_dir: Path | None = None) -> None:
    """Save project configuration."""
    config_path = get_project_config_path(project_dir)
    config_path.parent.mkdir(parents=True, exist_ok=True)

    with open(config_path, "w") as f:
        yaml.dump(config, f, default_flow_style=False, sort_keys=False)


def get_api_key() -> str | None:
    """Get API key from config or environment."""
    # Check environment first
    for env_var in ["META_API_KEY", "ANTHROPIC_API_KEY"]:
        if key := os.environ.get(env_var):
            return key

    # Check global config
    config = load_global_config()
    if key := config.get("api", {}).get("key"):
        return key

    return None


def set_api_key(key: str) -> None:
    """Set API key in global config."""
    config = load_global_config()
    if "api" not in config:
        config["api"] = {}
    config["api"]["key"] = key
    save_global_config(config)


def get_model() -> str:
    """Get configured model."""
    config = load_project_config()
    return config.get("api", {}).get("model", DEFAULT_CONFIG["api"]["model"])


def get_user_info() -> dict[str, str]:
    """Get user information for manuscript authorship."""
    config = load_global_config()
    return config.get("user", {})


def set_user_info(name: str = "", affiliation: str = "", email: str = "", orcid: str = "") -> None:
    """Set user information."""
    config = load_global_config()
    config["user"] = {
        "name": name,
        "affiliation": affiliation,
        "email": email,
        "orcid": orcid,
    }
    save_global_config(config)


def get_analysis_defaults() -> dict[str, Any]:
    """Get default analysis settings."""
    config = load_project_config()
    return config.get("defaults", DEFAULT_CONFIG["defaults"])


def get_figure_settings() -> dict[str, Any]:
    """Get figure generation settings."""
    config = load_project_config()
    return config.get("figures", DEFAULT_CONFIG["figures"])


def get_pubmed_email() -> str:
    """Get email for PubMed API."""
    config = load_global_config()
    return config.get("pubmed", {}).get("email", "") or config.get("user", {}).get("email", "")


def get_ncbi_api_key() -> str | None:
    """Get NCBI API key from environment."""
    return os.environ.get("NCBI_API_KEY")


def _merge_configs(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    """Deep merge two configuration dictionaries."""
    result = base.copy()

    for key, value in override.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = _merge_configs(result[key], value)
        else:
            result[key] = value

    return result


def init_global_config() -> bool:
    """Initialize global config if it doesn't exist. Returns True if created."""
    config_path = get_global_config_path()

    if config_path.exists():
        return False

    # Create with defaults
    config_path.parent.mkdir(parents=True, exist_ok=True)

    # Generate config with comments
    config_content = """# Meta CLI Configuration
# Global settings for all projects

api:
  # model: claude-sonnet-4-5-20250929
  # key: your_anthropic_api_key  # Or use META_API_KEY env var

user:
  name: ""
  affiliation: ""
  email: ""
  orcid: ""

defaults:
  effect_measure: OR      # OR, RR, MD, SMD
  model: random           # random, fixed
  ci_level: 0.95
  prediction_interval: true
  hakn_adjustment: true

figures:
  dpi: 300
  format: png             # png, pdf, svg
  style: publication      # publication, presentation

pubmed:
  email: ""               # Required for PubMed API

sandbox:
  type: native            # native (recommended) or docker
  timeout: 300
  memory_limit: 4g
"""

    with open(config_path, "w") as f:
        f.write(config_content)

    return True


def validate_config() -> list[str]:
    """Validate configuration and return list of issues."""
    issues = []

    # Check API key
    if not get_api_key():
        issues.append("API key not set. Use 'meta config --api-key KEY' or set META_API_KEY")

    # Check email for PubMed
    if not get_pubmed_email():
        issues.append("Email not set (recommended for PubMed API). Use 'meta config --email EMAIL'")

    return issues
